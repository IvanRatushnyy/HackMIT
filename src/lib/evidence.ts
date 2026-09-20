/* elute — pure evidence logic (spec §7.3).
 * Everything here is a function of data and a cutoff date. No React, no fetch. */

import type {
  BestEvidence,
  CandidateDetail,
  Claim,
  Cutoff,
  ISODate,
  Label,
  LedgerRow,
  Objection,
  Prerequisite,
  PrerequisiteStatus,
  Source,
  Timeline,
} from '../data/types'

// ---- Timelines and dates ----------------------------------------------------

export function resolveTimeline<T>(timeline: Timeline<T> | undefined, cutoff: ISODate): T | undefined {
  if (!timeline) return undefined
  let hit: T | undefined
  for (const entry of timeline) {
    if (entry.from <= cutoff) hit = entry.value
    else break
  }
  return hit
}

export function visibleAt<T extends { published: ISODate }>(items: T[], cutoff: ISODate): T[] {
  return items.filter((item) => item.published <= cutoff)
}

export function findCutoff(candidate: CandidateDetail, id: string | null | undefined): Cutoff {
  const today = candidate.cutoffs[candidate.cutoffs.length - 1]
  if (!id) return today
  return candidate.cutoffs.find((c) => c.id === id) ?? today
}

export function isToday(candidate: CandidateDetail, cutoff: Cutoff): boolean {
  return cutoff.id === candidate.cutoffs[candidate.cutoffs.length - 1].id
}

// ---- Labels -----------------------------------------------------------------

export type LabelResult = {
  label: Label
  why: string
  rule: 'override' | 'unknown' | 'refuted' | 'contested' | 'established' | 'single-source'
  qualifier?: string
  supports: Source[]
  against: Source[] // contradicts + refutes
}

function byId(sources: Source[]) {
  const map = new Map<string, Source>()
  for (const s of sources) map.set(s.id, s)
  return map
}

function designWord(s: Source): string {
  switch (s.design) {
    case 'rct':
      return s.blinded ? 'blinded randomised trial' : 'randomised trial'
    case 'open-label':
      return 'open-label study'
    case 'pk':
      return 'pharmacokinetic measurement'
    case 'commentary':
      return 'peer commentary'
    case 'preclinical':
      return 'preclinical study'
    case 'observational':
      return 'observational study'
    case 'protocol':
      return 'registered protocol'
    case 'label':
      return 'approved product label'
    case 'regulatory':
      return 'regulatory decision'
    case 'meta-analysis':
      return 'meta-analysis'
  }
}

export function singleSourceQualifier(s: Source): string {
  const parts: string[] = []
  if (s.n !== undefined) parts.push(`n = ${s.n}`)
  if (s.design === 'rct') parts.push(s.blinded ? 'blinded' : 'unblinded')
  else if (s.design === 'open-label') parts.push('open-label')
  else parts.push(designWord(s))
  parts.push('not replicated')
  return parts.join(', ')
}

/** Spec §7.3, rules 1–6, evaluated in order. */
export function deriveLabel(claim: Claim, sources: Source[], cutoff: ISODate): LabelResult {
  const index = byId(sources)
  const visible = claim.evidence
    .map((e) => ({ ...e, source: index.get(e.source) }))
    .filter((e): e is { source: Source; direction: typeof e.direction } => !!e.source && e.source.published <= cutoff)

  const supports = visible.filter((e) => e.direction === 'supports').map((e) => e.source)
  const contradicts = visible.filter((e) => e.direction === 'contradicts').map((e) => e.source)
  const refutes = visible.filter((e) => e.direction === 'refutes').map((e) => e.source)
  const against = [...refutes, ...contradicts]

  // 1. Override
  const override = resolveTimeline(claim.override, cutoff)
  if (override) return { label: override.label, why: override.why, rule: 'override', supports, against }

  // 2. Unknown
  if (visible.length === 0) {
    return {
      label: 'unknown',
      why: 'Nothing published on or before this date tests or supports this claim.',
      rule: 'unknown',
      supports,
      against,
    }
  }

  // 3. Refuted
  if (refutes.length > 0) {
    const r = refutes[0]
    return {
      label: 'refuted',
      why: `Tested directly in a ${designWord(r)}${r.n ? ` of ${r.n}` : ''} (${r.first_author}, ${r.year}) and found false.`,
      rule: 'refuted',
      supports,
      against,
    }
  }

  // 4. Contested
  if (contradicts.length > 0) {
    const why =
      supports.length > 0
        ? `Evidence on both sides: ${supports.length} source${supports.length > 1 ? 's' : ''} support${supports.length > 1 ? '' : 's'} it and ${contradicts.length} argue${contradicts.length > 1 ? '' : 's'} against it.`
        : `No published evidence supports this claim; ${contradicts.length} source${contradicts.length > 1 ? 's' : ''} argue${contradicts.length > 1 ? '' : 's'} against it.`
    return { label: 'contested', why, rule: 'contested', supports, against }
  }

  // 5. Established
  const groups = new Set(supports.map((s) => s.group))
  const regulatory = supports.find((s) => s.design === 'regulatory' || s.design === 'label')
  if (groups.size >= 2 || regulatory) {
    const why = regulatory
      ? `Accepted by a regulator (${regulatory.first_author}, ${regulatory.year})${groups.size > 1 ? ` and reported by ${groups.size} independent groups` : ''}.`
      : `Reported by ${groups.size} independent groups (${supports.map((s) => `${s.first_author} ${s.year}`).join('; ')}), none contradicting${claim.scope ? `, ${claim.scope}` : ''}.`
    return { label: 'established', why, rule: 'established', supports, against, qualifier: claim.scope }
  }

  // 6. Single-source
  const s = supports[0]
  return {
    label: 'single-source',
    why: `One group reports this (${s.first_author}, ${s.year}, ${designWord(s)}${s.n ? ` of ${s.n}` : ''}); nothing published on or before this date replicates or contradicts it.`,
    rule: 'single-source',
    qualifier: singleSourceQualifier(s),
    supports,
    against,
  }
}

/** Ordering for the chain filter and the "weakest" fallback. Higher = weaker. */
export const LABEL_SEVERITY: Record<Label, number> = {
  established: 0,
  unknown: 1,
  contested: 2,
  'single-source': 3,
  refuted: 4,
}

// ---- Prerequisites and ordering ---------------------------------------------

export function resolvePrerequisite(p: Prerequisite, cutoff: ISODate): PrerequisiteStatus | undefined {
  return resolveTimeline(p.status, cutoff)
}

/** Unresolved = unmet. Conditional counts as resolved and shows its word. */
export function unresolvedCount(candidate: CandidateDetail, cutoff: ISODate): number {
  return candidate.prerequisites.filter((p) => resolvePrerequisite(p, cutoff)?.resolution === 'unmet').length
}

export function todayDate(candidate: CandidateDetail): ISODate {
  return candidate.cutoffs[candidate.cutoffs.length - 1].date
}

/** Results order: fewest unresolved prerequisites at Today, then more sources, then name. */
export function orderCandidates(candidates: CandidateDetail[]): CandidateDetail[] {
  return [...candidates].sort((a, b) => {
    const ua = unresolvedCount(a, todayDate(a))
    const ub = unresolvedCount(b, todayDate(b))
    if (ua !== ub) return ua - ub
    if (a.counts.sources !== b.counts.sources) return b.counts.sources - a.counts.sources
    return a.name.localeCompare(b.name)
  })
}

// ---- Objections, best evidence, safety --------------------------------------

export function visibleObjections(candidate: CandidateDetail, cutoff: ISODate): Objection[] {
  return visibleAt(candidate.objections, cutoff).sort((a, b) => a.consequence_rank - b.consequence_rank)
}

export function bestEvidenceAt(candidate: CandidateDetail, cutoff: ISODate): BestEvidence | undefined {
  return resolveTimeline(candidate.best_evidence, cutoff)
}

// ---- Scatter mapping (spec §4.2): exhaustive over controlled × outcome -------

export const CLINICAL_LEVELS = [
  'controlled negative',
  'uncontrolled negative',
  'no human test',
  'uncontrolled positive or mixed',
  'controlled positive or mixed',
] as const

export function clinicalLevel(b: BestEvidence): number {
  if (b.outcome === 'none') return 2
  if (b.outcome === 'negative') return b.controlled ? 0 : 1
  return b.controlled ? 4 : 3
}

// ---- Ledger -----------------------------------------------------------------

export function ledgerCount(row: LedgerRow, cutoff: ISODate): number {
  return row.records.filter((r) => r.published <= cutoff).length
}

export function ledgerResult(row: LedgerRow, cutoff: ISODate): string {
  const n = ledgerCount(row, cutoff)
  return `${n} ${n === 1 ? singular(row.unit) : row.unit}`
}

function singular(unit: string): string {
  if (unit.endsWith('ies')) return unit.slice(0, -3) + 'y'
  if (unit.endsWith('s')) return unit.slice(0, -1)
  return unit
}

// ---- Publishability (spec §7.5) --------------------------------------------

export function validateCandidate(c: CandidateDetail): string[] {
  const problems: string[] = []
  const sourceIds = new Set(c.sources.map((s) => s.id))
  const claimIds = new Set(c.chain.claims.map((k) => k.id))
  const need = (cond: boolean, msg: string) => {
    if (!cond) problems.push(msg)
  }

  need(c.cutoffs.length >= 1, 'no cutoffs')
  need(c.chain.claims.length >= 1, 'chain has no claims')
  need(c.prerequisites.length === 5, `expected 5 prerequisites, found ${c.prerequisites.length}`)
  need(c.objections.length >= 1, 'no objections')

  for (const s of c.sources) {
    need(!!s.published && !!s.group && !!s.url && !!s.ledger, `source ${s.id} missing published/group/url/ledger`)
  }
  const checkRefs = (ids: string[], where: string) => {
    for (const id of ids) need(sourceIds.has(id), `${where} references unknown source ${id}`)
  }
  for (const o of c.objections) checkRefs(o.sources, `objection ${o.id}`)
  for (const k of c.chain.claims) {
    checkRefs(
      k.evidence.map((e) => e.source),
      `claim ${k.id}`,
    )
    for (const e of k.evidence) {
      if (e.direction === 'refutes') {
        const s = c.sources.find((x) => x.id === e.source)
        need(
          !!s && s.controlled && s.blinded === true && s.outcome === 'negative',
          `claim ${k.id}: 'refutes' on ${e.source} requires a controlled, blinded, negative source`,
        )
      }
    }
  }

  for (const cutoff of c.cutoffs) {
    const d = cutoff.date
    for (const p of c.prerequisites) {
      need(!!resolvePrerequisite(p, d), `prerequisite ${p.id} has no status at ${cutoff.id}`)
    }
    need(!!bestEvidenceAt(c, d), `best_evidence unresolved at ${cutoff.id}`)
    const w = resolveTimeline(c.weakest_link, d)
    need(!!w, `weakest_link unresolved at ${cutoff.id}`)
    if (w) {
      need(claimIds.has(w.claim), `weakest_link at ${cutoff.id} points at unknown claim ${w.claim}`)
      need(!!w.why, `weakest_link at ${cutoff.id} has no why`)
      checkRefs(w.sources, `weakest_link at ${cutoff.id}`)
    }
    for (const k of c.chain.claims) {
      const r = deriveLabel(k, c.sources, d)
      need(!!r.label, `claim ${k.id} not labelable at ${cutoff.id}`)
    }
  }

  const today = todayDate(c)
  const be = bestEvidenceAt(c, today)
  if (be && be.outcome === 'none') need(!be.controlled, "best_evidence 'none' must be uncontrolled")

  return problems
}
