"""§6.5: numbers in generated text must match cited evidence under formatting normalization; probabilities are rejected."""
from __future__ import annotations

from decimal import Decimal

from elute.engine.validate import check_numbers, extract_numbers
from elute.fixtures import aliases_for, load_bundle


def nums(text):
    return [(n.value, n.unit) for n in extract_numbers(text)]


def test_formatting_variants_normalize():
    assert nums("0.53%") == nums("0.53 %") == nums("0.530 percent") == [(Decimal("0.53"), "percent")] or nums("0.530 percent") == [(Decimal("0.530"), "percent")]
    assert nums("range 0.23–1.5 %") == [(Decimal("0.23"), "percent"), (Decimal("1.5"), "percent")]
    assert nums("n = 12 patients over 24 weeks") == [(Decimal(12), None), (Decimal(24), None)]


def test_dates_ids_and_years_are_not_numbers():
    assert nums("as of 2017-11-20 NCT03205488 in 2016 (PMID 27434297) ABL1 MAO-B") == []


def test_check_numbers_against_cited_evidence():
    b = load_bundle(); a = aliases_for(); ev = {e.id: e for e in b.evidence}
    reinwald, pagan = ev[a["reinwald-2014"]], ev[a["pagan-2016"]]
    assert check_numbers("the CSF/plasma ratio was 0.530 percent", [reinwald]) == []
    assert check_numbers("the CSF/plasma ratio was 0.53 %", [reinwald]) == []
    assert check_numbers("in 12 patients", [pagan]) == []
    assert check_numbers("in 13 patients", [pagan]) != []
    assert check_numbers("a CSF/plasma ratio of 0.53 %", [pagan]) != []  # cited the wrong source


def test_probabilities_and_scores_are_rejected_even_if_cited():
    b = load_bundle(); a = aliases_for(); ev = {e.id: e for e in b.evidence}
    probs = check_numbers("there is an 82% chance of failure", [ev[a["reinwald-2014"]]])
    assert any("probability" in p or "not in the cited evidence" in p for p in probs)
    assert check_numbers("confidence: 0.53 %", [ev[a["reinwald-2014"]]]) != []
