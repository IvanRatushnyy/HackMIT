from elute.engine.independence import distinct_groups, independence_group, key_authors, normalize_author


def test_author_normalization_forms():
    assert normalize_author("Simuni T") == "simuni-t"
    assert normalize_author("Tanya Simuni") == "simuni-t"
    assert normalize_author("Pagan, Fernando L.") == "pagan-f"
    assert normalize_author("Émile Zola") == "zola-e"
    assert normalize_author("") is None


def test_group_rules_prefer_last_author_then_affiliation_then_unknown():
    assert independence_group(["Pagan F", "Hebron M", "Moussa C"], "Department of Neurology, Georgetown University Medical Center") == "moussa-c|georgetown university medical"
    assert independence_group(["Reinwald M"], None) == "reinwald-m|"
    assert independence_group([], None) == "unknown"


def test_two_unknowns_and_overlapping_authors_never_count_twice():
    assert distinct_groups([("unknown", set()), ("unknown", set())]) == 0
    a = ("moussa-c|georgetown", key_authors(["Pagan F", "Moussa C"]))
    b = ("hebron-m|georgetown", key_authors(["Hebron M", "Moussa C"]))  # shares the last author → same group
    c = ("dawson-t|jhu", key_authors(["Ko H", "Dawson T"]))
    assert distinct_groups([a, b, c]) == 2
    assert distinct_groups([("x|1", set()), ("y|2", set())]) == 2  # two journals/PMIDs alone would not have counted; two keys do
