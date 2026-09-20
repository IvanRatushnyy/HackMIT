/* elute — the two registers on the results page (PRD §7).
 * Tested: a controlled study in this indication has reported; ordered by its outcome, then by n.
 * Not yet tested: everything else; ordered by unresolved prerequisites (orderCandidates). */

import type { BestEvidence, CandidateDetail } from '../data/types'
import { bestEvidenceAt, orderCandidates, todayDate } from './evidence'

export type RegisterId = 'tested' | 'untested'

export type Register = { id: RegisterId; word: string; rule: string; rows: CandidateDetail[] }

export const REGISTER_WORDS: Record<RegisterId, { word: string; rule: string }> = {
  tested: {
    word: 'Tested in placebo-controlled trials',
    rule: 'A controlled study in this indication has reported. Ordered by its outcome, then by size.',
  },
  untested: {
    word: 'Not yet tested against placebo',
    rule: 'Open-label studies and enrolling trials included. Ordered by fewest unresolved prerequisites.',
  },
}

const OUTCOME_ORDER: Record<BestEvidence['outcome'], number> = { positive: 0, mixed: 1, negative: 2, none: 3 }

export function isTested(c: CandidateDetail): boolean {
  return !!bestEvidenceAt(c, todayDate(c))?.controlled
}

export function orderTested(rows: CandidateDetail[]): CandidateDetail[] {
  return [...rows].sort((a, b) => {
    const ba = bestEvidenceAt(a, todayDate(a))!
    const bb = bestEvidenceAt(b, todayDate(b))!
    if (OUTCOME_ORDER[ba.outcome] !== OUTCOME_ORDER[bb.outcome]) return OUTCOME_ORDER[ba.outcome] - OUTCOME_ORDER[bb.outcome]
    if ((ba.n ?? 0) !== (bb.n ?? 0)) return (bb.n ?? 0) - (ba.n ?? 0)
    return a.name.localeCompare(b.name)
  })
}

export function registers(candidates: CandidateDetail[]): Register[] {
  const tested = orderTested(candidates.filter(isTested))
  const untested = orderCandidates(candidates.filter((c) => !isTested(c)))
  const all: Register[] = [
    { id: 'untested', ...REGISTER_WORDS.untested, rows: untested },
    { id: 'tested', ...REGISTER_WORDS.tested, rows: tested },
  ]
  return all.filter((r) => r.rows.length)
}
