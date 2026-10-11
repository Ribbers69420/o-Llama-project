"""Bootstrap confidence intervals for corpus-level metrics.

Average CER/WER over a small test set carries real sampling
uncertainty, and historical-HTR error distributions are heavy-tailed
(a handful of hallucinated pages dominate the mean). A nonparametric
percentile bootstrap over per-sample scores gives an honest interval
without distributional assumptions.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from statistics import mean
from typing import Sequence


@dataclass(frozen=True)
class BootstrapCI:
    point: float       # point estimate (mean of the observed sample)
    low: float         # lower percentile bound
    high: float        # upper percentile bound
    confidence: float  # e.g. 0.95
    iterations: int

    def as_dict(self) -> dict:
        return {
            "point": self.point,
            "low": self.low,
            "high": self.high,
            "confidence": self.confidence,
            "iterations": self.iterations,
        }

    def pretty(self, pct: bool = False) -> str:
        scale = 100.0 if pct else 1.0
        unit = "%" if pct else ""
        return (
            f"{self.point * scale:.2f}{unit} "
            f"[{self.low * scale:.2f}, {self.high * scale:.2f}]"
        )


def bootstrap_ci(
    values: Sequence[float],
    iterations: int = 1000,
    confidence: float = 0.95,
    seed: int = 42,
) -> BootstrapCI:
    """Percentile bootstrap CI for the mean of ``values``."""
    vals = list(values)
    n = len(vals)
    if n == 0:
        return BootstrapCI(0.0, 0.0, 0.0, confidence, iterations)
    point = mean(vals)
    if n == 1 or iterations <= 0:
        return BootstrapCI(point, point, point, confidence, max(iterations, 0))

    rng = random.Random(seed)
    means = []
    for _ in range(iterations):
        resample = [vals[rng.randrange(n)] for _ in range(n)]
        means.append(mean(resample))
    means.sort()
    alpha = (1.0 - confidence) / 2.0
    low = means[max(0, int(alpha * iterations))]
    high = means[min(iterations - 1, int((1.0 - alpha) * iterations))]
    return BootstrapCI(point, low, high, confidence, iterations)
