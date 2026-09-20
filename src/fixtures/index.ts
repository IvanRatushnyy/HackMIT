/* elute — the fixture: entity index, queries, candidates, provenance. */

import type { CandidateDetail, Entity, Provenance, QueryRecord } from '../data/types'
import { nilotinib } from './nilotinib'
import { ambroxol, exenatide, isradipine, metforminAd, metforminCrc, metforminPd, simvastatin } from './drafts'
import { metforminLedger, parkinsonsLedger } from './ledgers'

export const TODAY = '2026-09-19'

export const candidates: CandidateDetail[] = [
  nilotinib,
  ambroxol,
  exenatide,
  isradipine,
  simvastatin,
  metforminPd,
  metforminAd,
  metforminCrc,
]

export const entities: Entity[] = [
  {
    slug: 'parkinsons-disease',
    name: 'Parkinson’s disease',
    kind: 'condition',
    ids: { MONDO: 'MONDO:0005180', EFO: 'EFO_0002508' },
    aliases: ['parkinson', "parkinson's disease", 'parkinson disease', 'pd', 'parkinsons'],
  },
  {
    slug: 'metformin',
    name: 'Metformin',
    kind: 'drug',
    ids: { ChEMBL: 'CHEMBL1431' },
    aliases: ['metformin', 'glucophage'],
  },
  {
    slug: 'nilotinib--parkinsons-disease',
    name: 'Nilotinib for Parkinson’s disease',
    kind: 'pair',
    ids: { ChEMBL: 'CHEMBL255863', MONDO: 'MONDO:0005180' },
    aliases: ['nilotinib', 'tasigna', 'nilotinib parkinson', "nilotinib for parkinson's"],
  },
]

export const queries: QueryRecord[] = [
  {
    slug: 'parkinsons-disease',
    kind: 'condition',
    heading: 'Parkinson’s disease',
    resolved: 'MONDO:0005180 · resolved via Open Targets',
    ledger: parkinsonsLedger,
    candidates: [
      'ambroxol--parkinsons-disease',
      'exenatide--parkinsons-disease',
      'isradipine--parkinsons-disease',
      'nilotinib--parkinsons-disease',
      'simvastatin--parkinsons-disease',
      'metformin--parkinsons-disease',
    ],
  },
  {
    slug: 'metformin',
    kind: 'drug',
    heading: 'Metformin',
    resolved: 'CHEMBL1431 · resolved via ChEMBL',
    subheading: 'biguanide · approved for type 2 diabetes',
    ledger: metforminLedger,
    candidates: ['metformin--parkinsons-disease', 'metformin--alzheimers-disease', 'metformin--colorectal-adenoma'],
  },
  {
    slug: 'nilotinib--parkinsons-disease',
    kind: 'pair',
    heading: 'Nilotinib for Parkinson’s disease',
    resolved: 'CHEMBL255863 × MONDO:0005180 · resolved via ChEMBL and Open Targets',
    ledger: parkinsonsLedger,
    candidates: ['nilotinib--parkinsons-disease'],
    pair: { candidate: 'nilotinib', condition: 'parkinsons-disease' },
  },
]

export const provenance: Provenance = {
  today: TODAY,
  summary:
    'Fixture mode · not a clinical decision tool · curated from dated public sources; draft and synthetic values are marked. Would run on Open Targets, ChEMBL, ClinicalTrials.gov, PubMed, openFDA and All of Us.',
  production_sources: [
    'Open Targets Platform and Reactome, fetched live by the pathway panel (drug → targets → curated pathways, tractability, subcellular location; diagram export); STRING as the fallback picture',
    'Open Targets Platform (disease → target genetic evidence; identifier resolution)',
    'ChEMBL (target → approved drug, mechanism of action)',
    'PrimeKG and Reactome (mechanism paths)',
    'ClinicalTrials.gov API v2 (registered trials, blinding, enrolment)',
    'PubMed and Europe PMC (literature; study design classified)',
    'Published pharmacokinetic tables (CSF/plasma ratios, P-gp status)',
    'openFDA drug labels and FAERS (boxed warnings, adverse events)',
    'All of Us (population safety and co-medication in the likely trial population)',
  ],
  curated: ['Nilotinib for Parkinson’s disease — every source dated and linked; labels hand-checked at three cutoffs.'],
  synthetic: [
    'The evidence ledger is a scripted sequence with real source names, not a recorded live run; there are no elapsed times.',
    'Draft candidates (ambroxol, exenatide, isradipine, simvastatin; metformin for Parkinson’s, Alzheimer’s and colorectal adenoma) were entered from memory of the literature and are not yet verified against the papers. Where a citation is uncertain the link is a PubMed search rather than an identifier.',
    'Driver pips for every candidate are curatorial judgements, shown as such.',
  ],
  label_overrides: [
    {
      candidate: 'ambroxol',
      claim: 'GBA1 variants reduce glucocerebrosidase activity and raise Parkinson’s risk',
      why: 'A 16-centre genetic analysis of 5,691 patients; the association has since been replicated in every large cohort. Entered as an override because only the index study is in the fixture.',
    },
  ],
  curatorial_decisions: [
    'NILO-PD’s CSF concentrations are entered as “contradicts”, not “refutes”, on the exposure claim: exposure was measured, not tested as a pre-specified endpoint. The clinical-benefit claim carries the “refutes” entry.',
    'The MAO-B withdrawal commentary is entered as “contradicts” on the clinical-benefit claim, because it undermines the pilot’s biomarker evidence for benefit.',
    '“Conditional” prerequisite statuses (e.g. safety acceptable with monitoring) count as resolved when ordering results.',
  ],
}
