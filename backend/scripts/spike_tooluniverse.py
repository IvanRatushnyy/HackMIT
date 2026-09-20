"""Spike: run each candidate ToolUniverse tool once for nilotinib / Parkinson's and dump the raw response.
Usage: backend/.venv/bin/python backend/scripts/spike_tooluniverse.py [outdir]
Nothing here is pipeline code; it exists to record what the tools actually return."""
import json, sys, time, pathlib
from tooluniverse import ToolUniverse

OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "backend/.cache/spike")
OUT.mkdir(parents=True, exist_ok=True)

CALLS = [
    ("OpenTargets_get_drug_chembId_by_generic_name", {"drugName": "nilotinib"}),
    ("OpenTargets_get_disease_id_description_by_name", {"diseaseName": "Parkinson disease"}),
    ("OpenTargets_get_drug_mechanisms_of_action_by_chemblId", {"chemblId": "CHEMBL255863"}),
    ("OpenTargets_get_target_id_description_by_name", {"targetName": "ABL1"}),
    ("OpenTargets_get_evidence_by_datasource", {"efoId": "MONDO_0005180", "ensemblId": "ENSG00000097007", "size": 50}),
    ("ClinicalTrials_search_studies", {"query_cond": "(Parkinson disease)", "query_intr": "(nilotinib)", "page_size": 50}),
    ("ClinicalTrials_get_study", {"nct_id": "NCT02954978"}),
    ("get_clinical_trial_status_and_dates", {"nct_ids": ["NCT02954978", "NCT02281474"]}),
    ("get_clinical_trial_conditions_and_interventions", {"nct_ids": ["NCT02954978", "NCT02281474"]}),
    ("extract_clinical_trial_outcomes", {"nct_ids": ["NCT02954978"], "outcome_measure": "primary"}),
    ("PubMed_search_articles", {"query": "nilotinib AND (Parkinson OR \"Parkinson disease\")", "limit": 50, "include_abstract": True}),
    ("PubMed_search_articles__csf", {"query": "nilotinib AND (\"cerebrospinal fluid\" OR CSF)", "limit": 50, "include_abstract": True}),
    ("PubMed_get_article", {"pmid": "27434297,24971373,27858718"}),  # Pagan 2016, Reinwald 2014, Schwarzschild 2016? (ids checked below)
    ("EuropePMC_search_articles", {"query": "nilotinib AND Parkinson", "limit": 20}),
]

tu = ToolUniverse()
tu.load_tools(include_tools=sorted({n.split("__")[0] for n, _ in CALLS}))
print("loaded", len(tu.all_tools), "tools")

summary = {}
for label, args in CALLS:
    name = label.split("__")[0]
    t = time.time()
    try:
        res = tu.run({"name": name, "arguments": args})
        ok = True
    except Exception as e:  # noqa: BLE001
        res, ok = {"exception": repr(e)}, False
    ms = int((time.time() - t) * 1000)
    (OUT / f"{label}.json").write_text(json.dumps({"tool": name, "arguments": args, "elapsed_ms": ms, "result": res}, indent=1, default=str))
    size = len(json.dumps(res, default=str))
    summary[label] = {"ok": ok, "elapsed_ms": ms, "bytes": size, "type": type(res).__name__}
    print(f"{label:55s} ok={ok} {ms:6d} ms {size:8d} B {type(res).__name__}")
(OUT / "_summary.json").write_text(json.dumps(summary, indent=1))
