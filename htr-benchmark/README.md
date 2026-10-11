# Historical HTR/OCR Benchmark Harness

A modular, reproducible framework for evaluating handwritten-text-recognition
models on historical documents — multimodal LLMs (Gemini), TrOCR, and
extensions — with **hallucination-aware reliability metrics**, **bootstrap
confidence intervals**, and **per-language leaderboards**.

The core harness has **zero required third-party dependencies** (Python
standard library only). Model backends are optional extras, and the default
`dummy` adapter lets the whole pipeline run offline for CI and sanity checks.

## Why this design

Average CER alone is misleading for historical HTR: generative mLLMs fail
*bimodally* (near-perfect or wholesale hallucination), so the error
distribution is heavy-tailed. This harness therefore reports:

- **CER / WER** with **nonparametric bootstrap confidence intervals**, not just
  point means;
- **per-language stratification** (English vs. French vs. German behave very
  differently for zero-shot mLLMs);
- **reliability signals** — hallucination-risk rate, format-violation rate,
  uncertainty-token rate — to surface the outliers a single mean hides.

## Quick start

```bash
cd htr-benchmark

# One command: offline reproducible run + leaderboard (no API key needed)
make benchmark

# See available model adapters
make adapters

# Run the test suite
pip install pytest && make test
```

`make benchmark` runs the `dummy` adapter against `data/sample.tsv` and writes:

```
runs/baseline_dummy/sample_results.csv   # per-sample scores + risk signals
runs/baseline_dummy/aggregate.json       # overall + per-language aggregates
runs/baseline_dummy/report.md            # human-readable run report
runs/LEADERBOARD.md                      # cross-run, per-language ranking
```

## Package layout

```
htr-benchmark/
  Makefile                  # one-command workflows (benchmark, leaderboard, test)
  pyproject.toml            # installable package + optional extras
  configs/                  # versioned JSON run configs (dummy / gemini / trocr)
  data/
    sample.tsv              # dataset manifest (TSV)
    images/                 # manuscript images referenced by the manifest
  htr_benchmark/
    cli.py                  # `run`, `leaderboard`, `adapters` subcommands
    config.py               # JSON run config + reproducibility fingerprints
    dataset.py              # TSV manifest loader + dataset hashing
    normalize.py            # diplomatic-transcription normalization policy
    results.py              # SampleResult / StratumAggregate / RunReport
    runner.py               # scoring + per-language aggregation
    metrics/
      edit_distance.py      # Levenshtein (rolling-row)
      scoring.py            # CER / WER
      bootstrap.py          # percentile bootstrap confidence intervals
      risk.py               # hallucination / format / uncertainty heuristics
    adapters/
      base.py               # BaseTranscriber contract
      dummy.py              # offline reference adapter (deterministic)
      gemini.py             # Google Gemini (lazy, optional deps)
      trocr.py              # TrOCR HuggingFace stub (graceful degradation)
    report/
      writer.py             # per-run CSV / JSON / markdown
      leaderboard.py        # cross-run, per-language markdown leaderboard
  tests/                    # unit + end-to-end tests (stdlib-only paths)
```

## Dataset contract

A tab-separated manifest plus an image folder. Required columns: `id`,
`image_path`, `ground_truth`. Optional: `language`, `century`, `domain`,
`script`, `source_corpus`, `split`. `image_path` is resolved relative to the
manifest's directory.

```
id            image_path              language  century  domain  ground_truth
bentham_0001  images/bentham_0001.jpg english   18       letter  It is to be observed...
icdar_de_0071 images/icdar_de_0071.jpg german   16       ledger  Im Namen des Herrn...
```

## Running real models

### Gemini

```bash
pip install -e ".[gemini]"
export GEMINI_API_KEY="your-key"
make benchmark-gemini
```

Decoding is pinned to low temperature (0.1) to keep the generative decoder
grounded in the image rather than producing fluent-but-fabricated text.

### TrOCR

```bash
pip install -e ".[trocr]"
make benchmark-trocr
```

The TrOCR adapter is a working stub. TrOCR is a **line-level** recognizer, so
full-page manuscripts need line segmentation upstream. The integration point is
explicit in `adapters/trocr.py::_segment_lines` (currently a whole-page no-op);
plug in Kraken / docTR / an OpenCV projection-profile segmenter there. When
`transformers`/`torch` are absent the adapter degrades gracefully — it records a
per-sample error instead of crashing the sweep.

## Adding a new adapter

1. Subclass `BaseTranscriber` in `htr_benchmark/adapters/`, implementing
   `name()` and `transcribe(image_path, metadata) -> TranscriptionOutput`.
   Never raise on inference failure — return `TranscriptionOutput(text="",
   error=...)` so the sweep continues.
2. Register it in `adapters/__init__.py::_REGISTRY`.
3. Add a `configs/baseline_<name>.json` and (optionally) a Makefile target.

## Reproducibility

Every run logs a `config_fingerprint` and `dataset_fingerprint` (content
hashes) into `aggregate.json`, alongside the full normalization policy,
bootstrap settings, and adapter parameters. Re-running the same config against
the same dataset is deterministic for the offline adapter and for the bootstrap
intervals (fixed seed).

## Roadmap

- Paired significance tests between models (bootstrap on score *differences*)
- Corpus/script stratification in addition to language
- Verifier-gated routing (mLLM ↔ TrOCR ↔ hybrid post-correction)
- Human-correction-time and cost/quality-frontier metrics
