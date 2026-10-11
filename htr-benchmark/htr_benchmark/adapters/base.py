"""Adapter contract shared by every transcription backend."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict


@dataclass
class TranscriptionOutput:
    text: str
    latency_sec: float = 0.0
    error: str = ""
    raw: Dict[str, Any] = field(default_factory=dict)


class BaseTranscriber:
    """Implement :meth:`transcribe` to add a new backend.

    Adapters must never raise on inference failure: return a
    :class:`TranscriptionOutput` with ``error`` populated and ``text=""``
    so the runner can record the failure and continue the sweep.
    """

    def name(self) -> str:  # pragma: no cover - trivial
        raise NotImplementedError

    def transcribe(self, image_path: str, metadata: Dict[str, Any]) -> TranscriptionOutput:
        raise NotImplementedError
