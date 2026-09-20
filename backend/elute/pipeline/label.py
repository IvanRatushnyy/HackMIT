"""The FDA label as safety evidence (L2). openFDA hands back label sections as prose; this module reads out of them
only what the Safety block prints: the boxed warning's title and first sentence, each warning's heading with one line
of what it says, the contraindications, and what the label was written for. Nothing is inferred; a body-system tag
per heading is a keyword lookup shown beside the heading, never a status."""
from __future__ import annotations

import re

ACRONYMS = {"QT", "QTC", "ECG", "ECGS", "CBC", "CNS", "CYP3A4", "HIV", "HBV", "HCV", "AST", "ALT", "LDL", "GLP", "DNA", "RNA",
            "TKI", "CML", "BCR", "ABL", "ALL", "FDA", "MTC", "MEN", "IMNM", "CK", "US", "MI", "GI", "COPD", "REMS", "TB", "PML", "DRESS"}
JOINERS = {"and", "or", "of", "in", "with", "the", "to", "for", "from", "due", "a", "an", "on", "by", "at"}
_CITE = re.compile(r"\[\s*see[^\]]*\]|\(\s*see[^)]*\)|\(\s*\d+(?:\.\d+)?(?:\s*,\s*\d+(?:\.\d+)?)*\s*\)", re.I)
_WS = re.compile(r"\s+")
_HEADER = re.compile(r"^\s*(?:\d+\s+)?(?:BOXED\s+)?(?:WARNINGS?(?:\s+AND\s+PRECAUTIONS)?|PRECAUTIONS)\s*[:.-]?\s*", re.I)
_LEAD = re.compile(r"^\s*(?:BOXED\s+)?WARNINGS?\s*[:\-–—]?\s*", re.I)
_NONE = re.compile(r"^\s*(?:\d+\s+)?(?:WARNINGS?(?:\s+AND\s+PRECAUTIONS)?|PRECAUTIONS)?\s*[:.-]?\s*None\.?\s*$", re.I)

SYSTEMS: list[tuple[str, tuple[str, ...]]] = [
    ("heart and vessels", ("qt", "cardiac", "cardio", "arterial", "vascular", "occlusive", "sudden death", "myocard", "heart", "angina", "thrombo", "embol", "stroke", "hypertension", "hypotension", "blood pressure", "arrhythm", "torsade", "bradycard", "tachycard")),
    ("blood", ("myelosuppress", "neutropen", "thrombocytopen", "anemia", "anaemia", "hemorrhag", "haemorrhag", "bleeding", "cytopen", "leukopen", "coagul")),
    ("liver", ("hepat", "liver", "bilirubin", "transaminase", "jaundice")),
    ("pancreas", ("pancrea", "lipase", "amylase")),
    ("kidney", ("renal", "kidney", "nephro")),
    ("electrolytes and metabolism", ("electrolyte", "potassium", "magnesium", "hypokal", "hypomag", "hyponat", "hypocalc", "hypophosph", "tumor lysis", "tumour lysis", "uric", "lactic acidosis", "glyc", "lipid", "weight", "fluid retention", "edema", "oedema")),
    ("gut", ("gastro", "gastrectomy", "food", "lactose", "nausea", "vomit", "diarrh", "intestin", "bowel", "colitis", "perforation")),
    ("lungs", ("pulmon", "lung", "pleural", "pneumon", "respirat", "interstitial", "aspiration")),
    ("nervous system", ("neuro", "seizure", "encephal", "cognit", "somnol", "dizz", "syncope", "fall", "psychiat", "suicid", "depress", "confus")),
    ("skin", ("skin", "rash", "cutaneous", "stevens", "photosens", "dermat")),
    ("muscle and bone", ("muscle", "myopath", "rhabdo", "musculoskelet", "bone", "fracture", "growth")),
    ("pregnancy and fertility", ("pregnan", "embryo", "fetal", "foetal", "lactation", "breast", "fertility", "contracept")),
    ("infection", ("infect", "sepsis", "opportunistic", "reactivation")),
    ("thyroid and endocrine", ("thyroid", "endocrin", "adrenal", "pituitar")),
    ("cancer", ("malignan", "tumor", "tumour", "carcinoma", "lymphoma", "leukemia", "leukaemia")),
    ("immune and allergy", ("hypersensitiv", "anaphyla", "angioedema", "immun", "allerg")),
    ("drug interactions", ("interaction", "cyp", "inhibitor", "inducer", "concomitant")),
]


def clean(text: str | None, limit: int | None = None) -> str:
    """Citations and section references removed, whitespace collapsed, optionally cut at a word boundary."""
    if not text:
        return ""
    t = _WS.sub(" ", _CITE.sub(" ", text.replace("•", " ").replace("·", " "))).replace(" .", ".").replace(" ,", ",").strip()
    t = re.sub(r"\s+([.;:,])", r"\1", t)
    if limit and len(t) > limit:
        cut = t[:limit].rsplit(" ", 1)[0].rstrip(",;: ")
        t = cut + "…"
    return t


def lower_first(s: str) -> str:
    """First character lowered unless the word is an acronym ("ECGs", "QT")."""
    return s[:1].lower() + s[1:] if s and not (len(s) > 1 and s[:2].isupper()) else s


def phrase(heading: str) -> str:
    """A Title Case heading as it reads inside a sentence: "Cardiac and Arterial Vascular Occlusive Events" → "cardiac and arterial vascular occlusive events"."""
    return lower_first(sentence_case(heading))


def dedupe_sentences(text: str | None, limit: int | None = None) -> str:
    """openFDA often carries a section twice (full text, then the highlights): repeated sentences are dropped."""
    t = clean(text)
    seen: set[str] = set()
    out = []
    for s in re.split(r"(?<=[.;])\s+", t):
        key = re.sub(r"[^a-z0-9]", "", s.lower())
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(s.strip())
    return clean(" ".join(out), limit)


def _is_acronym(core: str) -> bool:
    """Written as one: "QT", "ECGs", "QTc" — never an ordinary word that happens to spell one ("all", "men", "us")."""
    if core.isupper():
        return core in ACRONYMS or (core.isalpha() and len(core) <= 2)
    return core.upper() in ACRONYMS and core[:2].isupper()


def sentence_case(title: str) -> str:
    """"QT PROLONGATION and SUDDEN DEATHS" → "QT prolongation and sudden deaths": acronyms keep their case."""
    out = []
    for w in title.split():
        core = re.sub(r"[^A-Za-z0-9]", "", w)
        if core.lower() in JOINERS:
            out.append(w.lower())
        elif _is_acronym(core):
            out.append(w)
        else:
            out.append(w.lower())
    s = " ".join(out)
    return s[:1].upper() + s[1:] if s and not s[:1].isupper() else s


def first_sentence(text: str, limit: int = 220) -> str:
    t = clean(text)
    m = re.search(r"(.+?[.;])(?:\s|$)", t)
    s = (m.group(1) if m else t).strip()
    s = s.rstrip(".;")
    return clean(s, limit)


def parse_boxed(text: str | None) -> tuple[str | None, str | None]:
    """The boxed warning's title (sentence-cased) and its first sentence, or (None, None) when there is none."""
    if not text or not text.strip():
        return None, None
    body = _LEAD.sub("", _WS.sub(" ", text).strip(), count=1).lstrip("•· ")
    words = body.split(" ")
    # The title is the run of capitalised words (joiners allowed inside it) up to the first ordinary word or a
    # sentence mark; the words are kept as written so the reason starts exactly where the title stopped.
    taken: list[str] = []
    for w in words:
        core = re.sub(r"[^A-Za-z0-9]", "", w)
        if not core:
            break
        if core.isupper() or _is_acronym(core) or (core.lower() in JOINERS and taken) or re.fullmatch(r"[A-Z0-9][A-Z0-9\-/+]*", core):
            taken.append(w)
            if w.endswith((".", ":", ";")):
                break
            continue
        break
    if not taken:
        taken = words[:8]
    consumed = len(" ".join(taken))
    title_words = [w.rstrip(".:;,") for w in taken]
    while title_words and title_words[-1].lower() in JOINERS:  # a trailing joiner belongs to neither
        title_words.pop()
    title = sentence_case(" ".join(title_words)).rstrip(".:;,")
    rest = body[consumed:].strip(" .:;-–—•")
    rest = re.sub(r"^See full prescribing information for (the )?complete boxed warning\.?\s*", "", rest, flags=re.I)
    reason = first_sentence(rest) if rest else None
    return title or None, reason or None


_HIGHLIGHT = re.compile(r"(?:^|(?<=[.)•;])\s*|(?<=\s•)\s*)([A-Z][A-Za-z0-9,'’/()\- ]{2,110}?)\s*:\s*(.+?)\s*\(\s*(?:\d{1,2}(?:\.\d{1,2})?)(?:\s*,\s*\d{1,2}(?:\.\d{1,2})?)*\s*\)", re.S)
_NUMBERED = re.compile(r"(?:^|\s)5\.(\d{1,2})\s+([A-Z][A-Za-z0-9,'’/()\- ]{2,90}?)(?=\s+(?:[A-Z][a-z]+\s+[a-z]|[A-Z]{2,}[a-z]*\s+[a-z]))")
_PROSE = re.compile(r"(?:^|(?<=\.)\s+)([A-Z][A-Za-z0-9 ,/()\-]{2,60}?):\s+([^.]{10,240}\.)")


def _cut_at_full_text(text: str) -> str:
    """The PLR highlights end where the full section text starts ("5.1 Heading …")."""
    m = re.search(r"\s5\.1\s+[A-Z]", text[40:])
    return text[: m.start() + 40] if m else text


def parse_sections(text: str | None) -> list[tuple[str, str]]:
    """(heading, one line) per warning, in label order; [] when the label lists none."""
    if not text or _NONE.match(text):
        return []
    t = _WS.sub(" ", text).strip()
    t = _HEADER.sub("", t, count=1)
    items: list[tuple[str, str]] = []
    head = _cut_at_full_text(t)
    for m in _HIGHLIGHT.finditer(head):
        heading, detail = m.group(1).strip(" •-"), m.group(2)
        if len(heading.split()) > 12 or heading.lower().startswith(("see ", "the ")):
            continue
        items.append((heading, first_sentence(detail)))
    if len(items) < 2:
        items = []
        marks = list(_NUMBERED.finditer(t))
        for i, m in enumerate(marks):
            heading = m.group(2).strip()
            end = marks[i + 1].start() if i + 1 < len(marks) else min(len(t), m.end() + 600)
            items.append((heading, first_sentence(t[m.end():end])))
    if len(items) < 1:
        for m in _PROSE.finditer(t):
            items.append((m.group(1).strip(), first_sentence(m.group(2))))
    if not items and t:
        items.append(("Warnings", first_sentence(t)))
    seen: set[str] = set()
    out: list[tuple[str, str]] = []
    for heading, detail in items:
        h = sentence_case(heading) if heading.isupper() else heading
        h = re.sub(r"\s+", " ", h).strip()
        if h.lower() in seen or not detail:
            continue
        seen.add(h.lower())
        out.append((h, detail))
    return out


def parse_indication(text: str | None) -> str | None:
    """"indicated for the treatment of adult patients with …" → "the treatment of adult patients with …"."""
    if not text:
        return None
    t = clean(text)
    m = re.search(r"indicated\s+((?:for|as|in|to)\b.+?)(?=(?:\s+Limitations of Use|\s+\(\s*1|[.;]\s|$))", t, re.I)
    if not m:
        return None
    s = m.group(1).strip().rstrip(".;:")
    s = re.sub(r"^(for|as|in|to)\s+the\s+treatment\s+of:?\s*", "the treatment of ", s, flags=re.I)
    s = re.sub(r":\s*", " ", s)
    s = re.sub(r"^(the treatment of )([A-Z][a-z])", lambda m: m.group(1) + m.group(2).lower(), s)
    s = clean(s, 220)
    if s.count("(") > s.count(")"):  # the cut landed inside a parenthesis: cut before it
        s = s[: s.rfind("(")].rstrip(" ,;:") + "…"
    return s or None


def system_for(heading: str) -> str | None:
    h = heading.lower()
    for system, keys in SYSTEMS:
        if any(k in h for k in keys):
            return system
    return None


def monitoring_from_boxed(text: str | None, limit: int = 300) -> str | None:
    """The boxed warning's own instructions — the sentences that say monitor, obtain, correct, do not administer."""
    if not text:
        return None
    t = clean(text)
    sentences = [s.strip() for s in re.split(r"(?<=[.;])\s+", t) if s.strip()]
    picked = [s for s in sentences if re.search(r"\b(monitor|obtain|correct|do not|should not|must|avoid|discontinue|measure|test)", s, re.I)]
    picked.sort(key=lambda s: 0 if re.search(r"\bECG", s, re.I) else 1 if re.search(r"\bmonitor", s, re.I) else 2)  # what to watch first, then what to avoid
    if not picked:
        return None
    out = ""
    for s in picked[:3]:
        piece = lower_first(s.rstrip(".;"))
        if out and len(out) + len(piece) + 2 > limit:
            break
        out = f"{out}; {piece}" if out else piece
    return clean(out, limit + 40)
