"""Character and Word Error Rates.

    CER = (S + D + I) / N            WER = (S_w + D_w + I_w) / N_w

where edits are Levenshtein-based over characters / word tokens and N is
the length of the ground-truth reference.
"""

from __future__ import annotations

from .edit_distance import levenshtein
from ..normalize import tokenize_words


def cer(pred: str, gt: str) -> float:
    gt_chars = list(gt)
    if not gt_chars:
        return 0.0 if not pred else 1.0
    return levenshtein(list(pred), gt_chars) / len(gt_chars)


def wer(pred: str, gt: str) -> float:
    gt_words = tokenize_words(gt)
    if not gt_words:
        return 0.0 if not tokenize_words(pred) else 1.0
    return levenshtein(tokenize_words(pred), gt_words) / len(gt_words)
