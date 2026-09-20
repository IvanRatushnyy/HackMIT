/* elute — one export model for clipboard and print (spec §5.11).
 * Built from the same cutoff-filtered data the page shows. */

import type { CandidateDetail, Cutoff } from '../data/types'
import { bestEvidenceAt, deriveLabel, resolvePrerequisite, resolveTimeline, unresolvedCount, visibleObjections } from './evidence'

export type Assessment = { choice?: 'pursue' | 'needs specific data' | 'deprioritise'; line?: string }

export type ExportSection = { heading: string; lines: string[] }
export type ExportDocument = { title: string; dateLine: string; sections: ExportSection[]; dataNote: string }

export function buildExport(c: CandidateDetail, cutoff: Cutoff, assessment: Assessment, dataNote: string): ExportDocument {
  const d = cutoff.date
  const srcById = new Map(c.sources.map((s) => [s.id, s]))
  const cite = (ids: string[]) =>
    ids
      .map((id) => srcById.get(id))
      .filter(Boolean)
      .map((s) => `${s!.first_author}, ${s!.journal} ${s!.year} [${s!.ledger}]`)
      .join('; ')

  const objections = visibleObjections(c, d).map((o, i) => `${i + 1}. ${o.claim} ${o.evidence} (${cite(o.sources)})`)

  const chain = c.chain.claims.map((k, i) => {
    const r = deriveLabel(k, c.sources, d)
    return `${i + 1}. ${k.text} — ${r.label}${r.qualifier ? ` (${r.qualifier})` : ''} — ${r.why}`
  })
  const weak = resolveTimeline(c.weakest_link, d)
  if (weak) {
    const k = c.chain.claims.find((x) => x.id === weak.claim)
    if (k) chain.push(`Weakest link: ${k.short} — ${weak.why}`)
  }

  const safety = resolveTimeline(c.safety, d)
  const safetyLines = safety ? [`${safety.flag} — ${safety.kind}: ${safety.reason}.`, safety.population, `(${cite(safety.sources)})`] : []

  const prereqs = c.prerequisites.map((p) => {
    const s = resolvePrerequisite(p, d)
    return `${p.condition}: ${s?.word ?? 'unknown'} — ${s?.note ?? ''}${s ? ` (${cite(s.sources)})` : ''}`
  })
  prereqs.push(`${unresolvedCount(c, d)} of ${c.prerequisites.length} unresolved at this date.`)

  const be = bestEvidenceAt(c, d)

  const assessmentLines = assessment.choice || assessment.line ? [assessment.choice ?? '', assessment.line ?? ''].filter(Boolean) : ['none recorded']

  const sources = c.sources
    .filter((s) => s.published <= d)
    .sort((a, b) => a.ledger.localeCompare(b.ledger) || a.published.localeCompare(b.published))
    .map((s) => `[${s.ledger}] ${s.first_author}, ${s.journal} ${s.year}. ${s.url}`)

  return {
    title: `${c.name} for ${c.condition}`,
    dateLine: cutoff.note,
    sections: [
      { heading: 'Critical appraisal', lines: objections },
      { heading: 'Mechanism chain', lines: chain },
      ...(safetyLines.length ? [{ heading: 'Safety in the likely trial population', lines: safetyLines }] : []),
      {
        heading: 'Trial prerequisites',
        lines: [...prereqs, ...(be ? [`Best evidence: ${be.design} · ${be.outcome}${be.n ? ` · n = ${be.n}` : ''}`] : [])],
      },
      { heading: 'Your assessment', lines: assessmentLines },
      { heading: 'Sources', lines: sources },
    ],
    dataNote,
  }
}

export function toMarkdown(doc: ExportDocument): string {
  const out: string[] = [`# ${doc.title}`, '', `*${doc.dateLine}*`, '', `> ${doc.dataNote}`, '']
  for (const s of doc.sections) {
    out.push(`## ${s.heading}`, '')
    for (const l of s.lines) out.push(l.startsWith('[') || /^\d+\./.test(l) ? l : `- ${l}`)
    out.push('')
  }
  out.push('---', '', `*Data note: ${doc.dataNote}*`, '')
  return out.join('\n')
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
