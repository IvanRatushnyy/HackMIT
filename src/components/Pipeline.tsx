/* elute — Working, stage 2 of 4: the ten checks as ten boxes that light up one at a time.
 *
 * Each box asks one question, names the source it asks, and when it finishes shows what came back as one
 * count. The current box is in ink with a bar filling beneath it; finished boxes carry a check and their
 * count; boxes not yet reached are faint. Under the grid, the current step's records arrive one by one,
 * so the person sees the work as it happens without reading a log. Click a finished box to see its records. */

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { BookOpenText, Brain, CalendarBlank, ChartBar, Check, ClipboardText, Crosshair, Dna, Flask, Graph, MagnifyingGlass, Pill, Question, Scales, ShieldCheck, Target, WarningCircle, type Icon } from '@phosphor-icons/react'
import type { EntityKind, ISODate, LedgerRow } from '../data/types'
import { ledgerResult } from '../lib/evidence'
import { EASE_OUT } from '../lib/motion'
import { plain } from './evidence'
import { question } from './Ledger'

/** One glyph per step, from the same set as the stages. */
const ICON: Record<string, Icon> = {
  'Resolve the query': MagnifyingGlass,
  'Disease → targets with genetic evidence': Dna,
  'Targets → approved drugs': Pill,
  'Drug → targets and pathways': Crosshair,
  'Targets → conditions with evidence': Target,
  'Mechanism paths ≤ 4 hops': Graph,
  'Registered trials, blinding and n extracted': ClipboardText,
  'Literature, study design classified': BookOpenText,
  'CNS exposure': Brain,
  'Safety in the likely population': ShieldCheck,
  'Objections — each must cite a ledger line': WarningCircle,
  'Confidence drivers': ChartBar,
  // the backend's ten steps (src/data/api.ts)
  'Target and disease biology': Dna,
  'Normalize to evidence': Scales,
  'Historical visibility audit': CalendarBlank,
  'Claims and mechanism': Graph,
  'Statuses, weakest link, stance': ChartBar,
  'Case for, case against, opinion': WarningCircle,
  'Next question': Question,
}

function StepIcon({ step }: { step: string }) {
  const Glyph = ICON[step] ?? Flask
  return <Glyph size={16} aria-hidden="true" />
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
                    {state === 'done' ? <Check size={16} weight="bold" aria-hidden="true" /> : <StepIcon step={row.step} />}
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
