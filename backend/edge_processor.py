import uuid
import random
from collections import defaultdict
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

import numpy as np

from compressor import compress_readings_delta_deflate

ANOMALY_TYPE_MAP: Dict[str, str] = {
    "CH4": "methane_spike",
    "MOIST": "moisture_anomaly",
    "SPEC": "spectral_deviation",
    "TEMP": "temperature_extreme",
    "UV": "radiation_anomaly",
    "O2": "atmospheric_anomaly",
    "CO2": "atmospheric_anomaly",
    "PRESS": "pressure_anomaly",
}

PRIORITY_MAP: Dict[str, int] = {
    "organic_molecule": 10,
    "methane_spike": 8,
    "spectral_deviation": 7,
    "moisture_anomaly": 6,
    "radiation_anomaly": 5,
    "atmospheric_anomaly": 5,
    "pressure_anomaly": 4,
    "temperature_extreme": 4,
}

DSN_WINDOWS = ["Goldstone-DSS14", "Canberra-DSS43", "Madrid-DSS63"]


class EdgeProcessor:
    def __init__(self) -> None:
        self._history: Dict[str, List[float]] = defaultdict(list)
        self._max_history = 500
        self._total_packets = 0
        self._transmitted_packets = 0
        self._payload_serialized_total = 0
        self._payload_compressed_total = 0
        self._last_payload_serialized = 0
        self._last_payload_compressed = 0

    def _update_history(self, sensor_type: str, value: float) -> None:
        self._history[sensor_type].append(value)
        if len(self._history[sensor_type]) > self._max_history:
            self._history[sensor_type] = self._history[sensor_type][-self._max_history:]

    def _compute_anomaly_score(self, reading: dict) -> float:
        smoothed_err = reading.get("_smoothed_error")
        if smoothed_err is not None:
            score = min(100.0, smoothed_err * 300.0)
            return round(score, 2)

        sensor_type = reading["sensor_type"]
        value = reading["raw_value"]
        history = self._history[sensor_type]

        if len(history) < 10:
            sensor_std = 0.3
            sensor_mean = 0.0
        else:
            sensor_mean = float(np.mean(history))
            sensor_std = float(np.std(history))

        if sensor_std < 1e-6:
            sensor_std = 0.01

        z_score = abs(value - sensor_mean) / sensor_std
        score = min(100.0, z_score * 25.0)
        return round(score, 2)

    def _determine_severity(self, score: float) -> str:
        if score >= 90:
            return "CRITICAL"
        if score >= 70:
            return "HIGH"
        if score >= 50:
            return "MEDIUM"
        return "LOW"

    def _detect_anomaly_type(self, reading: dict, all_readings: List[dict]) -> str:
        anomalous_sensors = {r["sensor_type"] for r in all_readings if r.get("_is_anomaly_final")}
        if len(anomalous_sensors) >= 3:
            return "organic_molecule"
        return ANOMALY_TYPE_MAP.get(reading["sensor_type"], "temperature_extreme")

    def _build_description(self, anomaly_type: str, reading: dict, score: float) -> str:
        chan_label = reading.get("_chan_label", reading["sensor_type"])
        chan_id = reading.get("_chan_id", "")
        value = reading["raw_value"]
        pred = reading.get("_prediction")

        pred_info = f" LSTM tahmini: {pred:.4f}," if pred is not None else ""

        descriptions = {
            "organic_molecule": f"Çoklu sensör anomalisi — olası organik molekül imzası. Kanal: {chan_label} ({chan_id}), değer: {value:.4f},{pred_info} skor: {score}.",
            "methane_spike": f"Metan konsantrasyonu sıçraması: {chan_label} ({chan_id}), değer: {value:.4f},{pred_info} skor: {score}. Olası yeraltı salınımı.",
            "moisture_anomaly": f"Beklenmeyen nem okuması: {chan_label} ({chan_id}), değer: {value:.4f},{pred_info} skor: {score}. Yeraltı buz etkileşimi olabilir.",
            "spectral_deviation": f"Spektral yoğunluk sapması: {chan_label} ({chan_id}), değer: {value:.4f},{pred_info} skor: {score}. Bilinmeyen mineral imzası.",
            "temperature_extreme": f"Sıcaklık ekstremi: {chan_label} ({chan_id}), değer: {value:.4f},{pred_info} skor: {score}. Nominal aralık dışında.",
            "radiation_anomaly": f"Radyasyon anomalisi: {chan_label} ({chan_id}), değer: {value:.4f},{pred_info} skor: {score}. UV/radyasyon seviyesi anormal.",
            "atmospheric_anomaly": f"Atmosferik anomali: {chan_label} ({chan_id}), değer: {value:.4f},{pred_info} skor: {score}. Gaz konsantrasyonu sapması.",
            "pressure_anomaly": f"Basınç anomalisi: {chan_label} ({chan_id}), değer: {value:.4f},{pred_info} skor: {score}. Atmosferik basınç sapması.",
        }
        return descriptions.get(anomaly_type, f"Anomali: {chan_label}, değer {value:.4f}, skor {score}.")

    def process_batch(self, raw_readings: List[dict]) -> Tuple[List[dict], List[dict], Optional[dict]]:
        processed = []
        anomaly_events = []

        for reading in raw_readings:
            sensor_type = reading["sensor_type"]
            value = reading["raw_value"]

            score = self._compute_anomaly_score(reading)
            self._update_history(sensor_type, value)

            is_labeled = reading.get("_is_labeled_anomaly", False)
            is_score_anomaly = score >= 50
            is_anomaly = is_labeled or is_score_anomaly
            # Gerçek uplink: kuyruk boşaltılınca is_transmitted=True olur
            reading["anomaly_score"] = score
            reading["is_anomaly"] = is_anomaly
            reading["is_transmitted"] = False
            reading["_is_anomaly_final"] = is_anomaly
            reading["_uplink_eligible"] = score >= 50

            self._total_packets += 1

            internal_keys = [k for k in reading if k.startswith("_")]
            clean_reading = {k: v for k, v in reading.items() if not k.startswith("_")}
            processed.append({**clean_reading, **{k: reading[k] for k in internal_keys}})

        anomalous = [r for r in processed if r.get("_is_anomaly_final")]
        for reading in anomalous:
            anomaly_type = self._detect_anomaly_type(reading, processed)
            severity = self._determine_severity(reading["anomaly_score"])
            priority = PRIORITY_MAP.get(anomaly_type, 4)

            anomaly_events.append({
                "id": uuid.uuid4(),
                "reading_id": reading["id"],
                "anomaly_type": anomaly_type,
                "severity": severity,
                "description": self._build_description(anomaly_type, reading, reading["anomaly_score"]),
                "scientific_priority": priority,
                "acknowledged": False,
                "created_at": datetime.now(timezone.utc),
            })

        # Sıkıştırma metrikleri gerçek uplink anında (drain) birikir
        self._last_payload_serialized = 0
        self._last_payload_compressed = 0

        transmission_log = None
        if self._total_packets > 0:
            total = len(raw_readings)
            transmitted = len([r for r in processed if r.get("_uplink_eligible")])
            bytes_per_packet = 256
            bytes_saved = (total - transmitted) * bytes_per_packet
            compression_ratio = round(transmitted / total, 4) if total > 0 else 1.0

            transmission_log = {
                "id": uuid.uuid4(),
                "batch_id": uuid.uuid4(),
                "total_packets": total,
                "transmitted_packets": transmitted,
                "bytes_saved": bytes_saved,
                "compression_ratio": compression_ratio,
                "transmission_window": random.choice(DSN_WINDOWS),
                "created_at": datetime.now(timezone.utc),
            }

        db_readings = []
        for r in processed:
            db_readings.append({k: v for k, v in r.items() if not k.startswith("_")})

        return db_readings, anomaly_events, transmission_log

    def record_uplink_batch(self, sent_readings: List[dict]) -> None:
        """Kuyruktan çıkan ve DSN ile gönderilen paketler — DEFLATE metrikleri burada."""
        if not sent_readings:
            return
        self._transmitted_packets += len(sent_readings)
        comp = compress_readings_delta_deflate(sent_readings)
        if comp.serialized_bytes > 0:
            self._payload_serialized_total += comp.serialized_bytes
            self._payload_compressed_total += comp.compressed_bytes
        self._last_payload_serialized = comp.serialized_bytes
        self._last_payload_compressed = comp.compressed_bytes

    def get_stats(self) -> dict:
        ratio = round(self._transmitted_packets / self._total_packets, 4) if self._total_packets > 0 else 0.0
        ser = self._payload_serialized_total
        z = self._payload_compressed_total
        deflate_ratio = round(z / ser, 6) if ser > 0 else 0.0
        deflate_savings_pct = round((1 - deflate_ratio) * 100, 2) if ser > 0 else 0.0
        last_ser = self._last_payload_serialized
        last_z = self._last_payload_compressed
        last_deflate_ratio = round(last_z / last_ser, 6) if last_ser > 0 else 0.0
        return {
            "total_packets": self._total_packets,
            "transmitted_packets": self._transmitted_packets,
            "compression_ratio": ratio,
            "bandwidth_saved_percent": round((1 - ratio) * 100, 2),
            "total_bytes_saved": (self._total_packets - self._transmitted_packets) * 256,
            "payload_serialized_bytes": ser,
            "payload_deflated_bytes": z,
            "payload_deflate_ratio": deflate_ratio,
            "payload_deflate_savings_percent": deflate_savings_pct,
            "last_batch_payload_bytes": last_ser,
            "last_batch_deflated_bytes": last_z,
            "last_batch_deflate_ratio": last_deflate_ratio,
        }
