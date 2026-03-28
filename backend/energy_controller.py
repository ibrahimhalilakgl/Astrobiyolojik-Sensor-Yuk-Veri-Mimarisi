"""Simüle batarya ve CPU yüküne göre anomali eşiği ve zlib seviyesi."""

from __future__ import annotations

import random
from typing import Any, Dict, Tuple


class EnergyController:
    def __init__(self) -> None:
        self._battery_level = 75.0
        self._cpu_load = 15.0
        self._packets_last_tick = 0

    def tick_battery(self) -> None:
        delta = random.uniform(-2.0, 2.0)
        self._battery_level = float(max(0.0, min(100.0, self._battery_level + delta)))

    def record_processing_load(self, batch_size: int) -> None:
        self._packets_last_tick = batch_size
        base = min(100.0, batch_size * 6.0)
        noise = random.uniform(-5.0, 8.0)
        self._cpu_load = float(max(0.0, min(100.0, base + noise)))

    def get_threshold_and_zlib(self) -> Tuple[int, int]:
        b = self._battery_level
        if b < 20:
            return 70, 9
        if b <= 50:
            return 60, 7
        return 50, 6

    def get_battery_level(self) -> float:
        return float(self._battery_level)

    def get_energy_stats(self) -> Dict[str, Any]:
        th, zl = self.get_threshold_and_zlib()
        return {
            "batarya_level": round(self._battery_level, 2),
            "cpu_load": round(self._cpu_load, 2),
            "aktif_esik": th,
            "zlib_level": zl,
        }
