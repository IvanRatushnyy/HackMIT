/* elute — the evidence ledger while it runs (Working) and its provenance block.
 * Every count is derived from the row's dated records at the current cutoff. */

import type { ISODate, LedgerRow } from '../data/types'
import { ledgerResult } from '../lib/evidence'

export function ProvenanceBlock({ row, cutoff, isToday }: { row: LedgerRow; cutoff: ISODate; isToday: boolean }) {
  const visible = row.records.filter((r) => r.published <= cutoff)
  const v = row.execution.verified
  const verified = v.by === 'human' ? `yes — human, ${v.date}${v.initials ? ` (${v.initials})` : ''}` : 'no — automated'
  const lines = [
    ['tool', row.execution.tool],
    ['query', row.execution.query],
    ...(row.execution.retry ? [['retried', `${row.execution.retry.reason} → ${row.execution.retry.query}`]] : []),
    ['run at', row.execution.run_at],
    ['records', `${ledgerResult(row, cutoff)}${isToday ? '' : ` on or before ${cutoff}`}`],
    ['extracted', visible.length ? visible.map((r) => `${r.value}    ${r.published}`).join('\n            ') : '—'],
    ['verified', verified],
  ]
  return <pre className="raw raw-block">{lines.map(([k, val]) => `${k.padEnd(12)}${val}`).join('\n')}</pre>
}

export type RowState = 'done' | 'running' | 'pending'

/** One ledger row on the Working page: number and glyph, step, what came back, elapsed. */
export function WorkingRow({
  row,
  index,
  state,
  cutoff,
  selected,
  onSelect,
  durationMs,
  recorded,
}: {
  row: LedgerRow
  index: number
  state: RowState
  cutoff: ISODate
  selected: boolean
  onSelect: () => void
  durationMs: number
  recorded: boolean
}) {
  const glyph = state === 'done' ? (row.execution.retry ? '!' : '✓') : state === 'running' ? '●' : ''
  const result =
    state === 'done'
      ? `${row.execution.retry ? `${row.execution.retry.reason} · retried · ` : ''}${ledgerResult(row, cutoff)}`
      : state === 'running'
        ? `${row.source} · running`
        : row.source
  const time = state === 'done' && recorded && row.elapsed_ms !== undefined ? `${(row.elapsed_ms / 1000).toFixed(1)} s` : state === 'running' ? 'running' : ''
  return (
    <li className="fade" style={{ '--i': index } as React.CSSProperties}>
      <button
        type="button"
        className={`panel__row ledger__row ledger__row--${state}${selected ? ' ledger__row--selected' : ''}`}
        onClick={state === 'done' ? onSelect : undefined}
        disabled={state !== 'done'}
        aria-pressed={selected}
      >
        <span className="ledger__num">
          <span>{index + 1}</span>
          <span className={`ledger__glyph${row.execution.retry && state === 'done' ? ' ledger__glyph--retry' : ''}`} aria-hidden="true">
            {glyph}
          </span>
        </span>
        <span className="ledger__step">{row.step}</span>
        <span className="ledger__result">{result}</span>
        <span className="ledger__time">{time}</span>
        {state === 'running' && <span className="ledger__bar" style={{ '--dur': `${durationMs}ms` } as React.CSSProperties} aria-hidden="true" />}
      </button>
    </li>
  )
}
