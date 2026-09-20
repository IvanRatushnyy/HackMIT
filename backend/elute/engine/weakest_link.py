"""The weakest link (BACKEND_PLAN v4.4 §5) — the policy, encoded exactly:

    WEAKNESS = {"established": 0, "single-source": 1, "unknown": 2, "contested": 3, "refuted": 4}
    weakest = max(claims, key=(WEAKNESS[status], count_against, len(caveats), -causal_index))

refuted is weaker than contested, weaker than unknown, weaker than single-source, weaker than established.
Ties: more contradicting/refuting evidence, then more caveats, then earlier in the causal chain."""
from __future__ import annotations

from elute.engine.labels import StatusResult
from elute.ids import CAUSAL_ORDER
from elute.models import Claim, WeakestLink

WEAKNESS: dict[str, int] = {"established": 0, "single-source": 1, "unknown": 2, "contested": 3, "refuted": 4}

CONSEQUENCE: dict[str, str] = {
    "C_MECHANISM": "Without an established mechanism, nothing downstream can be attributed to the drug.",
    "C_DISEASE_RELEVANCE": "If the target is not tied to the disease biology, engaging it cannot be expected to help.",
    "C_EXPOSURE": "The mechanism cannot act on a compartment the drug does not reach at an inhibiting concentration.",
    "C_ENGAGEMENT": "Reaching the compartment is not the same as engaging the target; without engagement the downstream biology has no cause.",
    "C_DOWNSTREAM": "If the expected downstream biology does not occur in patients, target engagement would not translate into benefit.",
    "C_CLINICAL": "A controlled negative result outranks every mechanistic argument for benefit.",
    "C_SAFETY": "A candidate whose safety is unacceptable in the likely population cannot be trialled regardless of efficacy.",
}


def weakest(claims: list[Claim], results: dict[str, StatusResult]) -> WeakestLink:
    def key(c: Claim) -> tuple[int, int, int, int]:
        r = results[c.id]
        return (WEAKNESS[c.status], len(r.against), len(c.caveats), -CAUSAL_ORDER.index(c.id))

    c = max(claims, key=key)
    r = results[c.id]
    why = f"{r.why} {CONSEQUENCE[c.id]}"
    return WeakestLink(claim_id=c.id, why=why, evidence_ids=[e.id for e in r.against] or [e.id for e in r.supports])
