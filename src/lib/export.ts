/* elute — one export model for Markdown, JSON, and print (spec §5.11).
 * Built from the same cutoff-filtered data the page shows. */

import type { CandidateDetail, Cutoff } from '../data/types'
import { bestEvidenceAt, deriveLabel, resolvePrerequisite, resolveTimeline, unresolvedCount, visibleObjections } from './evidence'

export type Assessment = { choice?: 'pursue' | 'needs specific data' | 'deprioritise'; line?: string }

export type ExportInclude = {
  objections: boolean
  mechanism: boolean
  safety: boolean
  call: boolean
  sources: boolean
  note: boolean
}
export const INCLUDE_ALL: ExportInclude = { objections: true, mechanism: true, safety: true, call: true, sources: true, note: true }

export type ExportSection = { key: keyof ExportInclude; heading: string; lines: string[] }
export type ExportDocument = {
  title: string
  meta: string
  dateLine: string
  call?: { choice: string; line: string } // absent when not included
  sections: ExportSection[]
  dataNote: string
  sourceCount: number
}

export function buildExport(c: CandidateDetail, cutoff: Cutoff, assessment: Assessment, dataNote: string, include: ExportInclude = INCLUDE_ALL): ExportDocument {
  const d = cutoff.date
  const srcById = new Map(c.sources.map((s) => [s.id, s]))
  const cite = (ids: string[]) =>
    ids
      .map((id) => srcById.get(id))
      .filter(Boolean)
      .map((s) => `${s!.first_author}, ${s!.journal} ${s!.year} [${s!.ledger}]`)
      .join('; ')

  const sections: ExportSection[] = []

  if (include.objections) {
    sections.push({
      key: 'objections',
      heading: 'Critical appraisal',
      lines: visibleObjections(c, d).map((o, i) => `${i + 1}. ${o.claim} ${o.evidence} (${cite(o.sources)})`),
    })
  }

  if (include.mechanism) {
    const lines = c.chain.claims.map((k, i) => {
      const r = deriveLabel(k, c.sources, d)
      return `${i + 1}. ${k.text} Label: ${r.label}${r.qualifier ? ` (${r.qualifier})` : ''}. ${r.why}`
    })
    const weak = resolveTimeline(c.weakest_link, d)
    if (weak) {
      const k = c.chain.claims.find((x) => x.id === weak.claim)
      if (k) lines.push(`Weakest link: ${k.short}. ${weak.why}`)
    }
    sections.push({ key: 'mechanism', heading: 'Mechanism', lines })
  }

  if (include.safety) {
    const safety = resolveTimeline(c.safety, d)
    sections.push({
      key: 'safety',
      heading: 'Safety',
      lines: safety
        ? [
            `${safety.flag} (${safety.kind}): ${safety.reason}.`,
            safety.population,
            ...(safety.systems ?? []).map((x) => `${x.system ? `${x.system} · ` : ''}${x.heading}: ${x.detail}.`),
            ...(safety.contraindications ? [`Contraindicated: ${safety.contraindications}`] : []),
            ...(safety.signals && safety.signals.length ? [`${safety.signals_note ?? 'FAERS signals, report counts.'} ${safety.signals.map((g) => `${g.name} (${g.reports})`).join(' · ')}`] : []),
            `(${cite(safety.sources)})`,
          ]
        : c.safety
          ? ['The label version this record read is dated after the selected evidence date; earlier versions were not read, so a warning may already have applied.']
          : ['Not assessed: this record carries no safety review. Absence of a flag is missing data, not reassurance.'],
    })
    const prereqs = c.prerequisites.map((p) => {
      const s = resolvePrerequisite(p, d)
      return `${p.condition}: ${s?.word ?? 'unknown'}. ${s?.note ?? ''}${s ? ` (${cite(s.sources)})` : ''}`
    })
    prereqs.push(`${unresolvedCount(c, d)} of ${c.prerequisites.length} unresolved at this date.`)
    const be = bestEvidenceAt(c, d)
    if (be) prereqs.push(`Best evidence: ${be.design}, ${be.outcome}${be.n ? `, n = ${be.n}` : ''}${be.label ? ` (${be.label})` : ''}`)
    sections.push({ key: 'safety', heading: 'Before a trial', lines: prereqs })
  }

  if (include.call) {
    sections.push({
      key: 'call',
      heading: 'Your call',
      lines: assessment.choice || assessment.line ? [assessment.choice ?? 'not yet chosen', assessment.line ?? ''].filter(Boolean) : ['not yet chosen'],
    })
  }

  const visibleSources = c.sources.filter((s) => s.published <= d).sort((a, b) => a.ledger.localeCompare(b.ledger) || a.published.localeCompare(b.published))
  if (include.sources) {
    sections.push({
      key: 'sources',
      heading: 'Sources',
      lines: visibleSources.map((s) => `[${s.ledger}] ${s.first_author}, ${s.journal} ${s.year}. ${s.url}`),
    })
  }

  return {
    title: `${c.name} for ${c.condition}`,
    meta: `Appraisal, ${cutoff.note.replace(/^Evidence (frozen at|as of) /, 'evidence as of ')}`,
    dateLine: cutoff.note,
    call: include.call ? { choice: assessment.choice ?? 'not yet chosen', line: assessment.line ?? '' } : undefined,
    sections,
    dataNote: include.note ? dataNote : '',
    sourceCount: visibleSources.length,
  }
}

export function toMarkdown(doc: ExportDocument): string {
  const out: string[] = [`# ${doc.title}`, '', `*${doc.meta}*`, '']
  if (doc.dataNote) out.push(`> ${doc.dataNote}`, '')
  for (const s of doc.sections) {
    out.push(`## ${s.heading}`, '')
    for (const l of s.lines) out.push(l.startsWith('[') || /^\d+\./.test(l) ? l : `- ${l}`)
    out.push('')
  }
  if (doc.dataNote) out.push('---', '', `*${doc.dataNote}*`, '')
  return out.join('\n')
}

export function toJson(doc: ExportDocument): string {
  return JSON.stringify(doc, null, 2)
}

// ---- Assessment persistence: one per candidate per cutoff --------------------------

export function assessmentKey(query: string, candidate: string, cutoff: string) {
  return `assessment:${query}/${candidate}@${cutoff}`
}

export function loadAssessment(key: string): Assessment {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as Assessment) : {}
  } catch {
    return {}
  }
}

export function saveAssessment(key: string, a: Assessment) {
  try {
    localStorage.setItem(key, JSON.stringify(a))
  } catch {
    /* storage unavailable: the session still works */
  }
}
