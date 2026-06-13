"""Model adapters and a registry to build them by name."""

from typing import Any, Dict

from .base import BaseTranscriber, TranscriptionOutput
from .dummy import DummyEchoTranscriber
from .gemini import GeminiTranscriber
from .trocr import TrOCRTranscriber

_REGISTRY = {
    "dummy": DummyEchoTranscriber,
    "gemini": GeminiTranscriber,
    "trocr": TrOCRTranscriber,
}


def available_adapters():
    return sorted(_REGISTRY)


def build_adapter(adapter_type: str, params: Dict[str, Any] | None = None) -> BaseTranscriber:
    if adapter_type not in _REGISTRY:
        raise ValueError(
            f"Unknown adapter '{adapter_type}'. Available: {available_adapters()}"
        )
    return _REGISTRY[adapter_type](**(params or {}))


__all__ = [
    "BaseTranscriber",
    "TranscriptionOutput",
    "DummyEchoTranscriber",
    "GeminiTranscriber",
    "TrOCRTranscriber",
    "build_adapter",
    "available_adapters",
]
