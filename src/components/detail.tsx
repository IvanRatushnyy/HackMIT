/* elute — Detail sections: the evidence date, critical appraisal, safety, before a trial, your call.
 * Each is a pure function of the candidate and a cutoff; a date change animates what enters and leaves. */

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { CandidateDetail, Cutoff, Source } from '../data/types'
import { resolvePrerequisite, unresolvedCount, visibleObjections, type LabelResult } from '../lib/evidence'
import { EASE_OUT } from '../lib/motion'
import { formatDate, shortCite, SourceLine } from './evidence'
import { Kicker } from './frame'
import { assessmentKey, loadAssessment, saveAssessment, type Assessment } from '../lib/export'

// ---- Evidence as of -----------------------------------------------------------------

export function AsOfControl({ cutoffs, current, onChange }: { cutoffs: Cutoff[]; current: Cutoff; onChange: (c: Cutoff) => void }) {
  const single = cutoffs.length === 1
  const i = cutoffs.findIndex((x) => x.id === current.id)
  return (
    <div className="asof">
      <Kicker>evidence as of</Kicker>
      <div className="asof__dates" role="radiogroup" aria-label="Evidence as of">
        {cutoffs.map((c, k) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            className={`asof__date${k < i ? ' asof__date--past' : ''}`}
            aria-checked={c.id === current.id}
            disabled={single}
            onClick={() => onChange(c)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') onChange(cutoffs[Math.min(i + 1, cutoffs.length - 1)])
              if (e.key === 'ArrowLeft') onChange(cutoffs[Math.max(i - 1, 0)])
            }}
          >
            {c.label}
          </button>
        ))}
        <span className="asof__track" aria-hidden="true">
          <motion.span className="asof__fill" animate={{ scaleX: cutoffs.length > 1 ? i / (cutoffs.length - 1) : 1 }} transition={{ duration: 0.4, ease: EASE_OUT }} />
        </span>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p key={current.id} className="asof__note" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.24 }}>
          {current.note}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}

// ---- Critical appraisal ----------------------------------------------------------------

function boldFigure(text: string, figure?: string) {
  if (!figure || !text.includes(figure)) return text
  const [before, after] = text.split(figure)
  return (
    <>
      {before}
      <strong>{figure}</strong>
      {after}
    </>
  )
}

export function Objections({ candidate, cutoff, sourcesHref }: { candidate: CandidateDetail; cutoff: Cutoff; sourcesHref: string }) {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState<string | null>(null)
  const srcById = new Map(candidate.sources.map((s) => [s.id, s]))
  const objections = visibleObjections(candidate, cutoff.date)
  return (
    <section className="section" aria-labelledby="objections">
      <div className="section__head">
        <h2 className="display-xs" id="objections">
          critical appraisal
        </h2>
        <span className="section__count">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={objections.length} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.24 }}>
              {objections.length}
            </motion.span>
          </AnimatePresence>{' '}
          {objections.length === 1 ? 'objection' : 'objections'}
        </span>
      </div>
      <motion.div className="panel objections" layout={!reduce}>
        <AnimatePresence initial={false}>
          {objections.length === 0 && (
            <motion.p key="none" className="objections__none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              Nothing published on or before this date.
            </motion.p>
          )}
          {objections.map((o, i) => {
            const srcs = o.sources.map((id) => srcById.get(id)).filter((s): s is Source => !!s)
            const isOpen = open === o.id
            return (
              <motion.div key={o.id} layout={!reduce} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.4, ease: EASE_OUT, delay: reduce ? 0 : i * 0.05 }} className="objection">
                <button type="button" className="objection__row" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : o.id)}>
                  <span className="objection__n display-xs">{i + 1}</span>
                  <span className="objection__claim">{o.claim}</span>
                  <span className="objection__src">{srcs.map(shortCite).join(', ')}</span>
                  <span className={`objection__mark${isOpen ? ' objection__mark--open' : ''}`} aria-hidden="true" />
                </button>
                <div className={`grow${isOpen ? ' grow--open' : ''}`} aria-hidden={!isOpen}>
                  <div>
                    <div className="objection__body">
                      <p className="objection__evidence">{boldFigure(o.evidence, o.figure)}</p>
                      <p className="objection__sources">
                        {srcs.map((s, j) => (
                          <span key={s.id}>
                            {j > 0 && ', '}
                            <a href={s.url} target="_blank" rel="noreferrer">
                              {s.first_author}, <em>{s.journal}</em> {s.year}
                            </a>
                          </span>
                        ))}
                        <span className="muted"> published {formatDate(o.published)}</span>
                        {o.cites.map((c) => (
                          <Link key={c} className="cite" to={`${sourcesHref}#${c}`}>
                            [{c}]
                          </Link>
                        ))}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </motion.div>
    </section>
  )
}

// ---- Claim evidence: for and against, each with its source line ----------------------------

export function ClaimEvidence({ r, sourcesHref }: { r: LabelResult; sourcesHref: string }) {
  const rows: { dir: string; s: Source }[] = [...r.supports.map((s) => ({ dir: 'for', s })), ...r.against.map((s) => ({ dir: 'against', s }))]
  if (rows.length === 0) return <p className="muted">nothing published on or before this date</p>
  return (
    <div className="evidence">
      {rows.map(({ dir, s }) => (
        <div className={`evidence__row evidence__row--${dir}`} key={dir + s.id}>
          <span className="evidence__dir">{dir}</span>
          <SourceLine s={s} cite={`${sourcesHref}#${s.ledger}`} />
        </div>
      ))}
    </div>
  )
}

// ---- Safety ------------------------------------------------------------------------------

export function SafetyPanel({ candidate, cutoff }: { candidate: CandidateDetail; cutoff: Cutoff }) {
  const s = resolvePrerequisiteSafety(candidate, cutoff)
  const srcById = new Map(candidate.sources.map((x) => [x.id, x]))
  return (
    <section className="section" aria-labelledby="safety">
      <div className="section__head">
        <h2 className="display-xs" id="safety">
          safety
        </h2>
      </div>
      <div className="panel panel--pad safety">
        {s ? (
          <>
            <p className={`safety__flag${s.severity === 'none' ? ' safety__flag--none' : ''}`}>
              {s.flag}
              <span className="safety__kind">{s.kind}</span>
            </p>
            <p className="safety__reason">{s.reason.charAt(0).toUpperCase() + s.reason.slice(1)}.</p>
            <p className="safety__population">{s.population}</p>
            <p className="safety__src">
              {s.sources.map((id) => {
                const src = srcById.get(id)
                return src ? (
                  <a key={id} href={src.url} target="_blank" rel="noreferrer">
                    {src.first_author}, {src.journal} {src.year}
                  </a>
                ) : null
              })}
            </p>
          </>
        ) : candidate.safety ? (
          <>
            <p className="safety__flag safety__flag--none">not yet on the label</p>
            <p className="safety__population">The label review in this record is dated after the selected evidence date.</p>
          </>
        ) : (
          <>
            <p className="safety__flag safety__flag--none">not assessed</p>
            <p className="safety__population">This record carries no safety review. Absence of a flag here is missing data, not reassurance.</p>
          </>
        )}
      </div>
    </section>
  )
}
function resolvePrerequisiteSafety(candidate: CandidateDetail, cutoff: Cutoff) {
  const t = candidate.safety
  if (!t) return undefined
  let hit: (typeof t)[number]['value'] | undefined
  for (const e of t) if (e.from <= cutoff.date) hit = e.value
  return hit
}

// ---- Before a trial: five numbered boxes, a walkthrough ------------------------------------

export function BeforeTrial({ candidate, cutoff, isToday }: { candidate: CandidateDetail; cutoff: Cutoff; isToday: boolean }) {
  const reduce = useReducedMotion()
  const n = unresolvedCount(candidate, cutoff.date)
  const total = candidate.prerequisites.length
  const [current, setCurrent] = useState<number | null>(null)
  const boxes = useRef<(HTMLButtonElement | null)[]>([])
  const srcById = new Map(candidate.sources.map((x) => [x.id, x]))

  const move = (to: number) => {
    const k = Math.max(0, Math.min(total - 1, to))
    setCurrent(k)
    boxes.current[k]?.focus()
  }

  const cur = current !== null ? candidate.prerequisites[current] : undefined
  const curStatus = cur ? resolvePrerequisite(cur, cutoff.date) : undefined

  return (
    <section className="section" aria-labelledby="prereqs">
      <div className="section__head section__head--count">
        <h2 className="display-xs" id="prereqs">
          before a trial
        </h2>
        <span className="section__hero">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={n} className="section__hero-n" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.28 }}>
              {n}
            </motion.span>
          </AnimatePresence>
          <span className="section__hero-of">
            of {total} unresolved{isToday ? '' : ' at this date'}
          </span>
        </span>
      </div>
      <div className="steps" role="tablist" aria-label="Trial prerequisites">
        {candidate.prerequisites.map((p, i) => {
          const s = resolvePrerequisite(p, cutoff.date)
          const unmet = !s || s.resolution === 'unmet'
          const on = current === i
          return (
            <button
              key={p.id}
              ref={(el) => {
                boxes.current[i] = el
              }}
              type="button"
              role="tab"
              aria-selected={on}
              tabIndex={on || (current === null && i === 0) ? 0 : -1}
              className={`panel step${on ? ' step--on' : ''}${unmet ? ' step--unmet' : ''}`}
              onClick={() => setCurrent(on ? null : i)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') move(i + 1)
                if (e.key === 'ArrowLeft') move(i - 1)
                if (e.key === 'Home') move(0)
                if (e.key === 'End') move(total - 1)
              }}
            >
              <span className="step__n display-xs">{i + 1}</span>
              <span className="step__condition">{p.condition}</span>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span key={s?.word ?? 'unknown'} className="step__word" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.24 }}>
                  {s?.word ?? 'unknown'}
                </motion.span>
              </AnimatePresence>
            </button>
          )
        })}
      </div>
      <AnimatePresence initial={false}>
        {cur && (
          <motion.div key={cur.id + cutoff.id} className="step__detail" initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.28, ease: EASE_OUT }}>
            <p className="step__note">{curStatus?.note ?? 'No evidence on or before this date.'}</p>
            {curStatus && curStatus.sources.length > 0 && (
              <p className="step__sources">
                {curStatus.sources.map((id, j) => {
                  const s = srcById.get(id)
                  return s ? (
                    <span key={id}>
                      {j > 0 && ', '}
                      <a href={s.url} target="_blank" rel="noreferrer">
                        {s.first_author} {s.year}
                      </a>{' '}
                      <span className="cite">[{s.ledger}]</span>
                    </span>
                  ) : null
                })}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

// ---- Your call ---------------------------------------------------------------------------------

const CHOICES = ['pursue', 'needs specific data', 'deprioritise'] as const

export function YourCall({ candidate, cutoff, query, exportHref }: { candidate: CandidateDetail; cutoff: Cutoff; query: string; exportHref: string }) {
  const key = assessmentKey(query, candidate.slug, cutoff.id)
  const [a, setA] = useState<Assessment>(() => loadAssessment(key))

  useEffect(() => {
    setA(loadAssessment(key))
  }, [key])

  const update = (next: Assessment) => {
    setA(next)
    saveAssessment(key, next)
  }

  return (
    <section className="section" aria-labelledby="call">
      <div className="section__head">
        <h2 className="display-xs" id="call">
          your call
        </h2>
      </div>
      <div className="panel panel--pad call">
        <div className="call__choices" role="radiogroup" aria-label="Your call">
          {CHOICES.map((c) => (
            <button key={c} type="button" role="radio" className="choice" aria-checked={a.choice === c} onClick={() => update({ ...a, choice: a.choice === c ? undefined : c })}>
              {c}
            </button>
          ))}
        </div>
        <div className="call__reason">
          <textarea className="textarea" aria-label="Your reasoning" placeholder="In your words." value={a.line ?? ''} onChange={(e) => update({ ...a, line: e.target.value })} />
          <div className="call__actions">
            <Link className="btn btn--primary btn--lg" to={exportHref}>
              Export appraisal
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
