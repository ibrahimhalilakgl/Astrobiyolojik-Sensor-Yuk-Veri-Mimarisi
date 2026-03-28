import math
import os
import uuid
import ast
from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
MODEL_DIR = os.path.join(DATA_DIR, "2018-05-19_15.00.10")

MSL_CHANNELS = {
    "T-1":  {"sensor_type": "TEMP",  "unit": "°C",    "label": "Sıcaklık Sensörü"},
    "T-2":  {"sensor_type": "TEMP",  "unit": "°C",    "label": "Termal Kontrol"},
    "P-10": {"sensor_type": "PRESS", "unit": "Pa",    "label": "Basınç Sistemi"},
    "P-14": {"sensor_type": "PRESS", "unit": "Pa",    "label": "Hidrolik Basınç"},
    "M-6":  {"sensor_type": "CH4",   "unit": "ppb",   "label": "Metan Dedektörü"},
    "M-7":  {"sensor_type": "MOIST", "unit": "%",     "label": "Nem Sensörü"},
    "C-1":  {"sensor_type": "SPEC",  "unit": "nm",    "label": "Spektrometre A"},
    "C-2":  {"sensor_type": "SPEC",  "unit": "nm",    "label": "Spektrometre B"},
    "D-14": {"sensor_type": "UV",    "unit": "mW/m²", "label": "UV Radyasyon"},
    "D-15": {"sensor_type": "O2",    "unit": "%",     "label": "Oksijen Sensörü"},
    "D-16": {"sensor_type": "CO2",   "unit": "%",     "label": "CO₂ Sensörü"},
    "F-7":  {"sensor_type": "SPEC",  "unit": "nm",    "label": "FTIR Spektroskopi"},
}

# MSL (Curiosity) — Gale Krateri / Bradbury İniş yakını (gösterim koordinatları)
GALE_CRATER_LANDING = (-4.5892, 137.4417)


@dataclass
class NASADataLoader:
    channels: Dict[str, dict] = field(default_factory=dict)
    anomaly_labels: Dict[str, list] = field(default_factory=dict)
    smoothed_errors: Dict[str, np.ndarray] = field(default_factory=dict)
    y_hat: Dict[str, np.ndarray] = field(default_factory=dict)
    cursors: Dict[str, int] = field(default_factory=dict)
    sol: int = 1
    tick_count: int = 0
    lat: float = GALE_CRATER_LANDING[0]
    lon: float = GALE_CRATER_LANDING[1]
    _loaded: bool = False

    def load(self) -> None:
        if self._loaded:
            return

        labels_df = pd.read_csv(os.path.join(DATA_DIR, "labeled_anomalies.csv"))
        msl_labels = labels_df[labels_df["spacecraft"] == "MSL"]

        for _, row in msl_labels.iterrows():
            chan = row["chan_id"]
            if chan in MSL_CHANNELS:
                seqs = ast.literal_eval(row["anomaly_sequences"])
                self.anomaly_labels[chan] = seqs

        for chan_id, meta in MSL_CHANNELS.items():
            test_path = os.path.join(DATA_DIR, "test", f"{chan_id}.npy")
            if not os.path.exists(test_path):
                continue

            test_data = np.load(test_path)
            self.channels[chan_id] = {
                "data": test_data,
                "meta": meta,
                "length": test_data.shape[0],
            }
            self.cursors[chan_id] = 0

            se_path = os.path.join(MODEL_DIR, "smoothed_errors", f"{chan_id}.npy")
            if os.path.exists(se_path):
                self.smoothed_errors[chan_id] = np.load(se_path)

            yh_path = os.path.join(MODEL_DIR, "y_hat", f"{chan_id}.npy")
            if os.path.exists(yh_path):
                self.y_hat[chan_id] = np.load(yh_path)

        self._loaded = True

    def _is_anomaly_at(self, chan_id: str, idx: int) -> bool:
        seqs = self.anomaly_labels.get(chan_id, [])
        for start, end in seqs:
            if start <= idx <= end:
                return True
        return False

    def _get_smoothed_error(self, chan_id: str, idx: int) -> Optional[float]:
        se = self.smoothed_errors.get(chan_id)
        if se is not None and idx < len(se):
            return float(se[idx])
        return None

    def _get_prediction(self, chan_id: str, idx: int) -> Optional[float]:
        yh = self.y_hat.get(chan_id)
        if yh is not None and idx < len(yh):
            return float(yh[idx])
        return None

    def _advance_rover(self) -> None:
        self.lat += np.random.uniform(-0.0003, 0.0003)
        self.lon += np.random.uniform(-0.0003, 0.0003)
        self.tick_count += 1
        if self.tick_count % 50 == 0:
            self.sol += 1

    def generate_readings(self) -> List[dict]:
        self.load()
        self._advance_rover()

        readings = []
        for chan_id, chan in self.channels.items():
            idx = self.cursors[chan_id]
            data = chan["data"]

            if idx >= chan["length"]:
                self.cursors[chan_id] = 0
                idx = 0

            raw_value = float(data[idx, 0])
            is_labeled_anomaly = self._is_anomaly_at(chan_id, idx)
            smoothed_err = self._get_smoothed_error(chan_id, idx)
            prediction = self._get_prediction(chan_id, idx)

            self.cursors[chan_id] = idx + 1

            readings.append({
                "id": uuid.uuid4(),
                "sensor_type": chan["meta"]["sensor_type"],
                "raw_value": round(raw_value, 6),
                "unit": chan["meta"]["unit"],
                "location_lat": round(self.lat, 6),
                "location_lon": round(self.lon, 6),
                "sol": self.sol,
                "created_at": datetime.now(timezone.utc),
                "_chan_id": chan_id,
                "_chan_label": chan["meta"]["label"],
                "_idx": idx,
                "_is_labeled_anomaly": is_labeled_anomaly,
                "_smoothed_error": smoothed_err,
                "_prediction": prediction,
            })

        return readings


_loader = NASADataLoader()


def generate_sensor_readings() -> List[dict]:
    return _loader.generate_readings()


def get_rover_state() -> dict:
    # Dünya–Mars ışık süresi tek yön tipik ~3–22 dk (konjunksiyon–opozisyon); yavaş salınım ile gösterim
    t = _loader.tick_count * 0.07
    light_one_way = 12.5 + 9.0 * math.sin(t)
    light_one_way = max(3.5, min(21.5, light_one_way))
    return {
        "lat": round(_loader.lat, 6),
        "lon": round(_loader.lon, 6),
        "sol": _loader.sol,
        "tick_count": _loader.tick_count,
        "light_delay_min_one_way": round(light_one_way, 1),
        "light_delay_min_round_trip": round(light_one_way * 2, 1),
    }


def get_dataset_info() -> dict:
    _loader.load()
    return {
        "channels": list(_loader.channels.keys()),
        "channel_count": len(_loader.channels),
        "total_anomaly_sequences": sum(len(v) for v in _loader.anomaly_labels.values()),
        "has_lstm_models": os.path.exists(os.path.join(MODEL_DIR, "models")),
        "has_smoothed_errors": len(_loader.smoothed_errors) > 0,
        "has_predictions": len(_loader.y_hat) > 0,
        "spacecraft": "MSL (Mars Science Laboratory — Curiosity)",
        "source": "NASA SMAP/MSL Anomaly Detection Dataset",
    }
