import asyncio
import uuid
import random
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Dict, List, Optional, Tuple

import numpy as np

import rover_ai
from compressor import compress_readings_delta_deflate
from routers.websocket import broadcast

if TYPE_CHECKING:
    from energy_controller import EnergyController
    from river_learner import RiverLearner
    from rl_agent import RLAgent

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

_NOVELTY_MAX = 1000


class EdgeProcessor:
    def __init__(
        self,
        river_learner: Optional["RiverLearner"] = None,
        energy_controller: Optional["EnergyController"] = None,
        rl_agent: Optional["RLAgent"] = None,
    ) -> None:
        self._river = river_learner
        self._energy = energy_controller
        self._rl = rl_agent
        self._history: Dict[str, List[float]] = defaultdict(list)
        self._max_history = 500
        self._total_packets = 0
        self._transmitted_packets = 0
        self._payload_serialized_total = 0
        self._payload_compressed_total = 0
        self._last_payload_serialized = 0
        self._last_payload_compressed = 0
        self._zlib_level = 6
        self._novelty_vecs: deque = deque(maxlen=_NOVELTY_MAX)
        self._last_rl_state: Optional[Tuple[float, float, bool]] = None
        self._last_rl_action_idx: int = 1

    def _update_history(self, sensor_type: str, value: float) -> None:
        self._history[sensor_type].append(value)
        if len(self._history[sensor_type]) > self._max_history:
            self._history[sensor_type] = self._history[sensor_type][-self._max_history :]

    def _compute_z_style_score(self, reading: dict) -> float:
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
        return round(min(100.0, z_score * 25.0), 2)

    def _compute_base_scores(self, reading: dict) -> Tuple[float, float]:
        smoothed_err = reading.get("_smoothed_error")
        if smoothed_err is not None:
            lstm_s = min(100.0, float(smoothed_err) * 300.0)
            return round(lstm_s, 2), lstm_s
        z_s = self._compute_z_style_score(reading)
        return z_s, z_s

    def _novelty_check(self, channel_id: str, raw_value: float) -> Tuple[bool, float]:
        ch_norm = (hash(channel_id) % 1000) / 1000.0
        vec = np.array([float(raw_value), float(ch_norm)], dtype=np.float64)
        nrm = np.linalg.norm(vec) + 1e-9
        if len(self._novelty_vecs) == 0:
            self._novelty_vecs.append(vec)
            return False, 0.0
        best = -1.0
        for v in self._novelty_vecs:
            vn = np.linalg.norm(v) + 1e-9
            sim = float(np.dot(vec, v) / (nrm * vn))
            best = max(best, sim)
        self._novelty_vecs.append(vec)
        return best < 0.3, float(best)

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

    async def process_batch(self, raw_readings: List[dict]) -> Tuple[List[dict], List[dict], Optional[dict]]:
        anomaly_events: List[dict] = []
        temps: List[dict] = []
        for reading in raw_readings:
            sensor_type = reading["sensor_type"]
            value = reading["raw_value"]
            self._update_history(sensor_type, value)

            base_for_hybrid, lstm_or_z_display = self._compute_base_scores(reading)
            smoothed_err = reading.get("_smoothed_error")
            cid = str(reading.get("_chan_id") or reading.get("channel_id") or sensor_type)
            if self._river is not None:
                river_s = self._river.score_and_learn(cid, value)
                if smoothed_err is not None:
                    score = round(base_for_hybrid * 0.5 + river_s * 0.5, 2)
                else:
                    score = round(base_for_hybrid * 0.4 + river_s * 0.6, 2)
            else:
                river_s = float(lstm_or_z_display)
                score = round(base_for_hybrid, 2)

            reading["_river_score"] = round(float(river_s), 2)
            reading["_lstm_score"] = round(float(lstm_or_z_display), 2)
            is_novel, nov_sim = self._novelty_check(cid, value)
            reading["_novelty_similarity"] = round(float(nov_sim), 4)

            reading["_pending_score"] = score
            reading["_is_novel"] = is_novel
            reading["_lstm_or_z"] = lstm_or_z_display
            temps.append(reading)

        scores = [float(r["_pending_score"]) for r in temps]
        mean_score = float(np.mean(scores)) if scores else 0.0
        novel_any = any(r.get("_is_novel") for r in temps)

        base_th, zlib_lvl = (50, 6)
        if self._energy is not None:
            base_th, zlib_lvl = self._energy.get_threshold_and_zlib()
        adj = 0
        action_idx = 1
        bat = self._energy.get_battery_level() if self._energy else 50.0
        if self._rl is not None and self._energy is not None:
            adj, action_idx = self._rl.get_threshold_adjustment(mean_score, bat, novel_any)
        threshold = int(max(40, min(85, base_th + adj)))
        self._zlib_level = zlib_lvl
        self._last_rl_state = (mean_score, bat, novel_any)
        self._last_rl_action_idx = action_idx

        processed = []
        for reading in temps:
            score = float(reading.pop("_pending_score"))
            is_novel = bool(reading.pop("_is_novel"))
            reading.pop("_lstm_or_z", None)

            is_score_anomaly = score >= threshold
            is_anomaly = is_score_anomaly
            reading["anomaly_score"] = score
            reading["is_anomaly"] = is_anomaly
            reading["is_transmitted"] = False
            reading["is_novel"] = is_novel
            reading["_is_anomaly_final"] = is_anomaly
            reading["_uplink_eligible"] = score >= threshold

            self._total_packets += 1

            internal_keys = [k for k in reading if k.startswith("_")]
            clean_reading = {k: v for k, v in reading.items() if not k.startswith("_")}
            processed.append({**clean_reading, **{k: reading[k] for k in internal_keys}})

        anomalous = [r for r in processed if r.get("_is_anomaly_final")]
        for reading in anomalous:
            anomaly_type = self._detect_anomaly_type(reading, processed)
            severity = self._determine_severity(reading["anomaly_score"])
            priority = PRIORITY_MAP.get(anomaly_type, 4)
            if reading.get("is_novel"):
                priority = min(10, priority + 2)

            anomaly_events.append(
                {
                    "id": uuid.uuid4(),
                    "reading_id": reading["id"],
                    "anomaly_type": anomaly_type,
                    "severity": severity,
                    "description": self._build_description(
                        anomaly_type, reading, reading["anomaly_score"]
                    ),
                    "scientific_priority": priority,
                    "acknowledged": False,
                    "created_at": datetime.now(timezone.utc),
                }
            )

        rl_labels = {0: "eşik Δ-5", 1: "eşik nötr", 2: "eşik Δ+5"}
        energy_level = float(self._energy.get_battery_level()) if self._energy else 50.0
        for reading in processed:
            if float(reading.get("anomaly_score", 0)) < 50:
                continue
            ch = str(reading.get("_chan_id") or reading.get("channel_id") or reading["sensor_type"])
            anomaly_type = self._detect_anomaly_type(reading, processed)
            pri = PRIORITY_MAP.get(anomaly_type, 4)
            if reading.get("is_novel"):
                pri = min(10, pri + 2)
            rl_suggestion = f"RL Δ={adj} — {rl_labels.get(action_idx, f'eylem_{action_idx}')}"
            ctx = {
                "channel_id": ch,
                "sensor_type": reading["sensor_type"],
                "raw_value": reading["raw_value"],
                "anomaly_score": reading["anomaly_score"],
                "river_score": reading.get("_river_score", 0),
                "lstm_score": reading.get("_lstm_score", 0),
                "is_novel": bool(reading.get("is_novel")),
                "novelty_similarity": float(reading.get("_novelty_similarity", 0)),
                "energy_level": energy_level,
                "rl_suggestion": rl_suggestion,
                "scientific_priority": int(pri),
                "anomaly_type": anomaly_type,
                "uplink_eligible": bool(reading.get("_uplink_eligible")),
            }
            try:
                out = await asyncio.wait_for(rover_ai.think(ctx), timeout=10.0)
            except asyncio.TimeoutError:
                out = {
                    "thinking": "AI thinking devre dışı",
                    "steps": [],
                    "decision": "TX" if reading.get("_uplink_eligible") else "DROP",
                    "duration_ms": 0,
                    "model": "fallback",
                }
            ts = datetime.now(timezone.utc).isoformat()
            await broadcast(
                {
                    "type": "rover_thinking",
                    "data": {
                        "channel_id": ch,
                        "anomaly_score": float(reading["anomaly_score"]),
                        "thinking": out.get("thinking", ""),
                        "steps": out.get("steps") or [],
                        "decision": out.get("decision", "TX"),
                        "duration_ms": int(out.get("duration_ms", 0)),
                        "model": out.get("model", "fallback"),
                        "timestamp": ts,
                        "is_novel": bool(reading.get("is_novel")),
                        "novelty_similarity": float(reading.get("_novelty_similarity", 0)),
                        "energy_level": round(energy_level, 1),
                    },
                }
            )

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
            row = {k: v for k, v in r.items() if not k.startswith("_")}
            row["channel_id"] = str(r.get("_chan_id") or "")
            row["ground_truth_anomaly"] = bool(r.get("_is_labeled_anomaly", False))
            row["is_novel"] = bool(r.get("is_novel", False))
            if r.get("_uplink_eligible"):
                row["_uplink_eligible"] = True
            db_readings.append(row)

        return db_readings, anomaly_events, transmission_log

    def record_uplink_batch(self, sent_readings: List[dict]) -> None:
        if not sent_readings:
            return
        self._transmitted_packets += len(sent_readings)
        comp = compress_readings_delta_deflate(
            sent_readings, zlib_level=self._zlib_level
        )
        if comp.serialized_bytes > 0:
            self._payload_serialized_total += comp.serialized_bytes
            self._payload_compressed_total += comp.compressed_bytes
        self._last_payload_serialized = comp.serialized_bytes
        self._last_payload_compressed = comp.compressed_bytes

    def apply_rl_rewards_after_uplink(self, sent_readings: List[dict]) -> None:
        if not sent_readings or self._rl is None or self._last_rl_state is None:
            return
        rep_score, bat, novel = self._last_rl_state
        ai = self._last_rl_action_idx
        rewards = []
        for r in sent_readings:
            s = float(r.get("anomaly_score", 0))
            pri_high = s >= 72 and r.get("is_anomaly")
            waste = s < 58
            rew = 0.0
            if pri_high:
                rew += 10.0
            if waste:
                rew -= 5.0
            if r.get("is_novel"):
                rew += 5.0
            rewards.append(rew)
        reward = float(np.mean(rewards)) if rewards else 0.0
        self._rl.update_from_action(rep_score, bat, novel, ai, reward)

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
