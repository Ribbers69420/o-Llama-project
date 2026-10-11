"""Persist per-run artifacts: sample CSV, aggregate JSON, markdown report."""

from __future__ import annotations

import csv
import json
import os
from typing import List

from ..results import RunReport, SampleResult, StratumAggregate


def _ci(d: dict, pct: bool = True) -> str:
    scale = 100.0 if pct else 1.0
    unit = "%" if pct else ""
    return f"{d['point'] * scale:.2f}{unit} [{d['low'] * scale:.2f}, {d['high'] * scale:.2f}]"


def _stratum_row(s: StratumAggregate) -> str:
    return (
        f"| {s.key} | {s.n} | {_ci(s.cer_ci)} | {_ci(s.wer_ci)} | "
        f"{s.cer_median * 100:.2f}% | {s.hallucination_risk_rate:.3f} | "
        f"{s.format_violation_rate:.3f} | {s.latency_mean:.3f} |"
    )


def render_markdown(report: RunReport) -> str:
    cfg = report.config
    lines: List[str] = []
    lines.append(f"# Benchmark Report — {report.model}")
    lines.append("")
    lines.append(f"- Config: `{cfg.get('name', 'run')}`")
    lines.append(f"- Config fingerprint: `{cfg.get('config_fingerprint', '?')}`")
    lines.append(f"- Dataset: `{cfg.get('dataset_path', '?')}` "
                 f"(fingerprint `{cfg.get('dataset_fingerprint', '?')}`)")
    boot = cfg.get("bootstrap", {})
    lines.append(
        f"- Bootstrap CI: {int(boot.get('confidence', 0.95) * 100)}% over "
        f"{boot.get('iterations', 0)} resamples (seed {boot.get('seed', 0)})"
    )
    lines.append("")
    header = (
        "| Stratum | N | CER (CI) | WER (CI) | CER median | "
        "Halluc. risk | Format viol. | Latency (s) |"
    )
    sep = "|---|---:|---|---|---:|---:|---:|---:|"
    lines.append("## Overall")
    lines.append("")
    lines.append(header)
    lines.append(sep)
    lines.append(_stratum_row(report.overall))
    lines.append("")
    if report.by_language:
        lines.append("## Per-language")
        lines.append("")
        lines.append(header)
        lines.append(sep)
        for s in report.by_language:
            lines.append(_stratum_row(s))
        lines.append("")
    lines.append("## Notes")
    lines.append("- CER/WER computed on normalized text per the run config.")
    lines.append("- Confidence intervals are nonparametric percentile bootstraps "
                 "over per-sample scores.")
    lines.append("- Hallucination risk is a heuristic proxy; replace with a trained "
                 "verifier for production gating.")
    lines.append("")
    return "\n".join(lines)


def write_run_outputs(report: RunReport, results: List[SampleResult], out_dir: str):
    os.makedirs(out_dir, exist_ok=True)

    samples_csv = os.path.join(out_dir, "sample_results.csv")
    aggregate_json = os.path.join(out_dir, "aggregate.json")
    report_md = os.path.join(out_dir, "report.md")

    if results:
        fieldnames = list(results[0].as_dict().keys())
        with open(samples_csv, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for r in results:
                writer.writerow(r.as_dict())

    with open(aggregate_json, "w", encoding="utf-8") as f:
        json.dump(report.as_dict(), f, ensure_ascii=False, indent=2)

    with open(report_md, "w", encoding="utf-8") as f:
        f.write(render_markdown(report))

    return {
        "sample_results": samples_csv,
        "aggregate": aggregate_json,
        "report": report_md,
    }
