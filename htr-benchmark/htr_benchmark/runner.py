"""Benchmark runner: scores a dataset with one adapter and aggregates.

Aggregation produces an overall stratum plus per-language strata, each
with bootstrap confidence intervals on CER/WER (heavy-tailed HTR error
distributions make the point mean alone misleading).
"""

from __future__ import annotations

import os
from collections import defaultdict
from statistics import mean, median
from typing import Dict, List

from .adapters import build_adapter
from .adapters.base import BaseTranscriber
from .config import RunConfig
from .dataset import Dataset, load_dataset
from .metrics import bootstrap_ci, cer, compute_risk, wer
from .normalize import normalize_text
from .results import RunReport, SampleResult, StratumAggregate


def score_sample(
    sample, adapter: BaseTranscriber, config: RunConfig
) -> SampleResult:
    out = adapter.transcribe(sample.image_path, sample.metadata)
    pred = normalize_text(out.text, config.normalization)
    gt = normalize_text(sample.ground_truth, config.normalization)
    risk = compute_risk(pred, gt_len=len(gt))
    return SampleResult(
        id=sample.id,
        model=adapter.name(),
        language=sample.language,
        century=sample.century,
        image_path=sample.image_path,
        cer=cer(pred, gt),
        wer=wer(pred, gt),
        latency_sec=out.latency_sec,
        format_violations=risk.format_violations,
        uncertainty_rate=risk.uncertainty_rate,
        lexical_anomaly=risk.lexical_anomaly,
        length_ratio=risk.length_ratio,
        hallucination_risk=int(risk.hallucination_risk),
        pred_text=pred,
        gt_text=gt,
        error=out.error,
    )


def _aggregate(key: str, rows: List[SampleResult], config: RunConfig) -> StratumAggregate:
    n = len(rows)
    boot = config.bootstrap
    cer_ci = bootstrap_ci([r.cer for r in rows], boot.iterations, boot.confidence, boot.seed)
    wer_ci = bootstrap_ci([r.wer for r in rows], boot.iterations, boot.confidence, boot.seed)
    return StratumAggregate(
        key=key,
        n=n,
        cer_ci=cer_ci.as_dict(),
        wer_ci=wer_ci.as_dict(),
        cer_median=median([r.cer for r in rows]) if n else 0.0,
        wer_median=median([r.wer for r in rows]) if n else 0.0,
        latency_mean=mean([r.latency_sec for r in rows]) if n else 0.0,
        hallucination_risk_rate=sum(r.hallucination_risk for r in rows) / n if n else 0.0,
        format_violation_rate=sum(1 for r in rows if r.format_violations > 0) / n if n else 0.0,
        uncertainty_token_rate=mean([r.uncertainty_rate for r in rows]) if n else 0.0,
        error_rate=sum(1 for r in rows if r.error) / n if n else 0.0,
    )


def run_benchmark(config: RunConfig, adapter: BaseTranscriber | None = None):
    """Execute a run, returning ``(RunReport, List[SampleResult])``."""
    adapter = adapter or build_adapter(config.adapter_type, config.adapter_params)
    dataset: Dataset = load_dataset(config.dataset_tsv, limit=config.max_samples)

    results: List[SampleResult] = []
    for i, sample in enumerate(dataset, 1):
        results.append(score_sample(sample, adapter, config))
        if i % 10 == 0 or i == len(dataset):
            print(f"  [{i}/{len(dataset)}] {adapter.name()}")

    by_lang: Dict[str, List[SampleResult]] = defaultdict(list)
    for r in results:
        by_lang[r.language].append(r)

    report = RunReport(
        model=adapter.name(),
        overall=_aggregate("overall", results, config),
        by_language=[
            _aggregate(lang, rows, config) for lang, rows in sorted(by_lang.items())
        ],
        config={
            **config.to_serializable(),
            "config_fingerprint": config.fingerprint(),
            "dataset_fingerprint": dataset.fingerprint(),
            "dataset_path": dataset.path,
        },
    )
    return report, results
