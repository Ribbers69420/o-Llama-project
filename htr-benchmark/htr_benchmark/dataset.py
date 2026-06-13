"""Dataset contract: a TSV manifest plus an image folder.

Required columns: id, image_path, ground_truth.
Optional columns: language, century, domain, script, source_corpus, split.
Unknown columns are preserved and passed through to adapters as metadata.
"""

from __future__ import annotations

import csv
import hashlib
import os
from dataclasses import dataclass, field
from typing import Any, Dict, Iterator, List

REQUIRED_COLUMNS = ("id", "image_path", "ground_truth")


@dataclass
class Sample:
    id: str
    image_path: str
    ground_truth: str
    language: str = "unknown"
    century: str = "unknown"
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Dataset:
    path: str
    samples: List[Sample]

    def __iter__(self) -> Iterator[Sample]:
        return iter(self.samples)

    def __len__(self) -> int:
        return len(self.samples)

    def fingerprint(self) -> str:
        """Stable hash of the manifest file for reproducibility logging."""
        h = hashlib.sha256()
        with open(self.path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
        return h.hexdigest()[:16]


def load_dataset(tsv_path: str, base_dir: str | None = None, limit: int = 0) -> Dataset:
    if not os.path.exists(tsv_path):
        raise FileNotFoundError(f"Dataset manifest not found: {tsv_path}")
    base_dir = base_dir or os.path.dirname(os.path.abspath(tsv_path))

    samples: List[Sample] = []
    with open(tsv_path, "r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f, delimiter="\t")
        missing = [c for c in REQUIRED_COLUMNS if c not in (reader.fieldnames or [])]
        if missing:
            raise ValueError(
                f"Manifest {tsv_path} missing required columns: {missing}. "
                f"Found: {reader.fieldnames}"
            )
        for i, row in enumerate(reader, 1):
            sid = (row.get("id") or f"row_{i}").strip()
            img = (row.get("image_path") or "").strip()
            if img and not os.path.isabs(img):
                img = os.path.normpath(os.path.join(base_dir, img))
            samples.append(
                Sample(
                    id=sid,
                    image_path=img,
                    ground_truth=row.get("ground_truth") or "",
                    language=(row.get("language") or "unknown").strip().lower(),
                    century=(row.get("century") or "unknown").strip(),
                    metadata={k: v for k, v in row.items()},
                )
            )
            if limit and len(samples) >= limit:
                break
    return Dataset(path=os.path.abspath(tsv_path), samples=samples)
