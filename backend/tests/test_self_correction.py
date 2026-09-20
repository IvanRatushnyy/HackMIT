"""The two bounded self-correction paths (BACKEND_PLAN §9a): A, a ToolUniverse failure → direct API with the same
query; B, records that do not mention the resolved condition → a reformulated query. Never more than 3 attempts."""
from __future__ import annotations

from elute.connectors.base import ToolError
from elute.pipeline.tools import DefaultSelector, Selection, run_task
from tests.conftest import task


def test_path_a_tool_error_falls_back_to_direct_with_the_same_query(tu, direct, monkeypatch):
    def boom(tool, arguments):
        raise ToolError("simulated ToolUniverse outage", retriable=True)

    monkeypatch.setattr(tu, "call", boom)
    ep = run_task(task("literature", "L4", facet="efficacy"), tu, direct)
    assert ep.status == "ok" and ep.transport == "direct"
    assert [a.outcome for a in ep.attempts[:2]] == ["error", "ok"]
    assert ep.attempts[0].query == ep.attempts[1].query and ep.attempts[0].reason.startswith("simulated")
    assert ep.attempts[1].tool == "PubMed_search_articles"  # same tool name, direct transport, same records shape


def test_path_a_timeout_is_labelled_timeout(tu, direct, monkeypatch):
    def slow(tool, arguments):
        raise ToolError("PubMed_search_articles timed out after 25s", retriable=True, kind="timeout")

    monkeypatch.setattr(tu, "call", slow)
    ep = run_task(task("trials", "L3"), tu, direct, supplements=False)
    assert ep.attempts[0].outcome == "timeout" and ep.attempts[1].transport == "direct" and ep.status == "ok"


class ShortFormSelector(DefaultSelector):
    """The demo: the first literature query uses the short form 'PD'; the second is the canonical name."""

    def select(self, t, attempts):
        if not attempts:
            return Selection("PubMed_search_articles", {"query": "nilotinib AND PD AND kinase", "limit": 100, "include_abstract": True}, "short form")
        return super().select(t, attempts)


def test_path_b_insufficient_records_trigger_a_reformulation(tu, direct, monkeypatch):
    real = tu.call
    unrelated = {"status": "success", "data": [
        {"pmid": "1", "title": "Nilotinib pharmacokinetics in CML", "abstract": "PD = pharmacodynamics, not the disease.", "pub_date": "2015 Jan 1", "pub_year": "2015", "journal": "x"}]}

    def call(tool, arguments):
        if arguments.get("query", "").startswith("nilotinib AND PD"):
            return unrelated, 5, False
        return real(tool, arguments)

    monkeypatch.setattr(tu, "call", call)
    ep = run_task(task("literature", "L4", facet="efficacy"), tu, direct, selector=ShortFormSelector())
    assert [a.outcome for a in ep.attempts[:2]] == ["insufficient", "ok"]
    assert "none mentions Parkinson disease" in ep.attempts[0].reason
    assert ep.attempts[1].transport == "tooluniverse" and "Parkinson" in ep.attempts[1].query["query"]
    assert ep.transport == "tooluniverse" and ep.status == "ok"


def test_never_more_than_three_attempts_and_failure_is_honest(tu, direct, monkeypatch):
    monkeypatch.setattr(tu, "call", lambda tool, arguments: (_ for _ in ()).throw(ToolError("down")))
    monkeypatch.setattr(direct, "call", lambda tool, arguments: (_ for _ in ()).throw(ToolError("also down")))
    ep = run_task(task("trials", "L3"), tu, direct)
    assert ep.status == "failed" and ep.records == [] and len(ep.attempts) <= 3
    assert [a.transport for a in ep.attempts] == ["tooluniverse", "direct"]


def test_tool_not_in_the_task_list_is_refused(tu, direct):
    class Rogue(DefaultSelector):
        def select(self, t, attempts):
            return Selection("PubMed_search_articles", {"query": "x"}, "wrong task")

    try:
        run_task(task("trials", "L3"), tu, direct, selector=Rogue())
    except ValueError as e:
        assert "not in the list" in str(e)
    else:
        raise AssertionError("a tool outside the task's list must be refused by code")
