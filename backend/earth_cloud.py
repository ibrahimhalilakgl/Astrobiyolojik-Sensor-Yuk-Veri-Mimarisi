"""Simüle Earth/Cloud: model_updates üretir, RL epsilon besler."""

from __future__ import annotations

import random
from typing import TYPE_CHECKING, Any, Dict, Optional

if TYPE_CHECKING:
    from rl_agent import RLAgent


class EarthCloudSimulator:
    def __init__(self) -> None:
        self._model_version_counter = 0
        self._federated_round = 0
        self._orbiter_batches_since_cloud = 0

    def on_orbiter_batch(self) -> None:
        self._orbiter_batches_since_cloud += 1

    def consume_if_ready(self, every_n: int = 20) -> bool:
        if self._orbiter_batches_since_cloud >= every_n:
            self._orbiter_batches_since_cloud = 0
            return True
        return False

    def build_update_payload(
        self,
        recent_anomaly_rate: float,
    ) -> Dict[str, Any]:
        self._model_version_counter += 1
        self._federated_round += 1
        low, high = 40.0, 70.0
        suggestion = low + (high - low) * (1.0 - min(1.0, recent_anomaly_rate))
        suggestion += random.uniform(-3.0, 3.0)
        suggestion = round(max(low, min(high, suggestion)), 2)
        return {
            "model_version": self._model_version_counter,
            "threshold_suggestion": suggestion,
            "federated_round": self._federated_round,
            "source": "earth_cloud",
        }

    def apply_to_rl(self, rl: "RLAgent", threshold_suggestion: float) -> None:
        rl.apply_earth_feedback(threshold_suggestion)
