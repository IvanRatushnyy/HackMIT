/* elute — the evidence ledger: rows, provenance block, and the collapsed disclosure.
 * Every count is derived from the row's dated records at the current cutoff. */

import { useState } from 'react'
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
  return (
    <pre className="raw raw-block">
      {lines.map(([k, val]) => `${k.padEnd(12)}${val}`).join('\n')}
    </pre>
  )
}

export function LedgerRowView({
  row,
  cutoff,
  isToday,
  compact = false,
  running = false,
  open,
  onToggle,
  className,
}: {
  row: LedgerRow
  cutoff: ISODate
  isToday: boolean
  compact?: boolean
  running?: boolean
  open: boolean
  onToggle: () => void
  className?: string
}) {
  const result = running ? '…' : ledgerResult(row, cutoff)
  return (
    <li className={className}>
      <button
        type="button"
        className={`ledger__row${compact ? ' ledger__row--compact' : ''}`}
        aria-expanded={open}
        onClick={onToggle}
        disabled={running}
      >
        <span className="ledger__id figure">{row.id}</span>
        <span className="row__main">{row.step}</span>
        {!compact && <span className="row__main muted">{row.source}</span>}
        {!compact && (
          <span className="ledger__result">
            {row.execution.retry && !running ? <span className="ledger__retry">0 records → retried · </span> : null}
            {result}
          </span>
        )}
        <span className="ledger__disclosure" aria-hidden="true">
          {running ? '' : open ? '▾' : '▸'}
        </span>
      </button>
      {open && (
        <div className="ledger__body">
          <ProvenanceBlock row={row} cutoff={cutoff} isToday={isToday} />
        </div>
      )}
    </li>
  )
}

export function LedgerList({
  rows,
  cutoff,
  isToday,
  compact = false,
  runningId,
  openId,
  onOpen,
  animate = false,
}: {
  rows: LedgerRow[]
  cutoff: ISODate
  isToday: boolean
  compact?: boolean
  runningId?: string
  openId?: string | null
  onOpen?: (id: string | null) => void
  animate?: boolean
}) {
  const [local, setLocal] = useState<string | null>(null)
  const open = openId !== undefined ? openId : local
  const setOpen = onOpen ?? setLocal
  return (
    <ul className="ledger">
      {rows.map((row) => (
        <LedgerRowView
          key={row.id}
          row={row}
          cutoff={cutoff}
          isToday={isToday}
          compact={compact}
          running={row.id === runningId}
          open={open === row.id}
          onToggle={() => setOpen(open === row.id ? null : row.id)}
          className={animate ? 'rise' : undefined}
        />
      ))}
    </ul>
  )
}

export function LedgerDisclosure({
  rows,
  cutoff,
  isToday,
}: {
  rows: LedgerRow[]
  cutoff: ISODate
  isToday: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button type="button" className="disclosure" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>Evidence ledger · {rows.length} steps</span>
        <span className="disclosure__mark" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && <LedgerList rows={rows} cutoff={cutoff} isToday={isToday} compact />}
    </div>
  )
}
