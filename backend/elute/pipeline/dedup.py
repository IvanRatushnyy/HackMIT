"""Deduplication (BACKEND_PLAN v4.4 §11.3): PMID → PMCID → DOI → normalized title + year, applied to the combined,
canonicalized facet results before dating and the temporal gate. One publication keeps the union of the facets that
returned it and one set of metadata."""
from __future__ import annotations

from elute.pipeline.canonicalize import CanonRecord


def dedup(records: list[CanonRecord]) -> list[CanonRecord]:
    by_key: dict[str, CanonRecord] = {}
    order: list[str] = []
    for r in records:
        if r.key in by_key:
            kept = by_key[r.key]
            for f in r.facets:
                if f not in kept.facets:
                    kept.facets.append(f)
            for i in r.raw_ids:
                if i not in kept.raw_ids:
                    kept.raw_ids.append(i)
            # fill gaps, never overwrite what the first record stated
            if not kept.published and r.published:
                kept.published, kept.date_basis = r.published, r.date_basis
            if kept.cited_by_count is None and r.cited_by_count is not None:
                kept.cited_by_count = r.cited_by_count
            if not kept.affiliation and r.affiliation:
                kept.affiliation = r.affiliation
        else:
            by_key[r.key] = r
            order.append(r.key)
    return [by_key[k] for k in order]
