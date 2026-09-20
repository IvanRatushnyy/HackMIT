from elute.ids import evidence_id, normalize_doi, normalize_text, publication_record_id


def test_evidence_id_is_stable_and_order_independent():
    a = evidence_id("pubmed", "pmid:27434297", "publication", "2016-07-11")
    b = evidence_id("pubmed", "pmid:27434297", "publication", "2016-07-11")
    assert a == b and a.startswith("EV_") and len(a) == 15
    assert evidence_id("clinicaltrials_gov", "NCT03205488|registration", "registration", "2017-07-02") != \
        evidence_id("clinicaltrials_gov", "NCT03205488|results", "results", "2020-07-22")


def test_record_id_priority_pmid_pmcid_doi_title():
    assert publication_record_id("1", "PMC2", "10.1/x", "T", 2020) == "pmid:1"
    assert publication_record_id(None, "PMC2", "10.1/x", "T", 2020) == "pmcid:PMC2"
    assert publication_record_id(None, None, "https://doi.org/10.1/X", "T", 2020) == "doi:10.1/x"
    assert publication_record_id(None, None, None, "Nilotinib: a Study!", 2020) == "title:nilotinib a study|2020"
    assert normalize_doi("DOI:10.1/A") == "10.1/a" and normalize_text("Émile-Zola  ") == "emile zola"
