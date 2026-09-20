/* elute — the evidence ledger's words: the question each step asks (Working's pipeline boxes) and its
 * provenance block (Sources). Every count is derived from the row's dated records at the cutoff. */

import type { EntityKind, ISODate, LedgerRow } from '../data/types'
import { ledgerResult } from '../lib/evidence'
import { clockWord } from '../lib/runlog'
import { plain } from './evidence'

export function ProvenanceBlock({ row, cutoff, isToday }: { row: LedgerRow; cutoff: ISODate; isToday: boolean }) {
  const visible = row.records.filter((r) => r.published <= cutoff)
  const v = row.execution.verified
  const verified = v.by === 'human' ? `yes, human, ${v.date}${v.initials ? ` (${v.initials})` : ''}` : 'no, automated'
  const attempts = (row.attempts ?? []).map((a) => `${a.n}. ${a.transport}${a.tool_name ? ` ${a.tool_name}` : ''} ${a.outcome}${a.records_returned !== undefined ? ` (${a.records_returned})` : ''}${a.elapsed_ms ? ` ${a.elapsed_ms} ms` : ''}${a.reason ? ` — ${a.reason}` : ''}`)
  const c = row.counts
  const lines = [
    ['tool', row.execution.tool],
    ['query', row.execution.query],
    ...(row.execution.retry ? [['retried', `${row.execution.retry.reason} → ${row.execution.retry.query}`]] : []),
    ['run at', row.execution.run_at],
    ...(row.elapsed_ms !== undefined && row.elapsed_ms > 0 ? [['took', `${(row.elapsed_ms / 1000).toFixed(1)} s`]] : []),
    ...(row.status ? [['status', `${row.status}${row.transport && row.transport !== 'none' ? ` via ${row.transport}` : ''}`]] : []),
    ...(attempts.length ? [['attempts', attempts.join('\n            ')]] : []),
    ...(c && (c.results_retrieved || c.results_after_dedup) ? [['counts', `${c.results_retrieved} retrieved → ${c.results_after_dedup} after dedup → ${c.results_after_temporal_filter} visible (${c.records_withheld} withheld) → ${c.results_selected_for_extraction} selected`]] : []),
    ['records', `${ledgerResult(row, cutoff)}${isToday ? '' : ` on or before ${cutoff}`}`],
    ['extracted', visible.length ? visible.map((r) => `${plain(r.value)}    ${r.published}`).join('\n            ') : 'none'],
    ['verified', verified],
  ]
  const r = row.reasoning
  const reasoning = r
    ? [
        ['question', r.question],
        ['reasoning', r.reasoning],
        ['needed', r.evidence_needed],
        ['tool', `${r.selected_tool} — ${r.tool_selection_reason}`],
        ['found', r.interpretation],
        ['changes', r.what_this_changes],
        ['next', `${r.next_action} — ${r.next_action_reason}`],
        ['worded by', row.reasoning_source === 'openai' ? 'the model, over the visible records; checked by the citation gate' : 'the deterministic template'],
      ]
    : []
  const said = (row.notes ?? []).map((n) => `${clockWord(n.at_ms).padEnd(12)}${n.note}`)
  return (
    <pre className="raw raw-block">
      {lines.map(([k, val]) => `${k.padEnd(12)}${val}`).join('\n')}
      {reasoning.length ? '\n\n— the agent’s thought process —\n' + reasoning.map(([k, val]) => `${k.padEnd(12)}${val}`).join('\n') : ''}
      {said.length ? '\n\n— what the step said while it ran —\n' + said.join('\n') : ''}
    </pre>
  )
}

/** The question each step asks, in six words or fewer; the step's own name is the fallback. */
const QUESTIONS: Record<string, string> = {
  'Resolve the query': 'Which disease is this?',
  'Disease → targets with genetic evidence': 'Which targets have genetic evidence?',
  'Targets → approved drugs': 'Which approved drugs touch them?',
  'Drug → targets and pathways': 'What does the drug act on?',
  'Targets → conditions with evidence': 'Which conditions have evidence?',
  'Mechanism paths ≤ 4 hops': 'How does it reach the disease?',
  'Registered trials, blinding and n extracted': 'Has anyone tried this, how carefully?',
  'Literature, study design classified': 'Which papers, and what kind?',
  'CNS exposure': 'Does it reach the tissue?',
  'Safety in the likely population': 'What does the label mean here?',
  'Objections — each must cite a ledger line': 'What argues against it?',
  'Confidence drivers': 'In what order, and why?',
  // the backend's ten steps (src/data/api.ts)
  'Target and disease biology': 'What does the drug act on?',
  'Normalize to evidence': 'What counts as evidence here?',
  'Historical visibility audit': 'What was visible, and when?',
  'Claims and mechanism': 'How does it reach the disease?',
  'Statuses, weakest link, stance': 'Which link is weakest?',
  'Case for, case against, opinion': 'What argues against it?',
  'Next question': 'What should be asked next?',
}
export function question(row: LedgerRow, kind: EntityKind): string {
  if (row.step === 'Resolve the query' && kind !== 'condition') return 'Which drug is this?'
  return QUESTIONS[row.step] ?? row.step
}
