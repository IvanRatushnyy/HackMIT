/* elute — Working, the step panel under the ten boxes: one step's thought process, in the order it happened.
 *
 * Why this step, what evidence it needs and which tool it chose are known when the step starts; what it said while
 * running arrives line by line; what came back, what it changed and what comes next arrive when it settles. Every
 * field is the backend's own AgentReasoning (v4.4 §7) or a line it emitted; nothing is composed here. Who worded the
 * reasoning (the deterministic template or the model) is always said. */

import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { AgentReasoning, EntityKind, ISODate, LedgerNote, LedgerRow } from '../data/types'
import { EASE_OUT } from '../lib/motion'
import { clockWord, durationWord } from '../lib/runlog'
import { plain } from './evidence'
import { question } from './Ledger'

export type StepLive = { reasoning?: AgentReasoning; notes: LedgerNote[]; startedAt?: number; settledAt?: number }

const SHOWN_RECORDS = 6

const STATUS_WORD: Record<string, string> = { ok: 'done', retried: 'done, after a retry', failed: 'failed, nothing usable', skipped: 'skipped' }

function Row({ k, children, muted }: { k: string; children: React.ReactNode; muted?: boolean }) {
  return (
    <div className={`step__row${muted ? ' step__row--muted' : ''}`}>
      <span className="step__k">{k}</span>
      <span className="step__v">{children}</span>
    </div>
  )
}

/** "C_EXPOSURE ← 3 link(s); C_CLINICAL ← 2 link(s)" → one line each. */
function changes(text: string): string[] {
  return text
    .split(/;\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function StepPanel({
  row,
  index,
  kind,
  cutoff,
  state,
  live,
  elapsedMs,
  durationMs,
  reduce,
}: {
  row: LedgerRow
  index: number
  kind: EntityKind
  cutoff: ISODate
  state: 'now' | 'done'
  live?: StepLive
  elapsedMs?: number
  durationMs?: number // the step's expected length: while it runs, its records arrive spread over it
  reduce: boolean
}) {
  const r = state === 'done' ? (row.reasoning ?? live?.reasoning) : (live?.reasoning ?? row.reasoning)
  const notes = state === 'done' ? (row.notes?.length ? row.notes : (live?.notes ?? [])) : (live?.notes ?? [])
  const all = row.records.filter((x) => x.published <= cutoff)
  const visible = all.slice(0, SHOWN_RECORDS)
  const more = all.length - visible.length
  const tool = state === 'done' ? row.execution.tool || row.source : (r?.selected_tool ?? row.source)
  const engine = row.source === 'Elute engine' || tool === 'engine'
  const time = state === 'done' ? row.elapsed_ms : elapsedMs
  const t = (delay = 0) => ({ duration: 0.3, delay: reduce ? 0 : delay, ease: EASE_OUT })
  const enter = reduce ? {} : { opacity: 0, y: 4 }
  // while the step runs, what comes back arrives one record at a time across the step's length (the original feed);
  // once settled, all at once
  const dur = (durationMs ?? 2000) / 1000
  const gap = state === 'now' ? Math.max(0.18, Math.min(0.4, (dur - 0.8) / Math.max(1, visible.length))) : 0.05
  const arrive = (k: number) => t(state === 'now' ? 0.5 + k * gap : 0.1 + k * gap)
  const hasThink = !!r
  const hasLog = notes.length > 0
  const who = row.reasoning_source === 'openai' ? 'reasoning worded by the model over the visible records, checked by the gate' : row.reasoning ? 'reasoning from the deterministic template' : undefined

  // while the step runs, the log follows its newest line
  const log = useRef<HTMLOListElement>(null)
  useEffect(() => {
    if (state === 'now' && log.current) log.current.scrollTop = log.current.scrollHeight
  }, [state, notes.length])

  return (
    <div className={`step step--${state}`}>
      <p className="step__head">
        <span className="step__n">{String(index + 1).padStart(2, '0')}</span>
        <span className="step__q">{question(row, kind)}</span>
        <span className="step__src">
          {engine ? 'by the Elute engine' : `asking ${plain(tool === 'queued' ? row.source : tool)}`}
          {time !== undefined && time > 0 && <> · {durationWord(time)}</>}
        </span>
        <span className={`step__status step__status--${state === 'now' ? 'now' : (row.status ?? 'ok')}`} aria-live="polite">
          {state === 'now' ? 'checking' : STATUS_WORD[row.status ?? 'ok']}
        </span>
      </p>

      <div className={`step__body${hasThink ? '' : ' step__body--feed'}`}>
        {hasThink && r && (
        <div className="step__think">
          <Row k="why this step">{r.reasoning}</Row>
          <Row k="evidence needed">{r.evidence_needed}</Row>
          <Row k="tool">
            <span className="medium">{plain(r.selected_tool)}</span>
            {r.tool_selection_reason && <> — {r.tool_selection_reason}</>}
          </Row>
          {state === 'done' && r && (
            <>
              <Row k="what came back">{r.interpretation}</Row>
              <Row k="what this changes">
                {changes(r.what_this_changes).map((line, i) => (
                  <span key={i} className="step__change">
                    {line}
                  </span>
                ))}
              </Row>
              <Row k="next">
                {r.next_action}
                {r.next_action_reason && <span className="step__why"> — {r.next_action_reason}</span>}
              </Row>
            </>
          )}
          {state === 'done' && row.execution.retry && (
            <Row k="self-correction">
              {row.execution.retry.reason} → <span className="raw">{row.execution.retry.query}</span>
            </Row>
          )}
          {who && <p className="step__who">{who}</p>}
        </div>
        )}

        <div className="step__log">
          {hasLog && (
            <>
              <p className="kicker">{state === 'now' ? 'what it is doing now' : 'what it said while it ran'}</p>
              <ol className="step__lines" ref={log} aria-live={state === 'now' ? 'polite' : undefined}>
                <AnimatePresence initial={false}>
                  {notes.map((n, i) => (
                    <motion.li key={`${n.at_ms}-${i}`} className="step__line" initial={enter} animate={{ opacity: 1, y: 0 }} transition={t()}>
                      <span className="step__at">{clockWord(n.at_ms)}</span>
                      <span>{n.note}</span>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ol>
            </>
          )}
          {(all.length > 0 || state === 'done') && (
            <>
              {hasThink && <p className="kicker">{state === 'now' ? 'what is coming back' : 'what came back, dated'}</p>}
              <ul className="pipe__records">
                {visible.map((x, k) => (
                  <motion.li className="pipe__record" key={k} initial={enter} animate={{ opacity: 1, y: 0 }} transition={arrive(k)}>
                    <span>{plain(x.value)}</span>
                    <span className="pipe__year">{x.published.slice(0, 4)}</span>
                  </motion.li>
                ))}
                {visible.length === 0 && <li className="pipe__record pipe__record--none">{engine ? 'no records: this step derives, it does not retrieve' : 'nothing returned'}</li>}
                {more > 0 && (
                  <motion.li className="pipe__record pipe__record--more" initial={enter} animate={{ opacity: 1, y: 0 }} transition={arrive(visible.length)}>
                    and {more} more
                  </motion.li>
                )}
              </ul>
            </>
          )}
          {state === 'now' && !hasLog && all.length === 0 && <p className="step__waiting">checking</p>}
        </div>
      </div>
    </div>
  )
}
