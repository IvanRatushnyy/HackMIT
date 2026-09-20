/* elute — the evidence ledger while it runs (Working), and its provenance block for Sources.
 *
 * The person is walked through the run one step at a time. The current step is the only thing that moves:
 * its question arrives, then the source it asks, then what came back, record by record, over the step's
 * own duration. Finished steps settle above it as one line each and open on a click; steps not yet reached
 * are not shown, the strip at the top says how many remain. Every count is derived from the row's dated
 * records at the cutoff. */

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { EntityKind, ISODate, LedgerRow } from '../data/types'
import { ledgerResult } from '../lib/evidence'
import { plain } from './evidence'
import { EASE_OUT } from '../lib/motion'

export function ProvenanceBlock({ row, cutoff, isToday }: { row: LedgerRow; cutoff: ISODate; isToday: boolean }) {
  const visible = row.records.filter((r) => r.published <= cutoff)
  const v = row.execution.verified
  const verified = v.by === 'human' ? `yes, human, ${v.date}${v.initials ? ` (${v.initials})` : ''}` : 'no, automated'
  const lines = [
    ['tool', row.execution.tool],
    ['query', row.execution.query],
    ...(row.execution.retry ? [['retried', `${row.execution.retry.reason} → ${row.execution.retry.query}`]] : []),
    ['run at', row.execution.run_at],
    ['records', `${ledgerResult(row, cutoff)}${isToday ? '' : ` on or before ${cutoff}`}`],
    ['extracted', visible.length ? visible.map((r) => `${plain(r.value)}    ${r.published}`).join('\n            ') : 'none'],
    ['verified', verified],
  ]
  return <pre className="raw raw-block">{lines.map(([k, val]) => `${k.padEnd(12)}${val}`).join('\n')}</pre>
}

export type RowState = 'done' | 'running' | 'pending'

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
}
export function question(row: LedgerRow, kind: EntityKind): string {
  if (row.step === 'Resolve the query' && kind !== 'condition') return 'Which drug is this?'
  return QUESTIONS[row.step] ?? row.step
}

const SHOWN = 6 // records shown while a step runs

/** The ledger: a strip of marks, the finished steps as lines, the current step in focus. */
export function WorkingLedger({
  rows,
  done,
  kind,
  cutoff,
  selected,
  onSelect,
  durations,
}: {
  rows: LedgerRow[]
  done: number
  kind: EntityKind
  cutoff: ISODate
  selected: number | null
  onSelect: (i: number | null) => void
  durations: number[]
  recorded: boolean
}) {
  const reduce = useReducedMotion()
  const current = done < rows.length ? rows[done] : undefined
  return (
    <div className="ledger panel" aria-label="Evidence ledger">
      <div className="ledger__strip" aria-hidden="true">
        {rows.map((r, i) => (
          <i key={r.id} className={i < done ? 'is-done' : i === done ? 'is-now' : ''} />
        ))}
      </div>
      <ol className="ledger__rows">
        <AnimatePresence initial={false}>
          {rows.slice(0, done).map((row, i) => (
            <DoneRow key={row.id} row={row} index={i} kind={kind} cutoff={cutoff} open={selected === i} onToggle={() => onSelect(selected === i ? null : i)} reduce={reduce} />
          ))}
        </AnimatePresence>
        {current && <RunningRow key={current.id} row={current} index={done} kind={kind} cutoff={cutoff} durationMs={durations[done]} reduce={reduce} />}
      </ol>
    </div>
  )
}

function DoneRow({ row, index, kind, cutoff, open, onToggle, reduce }: { row: LedgerRow; index: number; kind: EntityKind; cutoff: ISODate; open: boolean; onToggle: () => void; reduce: boolean | null }) {
  const visible = row.records.filter((r) => r.published <= cutoff)
  const retried = !!row.execution.retry
  return (
    <motion.li className={`ledger__done${open ? ' is-open' : ''}`} layout={!reduce} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, ease: EASE_OUT }}>
      <button type="button" className="ledger__line" onClick={onToggle} aria-expanded={open}>
        <span className="ledger__mark" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 16 16">
            {retried ? <path d="M8 3v6M8 12v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /> : <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}
          </svg>
        </span>
        <span className="ledger__line-q">
          <span className="ledger__line-n">{index + 1}</span>
          {question(row, kind)}
        </span>
        <span className="ledger__line-count">{ledgerResult(row, cutoff)}</span>
      </button>
      <div className={`grow${open ? ' grow--open' : ''}`} aria-hidden={!open}>
        <div>
          <div className="ledger__records">
            {visible.map((r, k) => (
              <div className="ledger__record" key={k}>
                <span>{plain(r.value)}</span>
                <span className="ledger__year">{r.published.slice(0, 4)}</span>
              </div>
            ))}
            {visible.length === 0 && <div className="ledger__record muted">nothing returned</div>}
            <p className="ledger__from">
              from {plain(row.source)}
              {retried ? `. Retried: ${row.execution.retry!.reason}.` : ''}
            </p>
          </div>
        </div>
      </div>
    </motion.li>
  )
}

/** The current step: the question, the source, then the records arriving over the step's duration. */
function RunningRow({ row, index, kind, cutoff, durationMs, reduce }: { row: LedgerRow; index: number; kind: EntityKind; cutoff: ISODate; durationMs: number; reduce: boolean | null }) {
  const visible = row.records.filter((r) => r.published <= cutoff).slice(0, SHOWN)
  const more = row.records.filter((r) => r.published <= cutoff).length - visible.length
  const dur = durationMs / 1000
  // Beats: the question at once, the source after 0.4 s, records from 0.9 s spaced to finish before the step does
  const gap = Math.max(0.2, Math.min(0.4, (dur - 1.4) / Math.max(1, visible.length)))
  const t = (s: number) => ({ duration: 0.4, delay: reduce ? 0 : s, ease: EASE_OUT })
  const enter = reduce ? {} : { opacity: 0, y: 4 }
  return (
    <li className="ledger__now">
      <div className="ledger__now-head">
        <span className="ledger__now-n display-xs">{index + 1}</span>
        <motion.span className="ledger__now-q" initial={enter} animate={{ opacity: 1, y: 0 }} transition={t(0)}>
          {question(row, kind)}
        </motion.span>
        <motion.span className="ledger__src" initial={enter} animate={{ opacity: 1, y: 0 }} transition={t(0.4)}>
          {plain(row.source)}
        </motion.span>
      </div>
      <div className="ledger__now-records">
        {visible.map((r, k) => (
          <motion.div className="ledger__record" key={k} initial={enter} animate={{ opacity: 1, y: 0 }} transition={t(0.9 + k * gap)}>
            <span>{plain(r.value)}</span>
            <span className="ledger__year">{r.published.slice(0, 4)}</span>
          </motion.div>
        ))}
        {visible.length === 0 && (
          <motion.div className="ledger__record muted" initial={enter} animate={{ opacity: 1, y: 0 }} transition={t(0.9)}>
            nothing returned
          </motion.div>
        )}
        <motion.p className="ledger__from" initial={enter} animate={{ opacity: 1, y: 0 }} transition={t(0.9 + visible.length * gap)}>
          <b>{ledgerResult(row, cutoff)}</b>
          {more > 0 ? `, ${more} more` : ''}
        </motion.p>
      </div>
      <span className="ledger__bar" style={{ '--dur': `${durationMs}ms` } as React.CSSProperties} aria-hidden="true" />
    </li>
  )
}
