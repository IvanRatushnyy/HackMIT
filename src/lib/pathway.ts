/* elute — the pathway layer (Henry, second meeting: "this is the pathway, this is what we think,
 * here are the experiments that confirm each step; then it's a story, not a collection of data").
 *
 * The curated context comes from Open Targets (drug → mechanism → targets → Reactome pathways,
 * tractability, subcellular location) and Reactome's diagram exporter, both keyless and fetched
 * live in the browser. STRING is the fallback picture. Everything that is not a fetch is a pure
 * function of data, so it is testable and the hypothesis chain still renders offline. */

import type { Claim } from '../data/types'

// ---- Open Targets ---------------------------------------------------------------------

export type OTPathway = { pathwayId: string; pathway: string; topLevelTerm: string }
export type OTTractability = { label: string; modality: string; value: boolean }
export type OTLocation = { location: string; source: string }
export type OTTarget = {
  id: string
  approvedSymbol: string
  pathways: OTPathway[]
  tractability: OTTractability[]
  subcellularLocations: OTLocation[]
}
export type OTMechanism = { mechanismOfAction: string; actionType: string; targets: OTTarget[] }
export type DrugContext = { name: string; mechanisms: OTMechanism[]; fetched_at: string }

export const OT_ENDPOINT = 'https://api.platform.opentargets.org/api/v4/graphql'

export const OT_QUERY = `query DrugContext($chemblId: String!) {
  drug(chemblId: $chemblId) {
    name
    mechanismsOfAction {
      rows {
        mechanismOfAction
        actionType
        targets {
          id
          approvedSymbol
          pathways { pathwayId pathway topLevelTerm }
          tractability { label modality value }
          subcellularLocations { location source }
        }
      }
    }
  }
}`

const CACHE_PREFIX = 'elute:ot:'

function readCache(key: string): DrugContext | undefined {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key)
    return raw ? (JSON.parse(raw) as DrugContext) : undefined
  } catch {
    return undefined
  }
}

function writeCache(key: string, ctx: DrugContext) {
  try {
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(ctx))
  } catch {
    /* storage unavailable: the fetch still succeeded */
  }
}

/** Fetch the drug's curated context. Resolves within `timeoutMs` or throws; never returns a partial object. */
export async function fetchDrugContext(chemblId: string, timeoutMs = 6000): Promise<DrugContext> {
  const cached = readCache(chemblId)
  if (cached) return cached
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(OT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: OT_QUERY, variables: { chemblId } }),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`Open Targets ${res.status}`)
    const json = (await res.json()) as { data?: { drug?: { name: string; mechanismsOfAction: { rows: OTMechanism[] } } }; errors?: unknown }
    const drug = json.data?.drug
    if (!drug) throw new Error('Open Targets returned no drug')
    const ctx: DrugContext = { name: drug.name, mechanisms: drug.mechanismsOfAction.rows, fetched_at: new Date().toISOString() }
    writeCache(chemblId, ctx)
    return ctx
  } finally {
    clearTimeout(timer)
  }
}

// ---- Pure helpers -----------------------------------------------------------------------

/** Distinct targets across all mechanisms, first appearance wins. */
export function primaryTargets(ctx: DrugContext): OTTarget[] {
  const seen = new Set<string>()
  const out: OTTarget[] = []
  for (const m of ctx.mechanisms)
    for (const t of m.targets) {
      if (seen.has(t.approvedSymbol)) continue
      seen.add(t.approvedSymbol)
      out.push(t)
    }
  return out
}

export const PREFERRED_TERMS = ['Neuronal System', 'Signal Transduction', 'Autophagy', 'Programmed Cell Death', 'Cellular responses to stimuli']

/** Pathways worth drawing first: preferred top-level terms, then the rest, each group in the given order. */
export function orderPathways(pathways: OTPathway[], prefer: string[] = PREFERRED_TERMS): OTPathway[] {
  const rank = (p: OTPathway) => {
    const i = prefer.indexOf(p.topLevelTerm)
    return i === -1 ? prefer.length : i
  }
  return [...pathways].sort((a, b) => rank(a) - rank(b))
}

/** Does any curated pathway name mention the hypothesis? (For nilotinib: none does. That is the point.) */
export function pathwaysMentioning(pathways: OTPathway[], terms: string[]): OTPathway[] {
  const t = terms.map((x) => x.toLowerCase())
  return pathways.filter((p) => t.some((term) => p.pathway.toLowerCase().includes(term)))
}

export type ReactomeFormat = 'png' | 'svg' | 'pptx'

export function reactomeDiagramUrl(pathwayId: string, opts: { flag?: string; format?: ReactomeFormat; quality?: number } = {}): string {
  const { flag, format = 'png', quality = 5 } = opts
  const q = new URLSearchParams()
  q.set('quality', String(quality))
  q.set('diagramProfile', 'standard')
  if (flag) q.set('flg', flag)
  return `https://reactome.org/ContentService/exporter/diagram/${encodeURIComponent(pathwayId)}.${format}?${q.toString()}`
}

export function reactomeBrowserUrl(pathwayId: string, flag?: string): string {
  return `https://reactome.org/PathwayBrowser/#/${encodeURIComponent(pathwayId)}${flag ? `&FLG=${encodeURIComponent(flag)}` : ''}`
}

export function stringNetworkUrl(genes: string[], opts: { species?: number; whiteNodes?: number } = {}): string {
  const { species = 9606, whiteNodes = 5 } = opts
  const q = new URLSearchParams()
  q.set('identifiers', genes.join('\r'))
  q.set('species', String(species))
  q.set('add_white_nodes', String(whiteNodes))
  q.set('network_flavor', 'confidence')
  q.set('caller_identity', 'elute')
  return `https://string-db.org/api/svg/network?${q.toString()}`
}

/** Every gene symbol the chain names, in chain order, distinct. */
export function chainGenes(claims: Claim[]): string[] {
  const out: string[] = []
  for (const c of claims) for (const g of c.genes ?? []) if (!out.includes(g)) out.push(g)
  return out
}

export type EdgeCuration = { kind: 'mechanism' | 'uncurated'; text: string }

/** Is this link curated biology or the hypothesis? Only the drug → target link can be curated by ChEMBL;
 * every later link stands on the papers cited for it, which is what the label rules score. */
export function edgeCuration(claim: Claim, index: number, targets: OTTarget[] | undefined): EdgeCuration {
  const symbols = new Set((targets ?? []).map((t) => t.approvedSymbol))
  const hits = (claim.genes ?? []).filter((g) => symbols.has(g))
  if (index === 0 && hits.length > 0) return { kind: 'mechanism', text: 'ChEMBL mechanism of action' }
  const n = claim.evidence.length
  return { kind: 'uncurated', text: `not a curated pathway, ${n} ${n === 1 ? 'source' : 'sources'}` }
}

const MODALITY_WORD: Record<string, string> = { SM: 'small molecule', AB: 'antibody', PR: 'PROTAC', OC: 'other' }

const MODALITY_PRIORITY: Record<string, string[]> = {
  SM: ['Approved Drug', 'Advanced Clinical', 'Phase 1 Clinical', 'Structure with Ligand', 'High-Quality Ligand', 'High-Quality Pocket', 'Med-Quality Pocket', 'Druggable Family'],
  AB: ['Approved Drug', 'Advanced Clinical', 'Phase 1 Clinical', 'UniProt loc high conf', 'GO CC high conf', 'UniProt loc med conf', 'UniProt SigP or TMHMM', 'GO CC med conf', 'Human Protein Atlas loc'],
  PR: ['Approved Drug', 'Advanced Clinical', 'Phase 1 Clinical', 'Literature', 'UniProt Ubiquitination', 'Database Ubiquitination', 'Half-life Data', 'Small Molecule Binder'],
}

/** One phrase per modality: the strongest true bucket Open Targets reports, in its own words. */
export function tractabilitySummary(t: Pick<OTTarget, 'tractability'>): { modality: string; bucket: string }[] {
  return Object.keys(MODALITY_PRIORITY).map((code) => {
    const truthy = new Set(t.tractability.filter((x) => x.modality === code && x.value).map((x) => x.label))
    const bucket = MODALITY_PRIORITY[code].find((b) => truthy.has(b))
    return { modality: MODALITY_WORD[code] ?? code, bucket: bucket ? bucket.toLowerCase() : 'none' }
  })
}

/** Distinct UniProt-sourced locations, first three, lower-cased. */
export function compartmentSummary(t: Pick<OTTarget, 'subcellularLocations'>): string[] {
  const out: string[] = []
  for (const l of t.subcellularLocations) {
    if (l.source !== 'uniprot') continue
    const word = l.location.split(';')[0].split(',')[0].trim().toLowerCase()
    if (word && !out.includes(word)) out.push(word)
    if (out.length === 3) break
  }
  return out
}

// ---- Drawing validation -------------------------------------------------------------

import type { PathwayDrawing } from '../data/types'

/** Every reference in a drawing must resolve; a hypothesis action must point at a chain claim. */
export function validateDrawing(d: PathwayDrawing, claims: Claim[]): string[] {
  const problems: string[] = []
  const comp = new Set(d.compartments.map((c) => c.id))
  const mol = new Set(d.molecules.map((m) => m.id))
  const claim = new Set(claims.map((c) => c.id))
  for (const m of d.molecules) {
    if (!comp.has(m.compartment)) problems.push(`molecule ${m.id}: unknown compartment ${m.compartment}`)
    if (m.at.some((v) => v < 0 || v > 1)) problems.push(`molecule ${m.id}: position outside the unit square`)
  }
  for (const a of d.actions) {
    if (!mol.has(a.from)) problems.push(`action ${a.id}: unknown molecule ${a.from}`)
    if (!mol.has(a.to)) problems.push(`action ${a.id}: unknown molecule ${a.to}`)
    if (a.claim && !claim.has(a.claim)) problems.push(`action ${a.id}: unknown claim ${a.claim}`)
  }
  const covered = new Set(d.actions.map((a) => a.claim).filter(Boolean))
  for (const c of claims) if (!covered.has(c.id)) problems.push(`claim ${c.id} is not drawn by any action`)
  return problems
}
