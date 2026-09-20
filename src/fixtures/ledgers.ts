/* elute — evidence ledgers for the fixture queries.
 * kind: 'scripted' — a real run has not been recorded, so there is no elapsed column
 * and the banner says "scripted sequence, not a live run". Records are dated so the
 * ledger filters honestly at a historical cutoff. */

import type { Ledger, LedgerRow } from '../data/types'

const RUN_AT = '2026-09-19T14:02:11Z'
const human = { by: 'human' as const, date: '2026-09-19', initials: 'IR' }
const auto = { by: 'automated' as const }

const row = (r: Omit<LedgerRow, 'execution'> & { execution: Omit<LedgerRow['execution'], 'run_at'> }): LedgerRow => ({
  ...r,
  execution: { run_at: RUN_AT, ...r.execution },
})

export const parkinsonsLedger: Ledger = {
  kind: 'scripted',
  rows: [
    row({
      id: 'L1',
      step: 'Resolve the query',
      source: 'Open Targets · MONDO',
      unit: 'records',
      execution: {
        tool: 'opentargets.platform.search',
        query: '{"queryString":"Parkinson\'s disease","entityNames":["disease"]}',
        verified: human,
      },
      records: [{ value: 'MONDO:0005180 "Parkinson disease"', published: '2015-03-02' }],
    }),
    row({
      id: 'L2',
      step: 'Disease → targets with genetic evidence',
      source: 'Open Targets Platform',
      unit: 'targets',
      execution: {
        tool: 'opentargets.platform.associatedTargets',
        query: '{"efoId":"MONDO_0005180","datasourceIds":["ot_genetics_portal","eva","gene_burden"]}',
        verified: auto,
      },
      records: [
        { value: 'SNCA · genetic association', published: '1997-06-27' },
        { value: 'PRKN · genetic association', published: '1998-04-09' },
        { value: 'LRRK2 · genetic association', published: '2004-11-18' },
        { value: 'PINK1 · genetic association', published: '2004-05-21' },
        { value: 'GBA1 · genetic association', published: '2009-10-22' },
        { value: 'VPS35 · genetic association', published: '2011-07-15' },
        { value: 'ABL1 · mechanistic (c-Abl activation)', published: '2010-09-21' },
        { value: 'GLP1R · mechanistic', published: '2009-01-27' },
      ],
    }),
    row({
      id: 'L3',
      step: 'Targets → approved drugs',
      source: 'ChEMBL',
      unit: 'drugs',
      execution: {
        tool: 'chembl.mechanism',
        query: '{"target_chembl_id__in":["CHEMBL1862","CHEMBL1784","CHEMBL2001",...],"max_phase":4}',
        verified: auto,
      },
      records: [
        { value: 'nilotinib · ABL1 · approved 2007', published: '2007-10-29', source: 'fda-tasigna-2007' },
        { value: 'exenatide · GLP1R · approved 2005', published: '2005-04-28' },
        { value: 'isradipine · CACNA1D · approved 1990', published: '1990-12-21' },
        { value: 'simvastatin · HMGCR · approved 1991', published: '1991-12-23' },
        { value: 'metformin · (AMPK, indirect) · approved 1994', published: '1994-12-29' },
        { value: 'ambroxol · GBA (chaperone) · approved 1978 (EU)', published: '1978-01-01' },
      ],
    }),
    row({
      id: 'L4',
      step: 'Mechanism paths ≤ 4 hops',
      source: 'PrimeKG · Reactome',
      unit: 'paths',
      execution: {
        tool: 'primekg.shortest_paths',
        query: '{"from":"drug","to":"MONDO:0005180","max_hops":4}',
        verified: auto,
      },
      records: [
        { value: 'nilotinib → ABL1 → SNCA (phosphorylation) → PD', published: '2014-06-01' },
        { value: 'ambroxol → GBA → GCase → SNCA (lysosomal) → PD', published: '2014-05-01' },
        { value: 'exenatide → GLP1R → insulin signalling → PD', published: '2009-01-27' },
        { value: 'isradipine → CACNA1D → Ca2+ stress → PD', published: '2007-06-10' },
        { value: 'metformin → PRKAA1 (AMPK) → autophagy → PD', published: '2014-09-05' },
        { value: 'simvastatin → HMGCR → isoprenoids → PD', published: '2007-07-19' },
      ],
    }),
    row({
      id: 'L5',
      step: 'Registered trials, blinding and n extracted',
      source: 'ClinicalTrials.gov v2',
      unit: 'trials',
      execution: {
        tool: 'clinicaltrials.gov/api/v2/studies',
        query: '{"query.cond":"Parkinson\'s disease","query.intr":"nilotinib OR exenatide OR isradipine OR simvastatin OR metformin OR ambroxol"}',
        retry: { reason: '0 records for the free-text condition', query: '{"query.cond":"MONDO:0005180", ...}' },
        verified: human,
      },
      records: [
        { value: 'NCT02954978 · NILO-PD · phase 2 · n = 76 · blinded', published: '2016-11-04', source: 'nct02954978' },
        { value: 'Exenatide-PD (phase 2) · n = 62 · blinded', published: '2014-01-01', source: 'athauda-2017' },
        { value: 'Exenatide-PD3 · n = 194 · blinded', published: '2019-01-01', source: 'vijiaratnam-2025' },
        { value: 'STEADY-PD III · n = 336 · blinded', published: '2014-11-01', source: 'steady-pd-iii-2020' },
        { value: 'PD STAT · n = 235 · blinded', published: '2016-01-01', source: 'pd-stat-2024' },
        { value: 'AiM-PD · n = 17 · open-label', published: '2016-06-01', source: 'mullin-2020' },
        { value: 'ASPro-PD · phase 3 · enrolling', published: '2024-06-01', source: 'aspro-pd-2026' },
        { value: 'Metformin PD pilot · n = 60', published: '2023-01-01', source: 'metformin-pd-pilot-2025' },
      ],
    }),
    row({
      id: 'L6',
      step: 'Literature, study design classified',
      source: 'PubMed · Europe PMC',
      unit: 'papers',
      execution: {
        tool: 'europepmc.search',
        query: '("Parkinson disease"[MeSH]) AND (nilotinib OR exenatide OR isradipine OR simvastatin OR metformin OR ambroxol)',
        verified: human,
      },
      records: [
        { value: 'Kantarjian 2006 · NEJM · open-label', published: '2006-06-15', source: 'kantarjian-2006' },
        { value: 'Ko 2010 · PNAS · preclinical', published: '2010-09-21', source: 'ko-2010' },
        { value: 'Imam 2011 · J Neurosci · preclinical', published: '2011-01-05', source: 'imam-2011' },
        { value: 'Hebron 2013 · Hum Mol Genet · preclinical', published: '2013-08-15', source: 'hebron-2013' },
        { value: 'Karuppagounder 2014 · Sci Rep · preclinical', published: '2014-05-02', source: 'karuppagounder-2014' },
        { value: 'Mahul-Mellier 2014 · Hum Mol Genet · preclinical', published: '2014-06-01', source: 'mahul-mellier-2014' },
        { value: 'Pagan 2016 · J Parkinsons Dis · open-label, n = 12', published: '2016-07-11', source: 'pagan-2016' },
        { value: 'Schwarzschild 2016 · J Parkinsons Dis · commentary', published: '2016-12-01', source: 'schwarzschild-2016' },
        { value: 'Simuni 2021 · JAMA Neurol · RCT, blinded, n = 76', published: '2020-12-14', source: 'simuni-2021' },
        { value: 'Athauda 2017 · Lancet · RCT, blinded, n = 62', published: '2017-08-03', source: 'athauda-2017' },
        { value: 'Vijiaratnam 2025 · Lancet · RCT, blinded, n = 194', published: '2025-02-04', source: 'vijiaratnam-2025' },
        { value: 'Mullin 2020 · JAMA Neurol · open-label, n = 17', published: '2020-01-13', source: 'mullin-2020' },
      ],
    }),
    row({
      id: 'L7',
      step: 'CNS exposure',
      source: 'Published CSF/plasma ratios · P-gp status',
      unit: 'measurements',
      execution: {
        tool: 'europepmc.search + curated PK table',
        query: '(nilotinib OR exenatide OR isradipine OR simvastatin OR metformin OR ambroxol) AND ("cerebrospinal fluid" OR "CSF/plasma")',
        verified: human,
      },
      records: [
        { value: 'nilotinib · CSF/plasma 0.53 % (0.23–1.5 %) · Reinwald 2014', published: '2014-06-19', source: 'reinwald-2014' },
        { value: 'nilotinib · CSF a fraction of a percent of serum · NILO-PD PK 2020', published: '2020-04-14', source: 'nilo-pd-pk-2020' },
        { value: 'ambroxol · CSF detected, CSF GCase ↑ · AiM-PD 2020', published: '2020-01-13', source: 'mullin-2020' },
      ],
    }),
    row({
      id: 'L8',
      step: 'Safety in the likely population',
      source: 'openFDA labels · FAERS',
      unit: 'flags',
      execution: {
        tool: 'openfda.drug.label',
        query: '{"search":"openfda.generic_name:(nilotinib OR exenatide OR isradipine OR simvastatin OR metformin)","fields":["boxed_warning"]}',
        verified: human,
      },
      records: [{ value: 'nilotinib · boxed warning · QT prolongation and sudden deaths', published: '2007-10-29', source: 'fda-tasigna-2007' }],
    }),
    row({
      id: 'L9',
      step: 'Objections — each must cite a ledger line',
      source: 'elute appraisal',
      unit: 'objections',
      execution: { tool: 'elute.appraise', query: '{"rule":"discard any objection without a ledger citation"}', verified: human },
      records: [
        { value: 'nilotinib · brain exposure very low [L7]', published: '2014-06-19' },
        { value: 'nilotinib · efficacy signal uncontrolled [L6]', published: '2016-07-11' },
        { value: 'nilotinib · biomarker has an alternative explanation [L6]', published: '2016-12-01' },
        { value: 'nilotinib · controlled trial negative [L5, L7]', published: '2020-12-14' },
        { value: 'exenatide · phase 3 negative [L5]', published: '2025-02-04' },
        { value: 'isradipine · phase 3 negative [L5]', published: '2020-03-31' },
        { value: 'simvastatin · futility met [L5]', published: '2024-01-01' },
        { value: 'ambroxol · no controlled evidence yet [L5, L6]', published: '2020-01-13' },
        { value: 'metformin · pilot found no difference [L5]', published: '2025-02-20' },
      ],
    }),
    row({
      id: 'L10',
      step: 'Confidence drivers',
      source: 'elute appraisal',
      unit: 'candidates scored',
      execution: { tool: 'elute.drivers', query: '{"segments":["mechanism","clinical","exposure","safety"],"pips":3}', verified: human },
      records: [
        { value: 'ambroxol · mechanism 3 · clinical 1 · exposure 2 · safety 3', published: '2026-09-19' },
        { value: 'exenatide · 2 · 0 · 1 · 3', published: '2026-09-19' },
        { value: 'isradipine · 1 · 0 · 0 · 3', published: '2026-09-19' },
        { value: 'nilotinib · 3 · 0 · 1 · 1', published: '2026-09-19' },
        { value: 'simvastatin · 1 · 0 · 0 · 3', published: '2026-09-19' },
        { value: 'metformin · 1 · 0 · 0 · 3', published: '2026-09-19' },
      ],
    }),
  ],
}

/** Drug-first: the same ten steps, from the drug side. */
export const metforminLedger: Ledger = {
  kind: 'scripted',
  rows: [
    row({
      id: 'L1',
      step: 'Resolve the query',
      source: 'ChEMBL',
      unit: 'records',
      execution: { tool: 'chembl.molecule.search', query: '{"q":"metformin"}', verified: human },
      records: [{ value: 'CHEMBL1431 "METFORMIN" · biguanide · max phase 4', published: '1994-12-29' }],
    }),
    row({
      id: 'L2',
      step: 'Drug → targets and pathways',
      source: 'ChEMBL · Reactome',
      unit: 'targets',
      execution: { tool: 'chembl.mechanism', query: '{"molecule_chembl_id":"CHEMBL1431"}', verified: auto },
      records: [
        { value: 'PRKAA1/2 (AMPK) · indirect activation', published: '2001-10-01' },
        { value: 'Complex I · inhibition', published: '2000-01-15' },
        { value: 'mTOR · downstream inhibition', published: '2007-06-01' },
      ],
    }),
    row({
      id: 'L3',
      step: 'Targets → conditions with evidence',
      source: 'Open Targets Platform',
      unit: 'conditions',
      execution: { tool: 'opentargets.platform.associatedDiseases', query: '{"ensemblIds":["ENSG00000132356","ENSG00000162409"]}', verified: auto },
      records: [
        { value: 'Parkinson disease · MONDO:0005180', published: '2012-07-01' },
        { value: 'Alzheimer disease · MONDO:0004975', published: '2016-01-01' },
        { value: 'colorectal adenoma · MONDO:0002027', published: '2016-04-01' },
      ],
    }),
    row({
      id: 'L4',
      step: 'Mechanism paths ≤ 4 hops',
      source: 'PrimeKG · Reactome',
      unit: 'paths',
      execution: { tool: 'primekg.shortest_paths', query: '{"from":"CHEMBL1431","max_hops":4}', verified: auto },
      records: [
        { value: 'metformin → AMPK → autophagy → PD', published: '2014-09-05' },
        { value: 'metformin → AMPK → tau phosphorylation → AD', published: '2016-01-01' },
        { value: 'metformin → AMPK/mTOR → proliferation → colorectal adenoma', published: '2016-04-01' },
      ],
    }),
    row({
      id: 'L5',
      step: 'Registered trials, blinding and n extracted',
      source: 'ClinicalTrials.gov v2',
      unit: 'trials',
      execution: { tool: 'clinicaltrials.gov/api/v2/studies', query: '{"query.intr":"metformin","query.cond":"Parkinson OR Alzheimer OR adenoma"}', verified: human },
      records: [
        { value: 'Metformin PD pilot · n = 60 · randomised', published: '2023-01-01', source: 'metformin-pd-pilot-2025' },
        { value: 'Koenig crossover · n = 20 · blinded', published: '2013-01-01', source: 'koenig-2017' },
        { value: 'Luchsinger aMCI pilot · n = 80 · blinded', published: '2010-01-01', source: 'luchsinger-2016' },
        { value: 'Higurashi chemoprevention · n = 151 · blinded', published: '2011-01-01', source: 'higurashi-2016' },
      ],
    }),
    row({
      id: 'L6',
      step: 'Literature, study design classified',
      source: 'PubMed · Europe PMC',
      unit: 'papers',
      execution: { tool: 'europepmc.search', query: 'metformin AND (Parkinson OR Alzheimer OR "colorectal adenoma") AND (trial OR cohort)', verified: human },
      records: [
        { value: 'Wahlqvist 2012 · observational', published: '2012-07-01', source: 'wahlqvist-2012' },
        { value: 'Patil 2014 · preclinical', published: '2014-09-05', source: 'patil-2014' },
        { value: 'Luchsinger 2016 · RCT pilot, n = 80', published: '2016-01-01', source: 'luchsinger-2016' },
        { value: 'Higurashi 2016 · RCT, n = 151', published: '2016-04-01', source: 'higurashi-2016' },
        { value: 'Koenig 2017 · RCT crossover, n = 20', published: '2017-04-01', source: 'koenig-2017' },
        { value: 'Front Pharmacol 2025 · randomised pilot, n = 60', published: '2025-02-20', source: 'metformin-pd-pilot-2025' },
      ],
    }),
    row({
      id: 'L7',
      step: 'CNS exposure',
      source: 'Published CSF/plasma ratios · P-gp status',
      unit: 'measurements',
      execution: { tool: 'curated PK table', query: 'metformin AND "cerebrospinal fluid"', verified: human },
      records: [],
    }),
    row({
      id: 'L8',
      step: 'Safety in the likely population',
      source: 'openFDA labels · FAERS',
      unit: 'flags',
      execution: { tool: 'openfda.drug.label', query: '{"search":"openfda.generic_name:metformin","fields":["boxed_warning"]}', verified: human },
      records: [{ value: 'metformin · boxed warning · lactic acidosis (renal impairment)', published: '1994-12-29' }],
    }),
    row({
      id: 'L9',
      step: 'Objections — each must cite a ledger line',
      source: 'elute appraisal',
      unit: 'objections',
      execution: { tool: 'elute.appraise', query: '{"rule":"discard any objection without a ledger citation"}', verified: human },
      records: [
        { value: 'PD · only trial found no difference [L5]', published: '2025-02-20' },
        { value: 'AD · small mixed pilots [L5]', published: '2017-04-01' },
        { value: 'colorectal adenoma · single trial, surrogate endpoint [L5]', published: '2016-04-01' },
      ],
    }),
    row({
      id: 'L10',
      step: 'Confidence drivers',
      source: 'elute appraisal',
      unit: 'conditions scored',
      execution: { tool: 'elute.drivers', query: '{"segments":["mechanism","clinical","exposure","safety"],"pips":3}', verified: human },
      records: [
        { value: 'Parkinson’s · 1 · 0 · 0 · 3', published: '2026-09-19' },
        { value: 'Alzheimer’s · 1 · 1 · 0 · 3', published: '2026-09-19' },
        { value: 'colorectal adenoma · 1 · 2 · 1 · 3', published: '2026-09-19' },
      ],
    }),
  ],
}
