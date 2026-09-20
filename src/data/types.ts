/* elute — the fixture contract (spec §7).
 * Every evidence-bearing value carries a date; the UI resolves everything at a cutoff.
 * Dates are ISO YYYY-MM-DD. */

export type ISODate = string
export type SourceId = string
export type ClaimId = string
export type LedgerRowId = string
export type QuerySlug = string
export type CandidateSlug = string

export type Label = 'established' | 'contested' | 'single-source' | 'unknown' | 'refuted'
export type Pips = 0 | 1 | 2 | 3

/** Pick the last entry with `from <= cutoff`; undefined before the first entry. */
export type Timeline<T> = { from: ISODate; value: T }[]

// ---- Entities ---------------------------------------------------------------

export type EntityKind = 'condition' | 'drug' | 'pair'
export type Entity = {
  slug: QuerySlug
  name: string
  kind: EntityKind
  ids: Record<string, string>
  aliases: string[]
}
export type EntityIndex = { entities: Entity[] }

// ---- Ledger -----------------------------------------------------------------

export type LedgerRecord = { value: string; published: ISODate; source?: SourceId }

export type LedgerRow = {
  id: LedgerRowId // "L1".."L10"
  step: string
  source: string
  unit: string // "targets", "trials", "records": the noun for the derived count
  elapsed_ms?: number // only when the ledger is recorded
  execution: {
    tool: string
    query: string
    run_at: string
    retry?: { reason: string; query: string } // the self-correction; no count of its own
    verified: { by: 'human' | 'automated'; date?: ISODate; initials?: string }
  }
  records: LedgerRecord[] // dated claims, filtered by cutoff. There is no stored count.
}

export type Ledger = {
  kind: 'recorded' | 'scripted'
  recorded_total_ms?: number
  rows: LedgerRow[]
}

export type LedgerEvent = { row: LedgerRow; done: boolean }

// ---- Sources ----------------------------------------------------------------

export type SourceDesign =
  | 'rct'
  | 'open-label'
  | 'pk'
  | 'commentary'
  | 'observational'
  | 'preclinical'
  | 'protocol'
  | 'label'
  | 'regulatory'
  | 'meta-analysis'

export type Source = {
  id: SourceId
  first_author: string
  journal: string
  year: number
  published: ISODate
  title?: string
  design: SourceDesign
  controlled: boolean
  blinded?: boolean
  n?: number
  outcome?: 'positive' | 'negative' | 'mixed' | 'na'
  group: string // the lab or organisation; independence is counted by distinct groups
  url: string
  ledger: LedgerRowId
}

// ---- Candidate --------------------------------------------------------------

export type Cutoff = { id: string; label: string; date: ISODate; note: string }

export type Objection = {
  id: string
  consequence_rank: number
  claim: string
  evidence: string // one sentence; the figure below is bolded inside it
  figure?: string
  published: ISODate
  sources: SourceId[]
  cites: LedgerRowId[]
}

export type EvidenceDirection = 'supports' | 'contradicts' | 'refutes'
export type ClaimEvidence = { source: SourceId; direction: EvidenceDirection }

export type Claim = {
  id: ClaimId
  node: string // the node this claim arrives at, drawn as a box: "ABL1", "brain exposure"
  short: string // the link's caption under the label word: "inhibits ABL1"
  text: string // the full claim
  scope?: string // e.g. "in mouse models", shown after the label word
  genes?: string[] // HGNC symbols the node stands for; lets the pathway layer match curated targets
  evidence: ClaimEvidence[]
  override?: Timeline<{ label: Label; why: string }>
}

export type Chain = { drug: string; condition: string; claims: Claim[] }

// ---- Pathway drawing ------------------------------------------------------------------
// The hypothesis drawn as biology: compartments the drug must cross, molecules, and actions.
// Every action that is part of the hypothesis points at the chain claim that carries its evidence,
// so its label and sources are derived, never restated. Actions without a claim are background
// biology nobody disputes, drawn in the quiet register.

export type MoleculeKind = 'drug' | 'protein' | 'process' | 'cell' | 'outcome'
export type ActionKind = 'inhibits' | 'activates' | 'phosphorylates' | 'promotes' | 'prevents' | 'crosses' | 'improves' | 'causes'

export type Compartment = { id: string; label: string }
export type Molecule = { id: string; label: string; kind: MoleculeKind; compartment: string; at: [number, number] } // at: unit square
export type Action = { id: string; from: string; to: string; kind: ActionKind; word: string; claim?: ClaimId; arc?: number }
export type PathwayDrawing = { compartments: Compartment[]; molecules: Molecule[]; actions: Action[] }

/** How the drug has to reach the target: the fine print under the pathway (Henry, second meeting). */
export type Delivery = {
  route: string // "oral"
  compartment: string // where the target sits: "intracellular kinase; cytosol and nucleus"
  barrier: string // "blood–brain barrier; CSF/plasma 0.53 %"
  sources: SourceId[]
}

export type Safety = {
  severity: 'boxed' | 'warning' | 'none' // none: the label was reviewed and nothing is flagged
  flag: string // "QT prolongation", or "no boxed warning" when severity is none
  kind: string // "boxed warning", "label warning", "label reviewed"
  reason: string // one line beside the word
  population: string // two sentences on the likely trial population
  sources: SourceId[]
}

export type PrerequisiteStatus = {
  resolution: 'met' | 'conditional' | 'unmet'
  word: string // "not shown", "no", "none", "contested", "with monitoring"
  note: string
  sources: SourceId[]
}
export type Prerequisite = { id: string; condition: string; status: Timeline<PrerequisiteStatus> }

export type TrialStage = 'preclinical' | 'open-label' | 'phase-2' | 'phase-3-enrolling' | 'phase-3'

export type BestEvidence = {
  design: string
  controlled: boolean
  outcome: 'positive' | 'negative' | 'mixed' | 'none'
  n?: number
  source?: SourceId
  stage: TrialStage // the most decisive study that exists, enrolling included: the board column
  label?: string // "NILO-PD 2021 · Georgetown 2020"
}

export type CandidateDetail = {
  slug: CandidateSlug
  name: string
  drug_class: string
  approved_indication: string
  condition: string
  condition_slug: QuerySlug
  drug_slug: QuerySlug
  mechanism: string // the one-liner on the row: "nilotinib → ABL1 → α-synuclein clearance"
  chembl_id?: string // lets the pathway layer ask Open Targets for the drug's curated targets and pathways
  delivery?: Delivery
  drawing?: PathwayDrawing // the hypothesis as biology; without it the pathway panel draws the chain
  curation: 'curated' | 'draft' // draft: structurally complete, sources not yet verified by a human
  cutoffs: Cutoff[]
  sources: Source[]
  objections: Objection[]
  chain: Chain
  safety?: Timeline<Safety>
  prerequisites: Prerequisite[]
  drivers: { mechanism: Pips; clinical: Pips; exposure: Pips; safety: Pips }
  best_evidence: Timeline<BestEvidence>
  weakest_link: Timeline<{ claim: ClaimId; why: string; sources: SourceId[] }>
  counts: { sources: number; trials: number }
}

// ---- Query and results ------------------------------------------------------

export type QueryRecord = {
  slug: QuerySlug
  kind: EntityKind
  heading: string
  resolved: string // "MONDO:0005180 · resolved via Open Targets"
  subheading?: string // drug-first: class · approved indication
  ledger: Ledger
  candidates: CandidateSlug[]
  /** For a pair query: the single candidate to open directly. */
  pair?: { candidate: CandidateSlug; condition: QuerySlug }
}

export type ResultsPage = {
  query: QueryRecord
  today: ISODate
  candidates: CandidateDetail[]
}

export type Provenance = {
  today: ISODate
  summary: string
  production_sources: string[]
  curated: string[]
  synthetic: string[]
  label_overrides: { candidate: string; claim: string; why: string }[]
  curatorial_decisions: string[]
}
