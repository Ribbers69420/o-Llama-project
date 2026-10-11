import json
import os

from htr_benchmark.config import from_dict
from htr_benchmark.report import build_leaderboard, write_run_outputs
from htr_benchmark.runner import run_benchmark

HERE = os.path.dirname(os.path.abspath(__file__))
SAMPLE_TSV = os.path.join(HERE, "..", "data", "sample.tsv")


def _config(out_dir):
    return from_dict(
        {
            "name": "test_dummy",
            "dataset_tsv": SAMPLE_TSV,
            "out_dir": out_dir,
            "adapter": {"type": "dummy", "params": {"corruption": 0.1, "seed": 0}},
            "bootstrap": {"iterations": 200, "confidence": 0.95, "seed": 1},
        }
    )


def test_end_to_end_dummy_run(tmp_path):
    out_dir = str(tmp_path / "run")
    report, results = run_benchmark(_config(out_dir))

    assert len(results) == 8
    assert report.overall.n == 8
    # Per-language strata cover the three languages in the sample set.
    langs = {s.key for s in report.by_language}
    assert {"english", "french", "german"} <= langs
    # Corruption introduces deletions, so CER should be positive but small.
    assert 0.0 < report.overall.cer_ci["point"] < 0.5

    paths = write_run_outputs(report, results, out_dir)
    assert os.path.exists(paths["sample_results"])
    assert os.path.exists(paths["report"])
    with open(paths["aggregate"], encoding="utf-8") as f:
        data = json.load(f)
    assert data["model"] == "dummy_echo"
    assert "config_fingerprint" in data["config"]


def test_leaderboard_aggregates_runs(tmp_path):
    runs_dir = str(tmp_path / "runs")
    for name in ("a", "b"):
        out_dir = os.path.join(runs_dir, name)
        report, results = run_benchmark(_config(out_dir))
        write_run_outputs(report, results, out_dir)

    md = build_leaderboard(runs_dir)
    assert "# HTR Benchmark Leaderboard" in md
    assert "## Overall" in md
    assert "## Per-language" in md
    assert "english" in md and "german" in md
