"""Text normalization for fair CER/WER comparison.

Normalization is intentionally conservative: diplomatic transcription
preserves historical spelling and casing by default. Only whitespace
collapsing and newline canonicalization are applied unless explicitly
disabled, so the harness measures recognition fidelity rather than
post-hoc cleanup.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import List

_WS_RUN = re.compile(r"[ \t]+")
_BLANK_RUN = re.compile(r"\n{3,}")


@dataclass(frozen=True)
class NormalizationPolicy:
    """Declarative normalization settings, logged with every run."""

    keep_case: bool = True
    normalize_ws: bool = True
    unicode_form: str = "NFC"

    def fingerprint(self) -> str:
        return f"case={self.keep_case};ws={self.normalize_ws};u={self.unicode_form}"


def normalize_text(text: str, policy: NormalizationPolicy) -> str:
    if not text:
        return ""
    out = unicodedata.normalize(policy.unicode_form, text)
    out = out.replace("\r\n", "\n").replace("\r", "\n")
    if policy.normalize_ws:
        out = _WS_RUN.sub(" ", out)
        out = _BLANK_RUN.sub("\n\n", out)
        out = "\n".join(line.strip() for line in out.split("\n"))
        out = out.strip()
    if not policy.keep_case:
        out = out.lower()
    return out


def tokenize_words(text: str) -> List[str]:
    return text.split() if text and text.strip() else []
