# Historical HTR/OCR benchmark — one-command reproducible workflows.
#
# Usage:
#   make benchmark        # offline dummy run + leaderboard (no API key needed)
#   make benchmark-gemini # requires GEMINI_API_KEY
#   make benchmark-trocr  # requires transformers + torch
#   make benchmark-all    # every configured baseline, then leaderboard
#   make test             # unit tests
#   make clean            # remove generated runs/

PYTHON       ?= python3
PKG          := htr_benchmark
CONFIG_DIR   := configs
RUNS_DIR     := runs
LEADERBOARD  := $(RUNS_DIR)/LEADERBOARD.md

.DEFAULT_GOAL := benchmark
.PHONY: help benchmark benchmark-gemini benchmark-trocr benchmark-all \
        leaderboard adapters test lint clean install install-extras

help:
	@grep -E '^[a-zA-Z_-]+:.*?#' $(MAKEFILE_LIST) | \
	  awk 'BEGIN{FS=":.*?#"}{printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

install: # Install runtime dependencies (none required for the dummy adapter)
	$(PYTHON) -m pip install -e .

install-extras: # Install optional model backends (gemini, trocr)
	$(PYTHON) -m pip install -e ".[gemini,trocr]"

benchmark: # Offline reproducible run (dummy adapter) + leaderboard
	$(PYTHON) -m $(PKG).cli run --config $(CONFIG_DIR)/baseline_dummy.json
	$(MAKE) leaderboard

benchmark-gemini: # Gemini baseline (needs GEMINI_API_KEY)
	$(PYTHON) -m $(PKG).cli run --config $(CONFIG_DIR)/baseline_gemini.json
	$(MAKE) leaderboard

benchmark-trocr: # TrOCR baseline (needs transformers + torch)
	$(PYTHON) -m $(PKG).cli run --config $(CONFIG_DIR)/baseline_trocr.json
	$(MAKE) leaderboard

benchmark-all: # Run every configured baseline, then rebuild the leaderboard
	@for cfg in $(CONFIG_DIR)/*.json; do \
	  echo "=== $$cfg ==="; \
	  $(PYTHON) -m $(PKG).cli run --config $$cfg || true; \
	done
	$(MAKE) leaderboard

leaderboard: # Aggregate runs/ into a per-language leaderboard
	$(PYTHON) -m $(PKG).cli leaderboard --runs-dir $(RUNS_DIR) --out $(LEADERBOARD)

adapters: # List registered model adapters
	$(PYTHON) -m $(PKG).cli adapters

test: # Run unit tests
	$(PYTHON) -m pytest -q tests

clean: # Remove generated run artifacts
	rm -rf $(RUNS_DIR)
