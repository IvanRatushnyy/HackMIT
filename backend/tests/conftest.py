"""Tests replay real payloads recorded by scripts/record_payloads.py; nothing here touches the network."""
from __future__ import annotations

from pathlib import Path

import pytest

from elute.connectors.base import Task
from elute.connectors.direct import DirectConnector
from elute.connectors.tooluniverse import ToolUniverseConnector
from elute.store import PayloadCache

FIXTURES = Path(__file__).parent / "fixtures"

BASE = dict(drug="nilotinib", disease="Parkinson disease", drug_chembl_id="CHEMBL255863", disease_efo_id="MONDO_0005180",
            disease_aliases=["Parkinson disease", "Parkinson's disease", "Parkinsons disease", "Parkinsonian"], target_symbol="ABL1",
            target_aliases=["c-Abl", "Abl"],
            target_ensembl_id="ENSG00000097007")


@pytest.fixture(scope="session")
def cache() -> PayloadCache:
    return PayloadCache(FIXTURES, offline=True)


@pytest.fixture(scope="session")
def tu(cache) -> ToolUniverseConnector:
    return ToolUniverseConnector(cache, offline=True)


@pytest.fixture(scope="session")
def direct(cache) -> DirectConnector:
    return DirectConnector(cache, offline=True)


def task(kind: str, step: str, **over) -> Task:
    kw = {**BASE, **over}
    return Task(step, kind, "?", **kw)
