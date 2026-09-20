"""M0A smoke: the app boots, /api/health has the §15 shape, and nothing about credentials leaks."""
from __future__ import annotations

from fastapi.testclient import TestClient

from elute.main import create_app
from elute.settings import Settings


def test_health_shape_in_fixture_mode(tmp_path, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    settings = Settings(ELUTE_MODE="fixture", ELUTE_CACHE_DIR=tmp_path, ELUTE_DB_PATH=tmp_path / "elute.sqlite", OPENAI_API_KEY=None, OPENAI_MODEL=None, _env_file=None)
    with TestClient(create_app(settings)) as client:
        r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["mode"] == "fixture" and body["llm_configured"] is False
    assert set(body["connectors"]) == {"biology", "clinical_trials", "literature"}
    for c in body["connectors"].values():
        assert c["preferred"] == "unverified" and c["fallback"] in {"ok", "down", "unverified"}
    assert "sk-" not in r.text and "OPENAI" not in r.text


def test_settings_never_expose_the_key():
    s = Settings(OPENAI_API_KEY="sk-secret", OPENAI_MODEL="m", _env_file=None)
    assert s.llm_credentials_present and "sk-secret" not in str(s.redacted())


# ---------------------------------------------------------------------------------------------------------
# M6: the appraisal endpoints (§15) in fixture mode and in live mode on cassettes
# ---------------------------------------------------------------------------------------------------------
import json  # noqa: E402

from elute.connectors.direct import DirectConnector  # noqa: E402
from elute.connectors.tooluniverse import ToolUniverseConnector  # noqa: E402
from elute.store import PayloadCache  # noqa: E402
from tests.conftest import FIXTURES  # noqa: E402


def fixture_app(tmp_path):
    settings = Settings(ELUTE_MODE="fixture", ELUTE_CACHE_DIR=tmp_path, ELUTE_DB_PATH=tmp_path / "e.sqlite", ELUTE_TODAY="2026-09-20", OPENAI_API_KEY=None, OPENAI_MODEL=None, _env_file=None)
    return create_app(settings)


def live_app(tmp_path, **env):
    settings = Settings(ELUTE_MODE="live", ELUTE_CACHE_DIR=tmp_path, ELUTE_DB_PATH=tmp_path / "e.sqlite", ELUTE_TODAY="2026-09-20", OPENAI_API_KEY=None, OPENAI_MODEL=None, _env_file=None, **env)
    app = create_app(settings)
    cache = PayloadCache(FIXTURES, offline=True)
    app.state.overrides = {"tu": ToolUniverseConnector(cache, offline=True), "direct": DirectConnector(cache, offline=True)}
    return app


def test_fixture_post_is_synchronous_and_detail_validates_shape(tmp_path):
    with TestClient(fixture_app(tmp_path)) as c:
        r = c.post("/api/appraisals", json={"drug": "nilotinib", "disease": "Parkinson's disease", "as_of": "2017-11-20"})
        assert r.status_code == 200 and r.json()["status"] == "complete"
        rid = r.json()["id"]
        g = c.get(f"/api/appraisals/{rid}").json()
        assert g["status"] == "complete" and g["appraisal"]["as_of"] == "2017-11-20" and g["appraisal"]["data_mode"] == "fixture"
        d = c.get(f"/api/appraisals/{rid}/detail").json()
        cand, q = d["candidate"], d["query"]
        assert len(cand["prerequisites"]) == 5 and len(cand["chain"]["claims"]) == 6 and cand["objections"] and cand["recommendation"]["stance"]
        assert q["kind"] == "pair" and len(q["ledger"]["rows"]) == 10 and q["ledger"]["kind"] == "scripted"
        assert all(row["reasoning"]["question"] for row in q["ledger"]["rows"])
        assert [cut["id"] for cut in cand["cutoffs"]] == ["jul-2016", "today"]  # 2017-11-20 is the last cutoff, named today
        # another date on the same fixture run
        d2 = c.get(f"/api/appraisals/{rid}/detail", params={"as_of": "2026-09-20"}).json()
        assert [cut["id"] for cut in d2["candidate"]["cutoffs"]] == ["jul-2016", "nov-2017", "today"]


def test_error_shapes(tmp_path):
    with TestClient(fixture_app(tmp_path)) as c:
        assert c.get("/api/appraisals/ap_nope").status_code == 404 and c.get("/api/appraisals/ap_nope").json()["error"]["code"] == "not_found"
        assert c.get("/api/appraisals/ap_nope/detail").status_code == 404
        r = c.post("/api/appraisals", json={"drug": "nilotinib", "disease": "Parkinson disease", "as_of": "20-11-2017"})
        assert r.status_code == 422 and r.json()["error"]["code"] == "invalid_as_of"
        r = c.post("/api/appraisals", json={"drug": "metformin", "disease": "Parkinson disease"})
        assert r.status_code == 422 and r.json()["error"]["code"] == "unresolvable_entity"


def test_fixture_events_replay_ten_settled_entries(tmp_path):
    with TestClient(fixture_app(tmp_path)) as c:
        rid = c.post("/api/appraisals", json={"drug": "nilotinib", "disease": "Parkinson disease"}).json()["id"]
        with c.stream("GET", f"/api/appraisals/{rid}/events") as s:
            lines = [ln for ln in s.iter_lines() if ln.startswith("data:")]
        payloads = [json.loads(ln[5:]) for ln in lines]
        assert [p["step"] for p in payloads] == [f"L{i}" for i in range(1, 11)] and payloads[-1]["done"] is True
        assert payloads[3]["row"]["id"] == "L4" and payloads[3]["row"]["reasoning"]["question"]


def test_live_run_on_cassettes_through_the_api(tmp_path):
    with TestClient(live_app(tmp_path)) as c:
        r = c.post("/api/appraisals", json={"drug": "nilotinib", "disease": "Parkinson disease", "as_of": "2017-11-20"})
        assert r.status_code == 202 and r.json()["status"] == "running"
        rid = r.json()["id"]
        with c.stream("GET", f"/api/appraisals/{rid}/events") as s:
            payloads = [json.loads(ln[5:]) for ln in s.iter_lines() if ln.startswith("data:")]
        assert payloads and payloads[-1]["done"] is True
        settled = [p for p in payloads if p["phase"] == "settled"]
        assert [p["step"] for p in settled] == [f"L{i}" for i in range(1, 11)]
        assert settled[2]["row"]["execution"]["tool"] == "ClinicalTrials_search_studies" and settled[2]["row"]["records"]
        import time
        for _ in range(50):
            g = c.get(f"/api/appraisals/{rid}").json()
            if g["status"] != "running":
                break
            time.sleep(0.1)
        assert g["status"] == "complete_with_gaps" and g["appraisal"]["llm"] == "unavailable"  # no model configured: honest gaps
        d = c.get(f"/api/appraisals/{rid}/detail").json()
        assert d["query"]["ledger"]["kind"] == "recorded" and d["candidate"]["curation"] == "draft"
        assert c.get(f"/api/appraisals/{rid}/detail", params={"as_of": "2016-07-11"}).status_code == 422


def test_running_status_shape_while_a_live_run_is_in_flight(tmp_path, monkeypatch):
    import elute.api.appraisals as mod

    class Hold:
        def submit(self, fn, *a):  # never runs: the run stays "running"
            return None

    monkeypatch.setattr(mod, "_pool", Hold())
    with TestClient(live_app(tmp_path)) as c:
        rid = c.post("/api/appraisals", json={"drug": "nilotinib", "disease": "Parkinson disease"}).json()["id"]
        g = c.get(f"/api/appraisals/{rid}")
        assert g.status_code == 200 and g.json() == {"id": rid, "status": "running", "appraisal": None}
        assert c.get(f"/api/appraisals/{rid}/detail").status_code == 409
