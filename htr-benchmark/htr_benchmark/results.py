"""Result records for per-sample scores and corpus-level aggregates."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Dict, List


@dataclass
class SampleResult:
    id: str
    model: str
    language: str
    century: str
    image_path: str
    cer: float
    wer: float
    latency_sec: float
    format_violations: int
    uncertainty_rate: float
    lexical_anomaly: float
    length_ratio: float
    hallucination_risk: int
    pred_text: str
    gt_text: str
    error: str = ""

    def as_dict(self) -> Dict:
        return asdict(self)


@dataclass
class StratumAggregate:
    """Aggregate metrics for one stratum (a language, corpus, or 'overall')."""

    key: str
    n: int
    cer_ci: Dict
    wer_ci: Dict
    cer_median: float
    wer_median: float
    latency_mean: float
    hallucination_risk_rate: float
    format_violation_rate: float
    uncertainty_token_rate: float
    error_rate: float

    def as_dict(self) -> Dict:
        return asdict(self)


@dataclass
class RunReport:
    model: str
    overall: StratumAggregate
    by_language: List[StratumAggregate] = field(default_factory=list)
    config: Dict = field(default_factory=dict)

    def as_dict(self) -> Dict:
        return {
            "model": self.model,
            "overall": self.overall.as_dict(),
            "by_language": [s.as_dict() for s in self.by_language],
            "config": self.config,
        }
