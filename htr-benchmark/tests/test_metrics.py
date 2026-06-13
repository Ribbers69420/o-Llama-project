from htr_benchmark.metrics import bootstrap_ci, cer, levenshtein, wer
from htr_benchmark.metrics.risk import compute_risk
from htr_benchmark.normalize import NormalizationPolicy, normalize_text


def test_levenshtein_basics():
    assert levenshtein("", "") == 0
    assert levenshtein("abc", "abc") == 0
    assert levenshtein("abc", "") == 3
    assert levenshtein("kitten", "sitting") == 3
    # symmetry
    assert levenshtein("flaw", "lawn") == levenshtein("lawn", "flaw")


def test_cer_wer_perfect_and_empty():
    assert cer("hello world", "hello world") == 0.0
    assert wer("hello world", "hello world") == 0.0
    assert cer("", "") == 0.0
    assert cer("x", "") == 1.0
    assert wer("a b", "") == 1.0


def test_cer_single_deletion():
    # one deleted char out of 5 reference chars
    assert abs(cer("helo", "hello") - 0.2) < 1e-9


def test_wer_substitution():
    assert abs(wer("the cat sat", "the dog sat") - (1 / 3)) < 1e-9


def test_normalization_collapses_whitespace():
    p = NormalizationPolicy(keep_case=True, normalize_ws=True)
    assert normalize_text("  a   b\t c \n\n\n d ", p) == "a b c\n\nd"


def test_normalization_lowercase():
    p = NormalizationPolicy(keep_case=False, normalize_ws=True)
    assert normalize_text("HeLLo", p) == "hello"


def test_bootstrap_ci_bounds_contain_point():
    values = [0.1, 0.2, 0.15, 0.5, 0.05, 0.3]
    ci = bootstrap_ci(values, iterations=500, confidence=0.95, seed=1)
    assert ci.low <= ci.point <= ci.high
    assert 0.0 <= ci.low <= 1.0
    assert ci.iterations == 500


def test_bootstrap_ci_deterministic():
    values = [0.1, 0.4, 0.2, 0.3]
    a = bootstrap_ci(values, iterations=200, seed=7)
    b = bootstrap_ci(values, iterations=200, seed=7)
    assert (a.low, a.point, a.high) == (b.low, b.point, b.high)


def test_bootstrap_ci_empty():
    ci = bootstrap_ci([], iterations=100)
    assert ci.point == 0.0 and ci.low == 0.0 and ci.high == 0.0


def test_risk_flags_empty_prediction():
    r = compute_risk("", gt_len=50)
    assert r.hallucination_risk is True


def test_risk_flags_preamble():
    r = compute_risk("Here is the transcription: foo bar", gt_len=30)
    assert r.format_violations >= 1
    assert r.hallucination_risk is True


def test_risk_clean_prediction_ok():
    text = "It is to be observed that the principle of utility"
    r = compute_risk(text, gt_len=len(text))
    assert r.hallucination_risk is False
    assert r.format_violations == 0
