"""Date rules shared by every connector. The temporal filter reads `published`; only this module decides what it is.

Rule (BACKEND_PLAN, ToolUniverse plan §"Date-resolution rules"):
  * a record's date is the EARLIEST day-level date among its candidates (PubMed `pub_date` when it names a day,
    Europe PMC `firstPublicationDate`, ClinicalTrials.gov `studyFirstPostDate` / `resultsFirstPostDate`);
  * a candidate that names only a month or a year resolves to the LAST day of that period, so a record is not
    visible until it certainly existed (the chosen failure direction: err toward doubt);
  * nothing resolvable → None, and the record never becomes Evidence.
"""
from __future__ import annotations

import calendar
import re
from datetime import date

_MONTHS = {m.lower(): i for i, m in enumerate(calendar.month_abbr) if m}
_MONTHS.update({m.lower(): i for i, m in enumerate(calendar.month_name) if m})

Granularity = str  # "day" | "month" | "year"


def parse_partial(raw: str | None) -> tuple[str, Granularity] | None:
    """Parse '2016 Jul 11', '2016 Jul', '2016', '2024 Jul-Aug 01', '2017-10-16', '2017-01', '2014'.
    Returns (ISO date, granularity) with month/year resolved to the last day of the period."""
    if not raw:
        return None
    s = str(raw).strip()
    m = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        return _iso(int(m[1]), int(m[2]), int(m[3])), "day"
    m = re.fullmatch(r"(\d{4})-(\d{2})", s)
    if m:
        return _last_day(int(m[1]), int(m[2])), "month"
    m = re.fullmatch(r"(\d{4})", s)
    if m:
        return f"{m[1]}-12-31", "year"
    # PubMed prose forms: "2016 Jul 11", "2016 Jul", "2024 Jul-Aug 01", "2016 Summer"
    m = re.fullmatch(r"(\d{4})\s+([A-Za-z]+)(?:-[A-Za-z]+)?(?:\s+(\d{1,2}))?", s)
    if m:
        year, mon = int(m[1]), _MONTHS.get(m[2].lower())
        if mon is None:
            return f"{year}-12-31", "year"
        if m[3]:
            try:
                return _iso(year, mon, int(m[3])), "day"
            except ValueError:
                return _last_day(year, mon), "month"
        return _last_day(year, mon), "month"
    m = re.match(r"(\d{4})", s)
    return (f"{m[1]}-12-31", "year") if m else None


def resolve(candidates: list[tuple[str | None, str]]) -> tuple[str | None, str]:
    """`candidates` = [(raw date, basis label)]. Earliest day-level wins; else the earliest doubt-resolved partial."""
    day: list[tuple[str, str]] = []
    partial: list[tuple[str, str]] = []
    for raw, basis in candidates:
        parsed = parse_partial(raw)
        if parsed is None:
            continue
        iso, gran = parsed
        (day if gran == "day" else partial).append((iso, f"{basis} ({raw})" if gran == "day" else f"{basis} ({raw}) → last day of {gran}"))
    if day:
        return min(day)
    if partial:
        return min(partial)
    return None, "undated"


def _iso(y: int, m: int, d: int) -> str:
    return date(y, m, d).isoformat()


def _last_day(y: int, m: int) -> str:
    return _iso(y, m, calendar.monthrange(y, m)[1])
