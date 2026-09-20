from __future__ import annotations

import pytest

from elute.fixtures import load_bundle
from elute.models import RetrievalCounts
from elute.pipeline.temporal import TemporalLeak, audit, visible, withheld
from tests.constants import EARLY_SNAPSHOT, PRE_TRIAL_SNAPSHOT


def test_visible_is_inclusive_and_undated_never_visible():
    class R:  # duck-typed record
        def __init__(self, d): self.published = d
    rs = [R("2017-11-20"), R("2017-11-21"), R(None), R("2016-01-01")]
    assert [r.published for r in visible(rs, PRE_TRIAL_SNAPSHOT)] == ["2017-11-20", "2016-01-01"]
    assert len(withheld(rs, PRE_TRIAL_SNAPSHOT)) == 2


def test_audit_summarises_and_never_filters():
    b = load_bundle()
    ev = visible(b.evidence, EARLY_SNAPSHOT)
    s = audit(ev, EARLY_SNAPSHOT, {"L4": RetrievalCounts(records_withheld=3)})
    assert s.evidence_visible == len(ev) and s.records_withheld_total == 3


def test_audit_raises_on_a_leak():
    b = load_bundle()
    with pytest.raises(TemporalLeak):
        audit(b.evidence, EARLY_SNAPSHOT)
