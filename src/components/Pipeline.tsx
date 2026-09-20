/* elute — Working, stage 2 of 4: the ten checks as ten boxes that light up one at a time.
 *
 * Each box asks one question, names the source it asks, and when it finishes shows what came back as one count and
 * how long it took. The current box is in ink with a bar filling beneath it over the step's expected length and the
 * last line the step said under its question; finished boxes carry a check; boxes not yet reached are faint. Under
 * the grid, the step panel shows the current (or the selected finished) step's thought process as it happens. */

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { BookOpenText, Brain, CalendarBlank, ChartBar, Check, ClipboardText, Crosshair, Dna, Flask, Graph, MagnifyingGlass, Pill, Question, Scales, ShieldCheck, Target, WarningCircle, type Icon } from '@phosphor-icons/react'
import type { EntityKind, ISODate, LedgerRow } from '../data/types'
import { ledgerResult } from '../lib/evidence'
import { durationWord } from '../lib/runlog'
import { plain } from './evidence'
import { question } from './Ledger'
import { StepPanel, type StepLive } from './Step'

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

export function Pipeline({
  rows,
  done,
  kind,
  cutoff,
  selected,
  onSelect,
  durations,
  live,
  currentElapsedMs,
  overrun,
}: {
  rows: LedgerRow[]
  done: number
  kind: EntityKind
  cutoff: ISODate
  selected: number | null
  onSelect: (i: number | null) => void
  durations: number[]
  live: Record<string, StepLive>
  currentElapsedMs: number
  overrun: boolean
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
          const l = live[row.id]
          const lastNote = l?.notes.length ? l.notes[l.notes.length - 1].note : undefined
          const src = state === 'now' && l?.reasoning?.selected_tool ? l.reasoning.selected_tool : row.source
          return (
            <li key={row.id} className={`pipe__box pipe__box--${state}${isShown && state === 'done' ? ' pipe__box--open' : ''}${state === 'now' && overrun ? ' pipe__box--over' : ''}`}>
              <button type="button" className="pipe__hit" disabled={state !== 'done'} onClick={() => onSelect(selected === i ? null : i)} aria-pressed={isShown && state === 'done'}>
                <span className="pipe__head">
                  <span className="pipe__icon">
                    {state === 'done' ? <Check size={16} weight="bold" aria-hidden="true" /> : <StepIcon step={row.step} />}
                  </span>
                  <span className="pipe__n">{String(i + 1).padStart(2, '0')}</span>
                </span>
                <span className="pipe__q">{question(row, kind)}</span>
                <span className="pipe__src">{src === 'queued' ? '' : sourceName(src)}</span>
                {state === 'now' && lastNote && (
                  <span className="pipe__note" aria-hidden="true">
                    {lastNote}
                  </span>
                )}
                <span className="pipe__result" aria-live={state === 'now' ? 'polite' : undefined}>
                  {state === 'done' ? (
                    <>
                      {ledgerResult(row, cutoff)}
                      {row.elapsed_ms !== undefined && row.elapsed_ms > 0 && <span className="pipe__time"> · {durationWord(row.elapsed_ms)}</span>}
                    </>
                  ) : state === 'now' ? (
                    overrun ? 'still checking' : 'checking'
                  ) : (
                    ''
                  )}
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
              key={shown.id + (selected ?? '') + (shown === current ? 'now' : 'done')}
              className="pipe__feed-body"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduce ? undefined : { opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <StepPanel row={shown} index={shownIndex} kind={kind} cutoff={cutoff} state={shown === current ? 'now' : 'done'} live={live[shown.id]} elapsedMs={shown === current ? currentElapsedMs : undefined} durationMs={durations[shownIndex]} reduce={!!reduce} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
