"""Command-line interface.

Subcommands:
  run          Execute a benchmark from a JSON config (or CLI flags).
  leaderboard  Aggregate runs/*/aggregate.json into a markdown leaderboard.
  adapters     List registered model adapters.
"""

from __future__ import annotations

import argparse
import sys

from . import __version__
from .adapters import available_adapters, build_adapter
from .config import from_dict, load_config
from .report import write_leaderboard, write_run_outputs
from .runner import run_benchmark


def _cmd_run(args: argparse.Namespace) -> int:
    if args.config:
        config = load_config(args.config)
    else:
        if not args.dataset_tsv:
            print("error: --config or --dataset-tsv is required", file=sys.stderr)
            return 2
        config = from_dict(
            {
                "name": args.name,
                "dataset_tsv": args.dataset_tsv,
                "out_dir": args.out_dir,
                "adapter": {"type": args.adapter, "params": {}},
                "normalization": {
                    "keep_case": not args.lowercase,
                    "normalize_ws": not args.no_normalize_ws,
                },
                "bootstrap": {
                    "iterations": args.bootstrap_iters,
                    "confidence": args.confidence,
                    "seed": args.seed,
                },
                "max_samples": args.max_samples,
            }
        )

    print(f"Running '{config.name}' with adapter '{config.adapter_type}' ...")
    adapter = build_adapter(config.adapter_type, config.adapter_params)
    report, results = run_benchmark(config, adapter=adapter)
    paths = write_run_outputs(report, results, config.out_dir)

    ov = report.overall
    print(
        f"\nOverall CER {ov.cer_ci['point'] * 100:.2f}% "
        f"[{ov.cer_ci['low'] * 100:.2f}, {ov.cer_ci['high'] * 100:.2f}]  |  "
        f"WER {ov.wer_ci['point'] * 100:.2f}%  |  "
        f"halluc-risk {ov.hallucination_risk_rate:.3f}  (N={ov.n})"
    )
    for key, path in paths.items():
        print(f"  {key}: {path}")
    return 0


def _cmd_leaderboard(args: argparse.Namespace) -> int:
    out = write_leaderboard(args.runs_dir, args.out, title=args.title)
    print(f"Leaderboard written: {out}")
    return 0


def _cmd_adapters(_args: argparse.Namespace) -> int:
    print("Available adapters:")
    for a in available_adapters():
        print(f"  - {a}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="htr-benchmark", description=__doc__)
    p.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    sub = p.add_subparsers(dest="command", required=True)

    r = sub.add_parser("run", help="Run a benchmark")
    r.add_argument("--config", help="Path to JSON run config")
    r.add_argument("--name", default="run")
    r.add_argument("--dataset-tsv", dest="dataset_tsv")
    r.add_argument("--out-dir", dest="out_dir", default="runs/run")
    r.add_argument("--adapter", default="dummy", choices=available_adapters())
    r.add_argument("--max-samples", dest="max_samples", type=int, default=0)
    r.add_argument("--lowercase", action="store_true", help="Fold case before scoring")
    r.add_argument("--no-normalize-ws", dest="no_normalize_ws", action="store_true")
    r.add_argument("--bootstrap-iters", dest="bootstrap_iters", type=int, default=1000)
    r.add_argument("--confidence", type=float, default=0.95)
    r.add_argument("--seed", type=int, default=42)
    r.set_defaults(func=_cmd_run)

    lb = sub.add_parser("leaderboard", help="Build a per-language leaderboard")
    lb.add_argument("--runs-dir", dest="runs_dir", default="runs")
    lb.add_argument("--out", default="runs/LEADERBOARD.md")
    lb.add_argument("--title", default="HTR Benchmark Leaderboard")
    lb.set_defaults(func=_cmd_leaderboard)

    ad = sub.add_parser("adapters", help="List registered adapters")
    ad.set_defaults(func=_cmd_adapters)

    return p


def main(argv=None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
