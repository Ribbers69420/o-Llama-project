"""Levenshtein distance over arbitrary sequences (chars or word tokens)."""

from __future__ import annotations

from typing import Sequence


def levenshtein(a: Sequence, b: Sequence) -> int:
    """Edit distance with unit substitution/insertion/deletion costs.

    Uses a single rolling row, O(min(n, m)) memory.
    """
    if a is b:
        return 0
    n, m = len(a), len(b)
    if n == 0:
        return m
    if m == 0:
        return n
    # Iterate over the longer sequence in the outer loop for a shorter row.
    if m < n:
        a, b = b, a
        n, m = m, n
    prev_row = list(range(m + 1))
    for i in range(1, n + 1):
        prev_diag = prev_row[0]
        prev_row[0] = i
        ai = a[i - 1]
        for j in range(1, m + 1):
            tmp = prev_row[j]
            cost = 0 if ai == b[j - 1] else 1
            prev_row[j] = min(
                prev_row[j] + 1,      # deletion
                prev_row[j - 1] + 1,  # insertion
                prev_diag + cost,     # substitution
            )
            prev_diag = tmp
    return prev_row[m]
