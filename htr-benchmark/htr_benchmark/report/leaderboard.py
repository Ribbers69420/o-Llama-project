"""Cross-run, per-language leaderboard aggregation.

Scans a runs directory for ``aggregate.json`` files and emits a single
markdown leaderboard: an overall ranking plus one ranked table per
language, sorted by mean CER (lower is better) with bootstrap CIs.
"""

from __future__ import annotations

import glob
import json
import os
from collections import defaultdict
from typing import Dict, List


def _load_aggregates(runs_dir: str) -> List[dict]:
    reports = []
    for path in sorted(glob.glob(os.path.join(runs_dir, "**", "aggregate.json"), recursive=True)):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            data["_run_dir"] = os.path.dirname(path)
            reports.append(data)
        except (json.JSONDecodeError, OSError):
            continue
    return reports


def _ci_cell(ci: dict) -> str:
    return (
        f"{ci['point'] * 100:.2f}% "
        f"[{ci['low'] * 100:.2f}, {ci['high'] * 100:.2f}]"
    )


def _table(rows: List[dict]) -> List[str]:
    """rows: list of {model, n, cer_ci, wer_ci, halluc} sorted by CER point."""
    lines = [
        "| Rank | Model | N | CER (CI) | WER (CI) | Halluc. risk |",
        "|---:|---|---:|---|---|---:|",
    ]
    for i, r in enumerate(rows, 1):
        lines.append(
            f"| {i} | {r['model']} | {r['n']} | {_ci_cell(r['cer_ci'])} | "
            f"{_ci_cell(r['wer_ci'])} | {r['halluc']:.3f} |"
        )
    return lines


def build_leaderboard(runs_dir: str, title: str = "HTR Benchmark Leaderboard") -> str:
    reports = _load_aggregates(runs_dir)
    lines: List[str] = [f"# {title}", ""]
    if not reports:
        lines.append(f"_No runs found under `{runs_dir}`._")
        return "\n".join(lines) + "\n"

    lines.append(f"Aggregated from **{len(reports)}** run(s) in `{runs_dir}`.")
    lines.append("Ranked by mean CER (lower is better); intervals are 95% bootstrap CIs.")
    lines.append("")

    # Overall ranking
    overall_rows = []
    for rep in reports:
        ov = rep.get("overall", {})
        overall_rows.append(
            {
                "model": rep.get("model", "?"),
                "n": ov.get("n", 0),
                "cer_ci": ov.get("cer_ci", {"point": 1, "low": 1, "high": 1}),
                "wer_ci": ov.get("wer_ci", {"point": 1, "low": 1, "high": 1}),
                "halluc": ov.get("hallucination_risk_rate", 0.0),
            }
        )
    overall_rows.sort(key=lambda r: r["cer_ci"]["point"])
    lines.append("## Overall")
    lines.append("")
    lines.extend(_table(overall_rows))
    lines.append("")

    # Per-language rankings
    by_lang: Dict[str, List[dict]] = defaultdict(list)
    for rep in reports:
        model = rep.get("model", "?")
        for stratum in rep.get("by_language", []):
            by_lang[stratum["key"]].append(
                {
                    "model": model,
                    "n": stratum.get("n", 0),
                    "cer_ci": stratum.get("cer_ci", {"point": 1, "low": 1, "high": 1}),
                    "wer_ci": stratum.get("wer_ci", {"point": 1, "low": 1, "high": 1}),
                    "halluc": stratum.get("hallucination_risk_rate", 0.0),
                }
            )

    if by_lang:
        lines.append("## Per-language")
        lines.append("")
        for lang in sorted(by_lang):
            rows = sorted(by_lang[lang], key=lambda r: r["cer_ci"]["point"])
            lines.append(f"### {lang}")
            lines.append("")
            lines.extend(_table(rows))
            lines.append("")

    return "\n".join(lines) + "\n"


def write_leaderboard(runs_dir: str, out_path: str, title: str = "HTR Benchmark Leaderboard") -> str:
    md = build_leaderboard(runs_dir, title=title)
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(md)
    return out_path
