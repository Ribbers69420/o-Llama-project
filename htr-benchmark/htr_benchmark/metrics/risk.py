"""Hallucination / reliability heuristics for assistant-safe HTR.

Generative mLLMs fail differently from character-level OCR: errors are
bimodal (near-perfect or wholesale fabrication). Average CER hides this,
so we surface proxy reliability signals that do not require token-level
confidences. These are heuristics meant to be replaced by a trained
verifier in production.
"""

from __future__ import annotations

from dataclasses import dataclass

from ..normalize import tokenize_words

_BANNED_PREAMBLES = (
    "here is the transcription",
    "here's the transcription",
    "transcription:",
    "sure, here",
    "as an ai",
    "i cannot",
    "i'm unable",
    "```",
)


def format_violations(pred: str) -> int:
    """Count diplomatic-output violations (preambles, fences, refusals)."""
    lower = pred.lower()
    return sum(1 for b in _BANNED_PREAMBLES if b in lower)


def uncertainty_rate(pred: str) -> float:
    """Fraction of word tokens flagged ``[illegible]``."""
    tokens = tokenize_words(pred)
    if not tokens:
        return 0.0
    flagged = sum(1 for t in tokens if "[illegible]" in t.lower())
    return flagged / len(tokens)


def lexical_anomaly(pred: str) -> float:
    """Bigram repetitiveness in [0, 1]; high values indicate decoder drift."""
    words = [w.lower() for w in tokenize_words(pred)]
    if len(words) < 8:
        return 0.0
    bigrams = [(words[i], words[i + 1]) for i in range(len(words) - 1)]
    if not bigrams:
        return 0.0
    return max(0.0, 1.0 - len(set(bigrams)) / len(bigrams))


@dataclass(frozen=True)
class RiskSignals:
    format_violations: int
    uncertainty_rate: float
    lexical_anomaly: float
    length_ratio: float
    hallucination_risk: bool

    def as_dict(self) -> dict:
        return {
            "format_violations": self.format_violations,
            "uncertainty_rate": self.uncertainty_rate,
            "lexical_anomaly": self.lexical_anomaly,
            "length_ratio": self.length_ratio,
            "hallucination_risk": int(self.hallucination_risk),
        }


def compute_risk(
    pred: str,
    gt_len: int,
    length_low: float = 0.15,
    length_high: float = 4.0,
    anomaly_threshold: float = 0.45,
) -> RiskSignals:
    """Derive reliability signals and an overall hallucination flag."""
    fv = format_violations(pred)
    ur = uncertainty_rate(pred)
    la = lexical_anomaly(pred)
    ratio = (len(pred) / gt_len) if gt_len > 0 else (0.0 if not pred else 99.0)

    flag = False
    if not pred.strip():
        flag = True
    elif fv > 0:
        flag = True
    elif la > anomaly_threshold:
        flag = True
    elif gt_len > 0 and (ratio < length_low or ratio > length_high):
        flag = True

    return RiskSignals(fv, ur, la, ratio, flag)
