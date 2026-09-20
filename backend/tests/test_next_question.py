from elute.models import Claim, Resolved
from elute.pipeline.next_question import next_question


def claims(**statuses: str) -> list[Claim]:
    base = {"C_MECHANISM": "established", "C_DISEASE_RELEVANCE": "established", "C_EXPOSURE": "established", "C_ENGAGEMENT": "established",
            "C_DOWNSTREAM": "established", "C_CLINICAL": "established", "C_SAFETY": "unknown"}
    base.update(statuses)
    return [Claim(id=k, gate=k.lower(), statement=k, node=k, status=v) for k, v in base.items()]


R = Resolved(target_symbol="ABL1")


def test_first_non_established_gate_in_causal_order_wins():
    assert next_question(claims(C_EXPOSURE="contested", C_ENGAGEMENT="unknown"), "nilotinib", "Parkinson disease", R).gate == "C_EXPOSURE"
    assert next_question(claims(C_ENGAGEMENT="unknown", C_CLINICAL="refuted"), "nilotinib", "Parkinson disease", R).gate == "C_ENGAGEMENT"
    assert next_question(claims(C_CLINICAL="single-source"), "nilotinib", "Parkinson disease", R).gate == "C_CLINICAL"
    assert next_question(claims(), "nilotinib", "Parkinson disease", R).gate == "C_SAFETY"


def test_exposure_question_reads_like_a_scientist_and_names_the_experiment():
    q = next_question(claims(C_EXPOSURE="contested"), "nilotinib", "Parkinson disease", R)
    assert "central nervous system" in q.next_question and "CSF/plasma" in q.suggested_experiment_or_data and "ABL1" in q.result_that_would_change_appraisal
