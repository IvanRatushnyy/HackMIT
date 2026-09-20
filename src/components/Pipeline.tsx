/* elute — Working, stage 2 of 5: the ten checks as ten boxes that light up one at a time.
 *
 * Each box asks one question, names the source it asks, and when it finishes shows what came back as one
 * count. The current box is in ink with a bar filling beneath it; finished boxes carry a check and their
 * count; boxes not yet reached are faint. Under the grid, the current step's records arrive one by one,
 * so the person sees the work as it happens without reading a log. Click a finished box to see its records. */

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { EntityKind, ISODate, LedgerRow } from '../data/types'
import { ledgerResult } from '../lib/evidence'
import { EASE_OUT } from '../lib/motion'
import { plain } from './evidence'
import { question } from './Ledger'

/** One line icon per step, in the same stroke as the stage rail. */
const ICON: Record<string, React.ReactNode> = {
  'Resolve the query': <path d="M7 12a5 5 0 1 0 10 0a5 5 0 1 0-10 0M15.5 15.5L20 20" />,
  'Disease → targets with genetic evidence': <path d="M6 3c0 6 12 6 12 12M18 3c0 6-12 6-12 12M6 21c0-2 1-3 3-3M18 21c0-2-1-3-3-3M8 8h8M8 16h8" />,
  'Targets → approved drugs': <path d="M8.5 3.5l12 12a4 4 0 0 1-5.7 5.7l-12-12a4 4 0 0 1 5.7-5.7zM5.5 9.5l9 9" />,
  'Drug → targets and pathways': <path d="M12 3v3M12 18v3M3 12h3M18 12h3M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10M12 11a1 1 0 1 0 0 2a1 1 0 1 0 0-2" />,
  'Targets → conditions with evidence': <path d="M12 3v3M12 18v3M3 12h3M18 12h3M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10M12 11a1 1 0 1 0 0 2a1 1 0 1 0 0-2" />,
  'Mechanism paths ≤ 4 hops': <path d="M4 6a2 2 0 1 0 4 0a2 2 0 1 0-4 0M16 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0M4 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0M8 6.5l8 4.5M8 17.5l8-4.5" />,
  'Registered trials, blinding and n extracted': <path d="M8 4h8v3H8zM6 6h12v14H6zM9 12h6M9 16h4" />,
  'Literature, study design classified': <path d="M4 5a2 2 0 0 1 2-2h6v16H6a2 2 0 0 0-2 2zM20 5a2 2 0 0 0-2-2h-6v16h6a2 2 0 0 1 2 2z" />,
  'CNS exposure': <path d="M12 3v18M4 8h5M4 12h5M4 16h5M15 12h5M17 9l3 3-3 3" />,
  'Safety in the likely population': <path d="M12 3l8 3v6c0 5-3.5 8-8 9c-4.5-1-8-4-8-9V6zM9 12l2 2 4-4" />,
  'Objections — each must cite a ledger line': <path d="M4 7h12M4 12h16M4 17h10M19 4l-4 4M15 4l4 4" />,
  'Confidence drivers': <path d="M5 20V10M10 20V4M15 20v-8M20 20v-5M3 20h18" />,
}

function StepIcon({ step }: { step: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON[step] ?? <path d="M5 12h14" />}
    </svg>
  )
}

/** A source string like "Open Targets Platform · MONDO" becomes its first name. */
const sourceName = (s: string) => plain(s).split(',')[0]

const SHOWN = 5

export function Pipeline({
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
}) {
  const reduce = useReducedMotion()
  const current = done < rows.length ? rows[done] : undefined
  const shown = selected !== null && selected < done ? rows[selected] : current
  const shownIndex = selected !== null && selected < done ? selected : done
  return (
    <div className="pipe" aria-label="The ten checks">
      <ol className="pipe__grid">
        {rows.map((row, i) => {
          const state = i < done ? 'done' : i === done ? 'now' : 'next'
          const isShown = shownIndex === i
          return (
            <li key={row.id} className={`pipe__box pipe__box--${state}${isShown && state === 'done' ? ' pipe__box--open' : ''}`}>
              <button type="button" className="pipe__hit" disabled={state !== 'done'} onClick={() => onSelect(selected === i ? null : i)} aria-pressed={isShown && state === 'done'}>
                <span className="pipe__head">
                  <span className="pipe__icon">
                    {state === 'done' ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12.5l4.5 4.5L19 7" />
                      </svg>
                    ) : (
                      <StepIcon step={row.step} />
                    )}
                  </span>
                  <span className="pipe__n">{String(i + 1).padStart(2, '0')}</span>
                </span>
                <span className="pipe__q">{question(row, kind)}</span>
                <span className="pipe__src">{sourceName(row.source)}</span>
                <span className="pipe__result" aria-live={state === 'now' ? 'polite' : undefined}>
                  {state === 'done' ? ledgerResult(row, cutoff) : state === 'now' ? 'checking' : ''}
                </span>
                {state === 'now' && <span className="pipe__bar" style={{ '--dur': `${durations[i]}ms` } as React.CSSProperties} aria-hidden="true" />}
              </button>
            </li>
          )
        })}
      </ol>

      <div className="pipe__feed">
        <AnimatePresence mode="wait" initial={false}>
          {shown && (
            <motion.div
              key={shown.id + (selected ?? '')}
              className="pipe__feed-body"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduce ? undefined : { opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Feed row={shown} index={shownIndex} kind={kind} cutoff={cutoff} live={shown === current} durationMs={durations[shownIndex] ?? 2000} reduce={!!reduce} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/** The records of one step. Live: they arrive one by one over the step's duration. Finished: all at once. */
function Feed({ row, index, kind, cutoff, live, durationMs, reduce }: { row: LedgerRow; index: number; kind: EntityKind; cutoff: ISODate; live: boolean; durationMs: number; reduce: boolean }) {
  const all = row.records.filter((r) => r.published <= cutoff)
  const visible = all.slice(0, SHOWN)
  const more = all.length - visible.length
  const dur = durationMs / 1000
  const gap = live ? Math.max(0.18, Math.min(0.4, (dur - 0.8) / Math.max(1, visible.length))) : 0
  const t = (s: number) => ({ duration: 0.3, delay: reduce || !live ? 0 : s, ease: EASE_OUT })
  const enter = reduce || !live ? {} : { opacity: 0, y: 4 }
  return (
    <>
      <p className="pipe__feed-head">
        <span className="pipe__feed-n">{String(index + 1).padStart(2, '0')}</span>
        <span className="pipe__feed-q">{question(row, kind)}</span>
        <span className="pipe__feed-src">asking {plain(row.source)}</span>
      </p>
      <ul className="pipe__records">
        {visible.map((r, k) => (
          <motion.li className="pipe__record" key={k} initial={enter} animate={{ opacity: 1, y: 0 }} transition={t(0.5 + k * gap)}>
            <span>{plain(r.value)}</span>
            <span className="pipe__year">{r.published.slice(0, 4)}</span>
          </motion.li>
        ))}
        {visible.length === 0 && (
          <motion.li className="pipe__record pipe__record--none" initial={enter} animate={{ opacity: 1, y: 0 }} transition={t(0.5)}>
            nothing returned
          </motion.li>
        )}
        {more > 0 && (
          <motion.li className="pipe__record pipe__record--more" initial={enter} animate={{ opacity: 1, y: 0 }} transition={t(0.5 + visible.length * gap)}>
            and {more} more
          </motion.li>
        )}
      </ul>
    </>
  )
}
