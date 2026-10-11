"""Offline reference adapter for CI and harness sanity checks.

Reconstructs a slightly corrupted version of the ground truth so the
pipeline produces non-trivial CER/WER without any model, API key, or
network access. Corruption is deterministic given ``seed``.
"""

from __future__ import annotations

import random
import time
from typing import Any, Dict

from .base import BaseTranscriber, TranscriptionOutput


class DummyEchoTranscriber(BaseTranscriber):
    def __init__(self, corruption: float = 0.05, seed: int = 0):
        self.corruption = max(0.0, min(1.0, corruption))
        self.seed = seed

    def name(self) -> str:
        return "dummy_echo"

    def transcribe(self, image_path: str, metadata: Dict[str, Any]) -> TranscriptionOutput:
        t0 = time.time()
        gt = metadata.get("ground_truth", "")
        rng = random.Random(f"{self.seed}:{metadata.get('id', '')}")
        chars = []
        for ch in gt:
            if self.corruption and rng.random() < self.corruption:
                continue  # simulate a deletion error
            chars.append(ch)
        return TranscriptionOutput(text="".join(chars), latency_sec=time.time() - t0)
