"""Online anomaly scoring with River HalfSpaceTrees (.h5 kullanılmaz)."""

from __future__ import annotations

import pickle
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

from river import anomaly

_DATA_DIR = Path(__file__).resolve().parent / "data"
_STATE_PATH = _DATA_DIR / "river_model_state.pkl"
_SAVE_EVERY = 500


class RiverLearner:
    def __init__(self) -> None:
        self._model: anomaly.HalfSpaceTrees = anomaly.HalfSpaceTrees(
            n_trees=25,
            height=6,
            window_size=500,
            seed=42,
        )
        self._n_samples_seen = 0
        self._model_version = 1
        self._last_saved: datetime | None = None
        self._load_if_exists()

    def _feat(self, channel_id: str, raw_value: float) -> Dict[str, float]:
        ch = (hash(channel_id) % 1000) / 1000.0
        return {"v": float(raw_value), "c": float(ch)}

    def _load_if_exists(self) -> None:
        if not _STATE_PATH.is_file():
            return
        try:
            with open(_STATE_PATH, "rb") as f:
                data = pickle.load(f)
            if isinstance(data, dict):
                self._model = data.get("model", self._model)
                self._n_samples_seen = int(data.get("n_samples_seen", 0))
                self._model_version = int(data.get("model_version", 1))
                ts = data.get("last_saved")
                if ts:
                    self._last_saved = datetime.fromisoformat(ts)
        except Exception:
            pass

    def _save(self) -> None:
        _DATA_DIR.mkdir(parents=True, exist_ok=True)
        self._model_version += 1
        self._last_saved = datetime.now(timezone.utc)
        payload = {
            "model": self._model,
            "n_samples_seen": self._n_samples_seen,
            "model_version": self._model_version,
            "last_saved": self._last_saved.isoformat(),
        }
        with open(_STATE_PATH, "wb") as f:
            pickle.dump(payload, f)

    def score_and_learn(self, channel_id: str, raw_value: float) -> float:
        x = self._feat(channel_id, raw_value)
        score = float(self._model.score_one(x))
        self._model.learn_one(x)
        self._n_samples_seen += 1
        if self._n_samples_seen % _SAVE_EVERY == 0:
            try:
                self._save()
            except Exception:
                pass
        return min(100.0, max(0.0, score * 100.0))

    def get_model_stats(self) -> Dict[str, Any]:
        return {
            "n_samples_seen": self._n_samples_seen,
            "model_version": self._model_version,
            "last_saved": self._last_saved.isoformat() if self._last_saved else None,
        }

    def reset_model(self) -> None:
        self._model = anomaly.HalfSpaceTrees(
            n_trees=25,
            height=6,
            window_size=500,
            seed=42,
        )
        self._n_samples_seen = 0
        self._model_version = 1
        self._last_saved = None
        if _STATE_PATH.is_file():
            try:
                _STATE_PATH.unlink()
            except OSError:
                pass
