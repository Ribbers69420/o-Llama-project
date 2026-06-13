"""Run configuration loaded from JSON for reproducible, versioned runs."""

from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass, field
from typing import Any, Dict

from .normalize import NormalizationPolicy


@dataclass
class BootstrapConfig:
    iterations: int = 1000
    confidence: float = 0.95
    seed: int = 42


@dataclass
class RunConfig:
    name: str
    dataset_tsv: str
    out_dir: str
    adapter_type: str
    adapter_params: Dict[str, Any] = field(default_factory=dict)
    normalization: NormalizationPolicy = field(default_factory=NormalizationPolicy)
    bootstrap: BootstrapConfig = field(default_factory=BootstrapConfig)
    max_samples: int = 0

    def fingerprint(self) -> str:
        payload = json.dumps(self.to_serializable(), sort_keys=True).encode("utf-8")
        return hashlib.sha256(payload).hexdigest()[:16]

    def to_serializable(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "dataset_tsv": self.dataset_tsv,
            "out_dir": self.out_dir,
            "adapter": {"type": self.adapter_type, "params": self.adapter_params},
            "normalization": {
                "keep_case": self.normalization.keep_case,
                "normalize_ws": self.normalization.normalize_ws,
                "unicode_form": self.normalization.unicode_form,
            },
            "bootstrap": {
                "iterations": self.bootstrap.iterations,
                "confidence": self.bootstrap.confidence,
                "seed": self.bootstrap.seed,
            },
            "max_samples": self.max_samples,
        }


def load_config(path: str) -> RunConfig:
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)
    return from_dict(raw, base_dir=os.path.dirname(os.path.abspath(path)))


def from_dict(raw: Dict[str, Any], base_dir: str = "") -> RunConfig:
    adapter = raw.get("adapter", {})
    norm = raw.get("normalization", {})
    boot = raw.get("bootstrap", {})

    def resolve(p: str) -> str:
        if p and base_dir and not os.path.isabs(p):
            return os.path.normpath(os.path.join(base_dir, p))
        return p

    return RunConfig(
        name=raw.get("name", "run"),
        dataset_tsv=resolve(raw["dataset_tsv"]),
        out_dir=resolve(raw.get("out_dir", "runs/run")),
        adapter_type=adapter.get("type", "dummy"),
        adapter_params=adapter.get("params", {}),
        normalization=NormalizationPolicy(
            keep_case=norm.get("keep_case", True),
            normalize_ws=norm.get("normalize_ws", True),
            unicode_form=norm.get("unicode_form", "NFC"),
        ),
        bootstrap=BootstrapConfig(
            iterations=boot.get("iterations", 1000),
            confidence=boot.get("confidence", 0.95),
            seed=boot.get("seed", 42),
        ),
        max_samples=raw.get("max_samples", 0),
    )
