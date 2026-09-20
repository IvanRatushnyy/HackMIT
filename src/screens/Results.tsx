/* elute — Results: two registers (tested in placebo-controlled trials / not yet tested against placebo)
 * or a board by trial stage. Each row answers the scientist's four questions in their order; selecting a
 * row opens the same four questions as a stepper in place. Rendered on /q/:query once the ledger has run. */

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Link, useNavigate } from 'react-router-dom'
import { bestEvidenceText, designWord, EvidenceLabel, OutcomeChip, SourceLine, plain } from '../components/evidence'
import type { BestEvidence, CandidateDetail, ResultsPage, Source, TrialStage } from '../data/types'
import { bestEvidenceAt, deriveLabel, resolvePrerequisite, resolveTimeline, todayDate, unresolvedCount } from '../lib/evidence'
import { BASE, EASE_OUT } from '../lib/motion'
import { registers } from '../lib/registers'

export function Results({ page, view }: { page: ResultsPage; view: 'list' | 'board' }) {
  return view === 'list' ? <ResultsList page={page} /> : <Board page={page} />
}

export function candidatePath(page: ResultsPage, c: CandidateDetail) {
  return `/q/${page.query.slug}/${page.query.kind === 'drug' ? c.condition_slug : c.drug_slug}`
}

const isRefuted = (be?: BestEvidence) => !!be && be.controlled && be.outcome === 'negative'
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const QUESTIONS = ['does it work in people?', 'could it work?', 'what could go wrong?', 'what would it take?'] as const

// ---- List ----------------------------------------------------------------------------------

function ResultsList({ page }: { page: ResultsPage }) {
  const drugFirst = page.query.kind === 'drug'
  const [open, setOpen] = useState<string | null>(null)
  let rank = 0
  return (
    <div className="arrive results" style={{ '--i': 1 } as React.CSSProperties}>
      {registers(page.candidates).map((g) => (
        <section key={g.id} className="register" aria-labelledby={`register-${g.id}`}>
          <h2 className="register__word" id={`register-${g.id}`}>
            {g.word}
          </h2>
          <p className="register__rule">{g.rule}</p>
          <div className="thead results__head">
            <span />
            <span className="kicker">{drugFirst ? 'indication' : 'candidate'}</span>
            {QUESTIONS.map((q) => (
              <span className="kicker" key={q}>
                {q}
              </span>
            ))}
            <span />
          </div>
          <div className="panel" role="list">
            {g.rows.map((c) => {
              rank++
              return <Row key={c.slug} c={c} rank={rank} page={page} open={open === c.slug} onToggle={() => setOpen(open === c.slug ? null : c.slug)} />
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

function Row({ c, rank, page, open, onToggle }: { c: CandidateDetail; rank: number; page: ResultsPage; open: boolean; onToggle: () => void }) {
  const navigate = useNavigate()
  const today = todayDate(c)
  const be = bestEvidenceAt(c, today)
  const weak = resolveTimeline(c.weakest_link, today)
  const weakClaim = c.chain.claims.find((k) => k.id === weak?.claim)
  const safety = resolveTimeline(c.safety, today)
  const refuted = isRefuted(be)
  const path = candidatePath(page, c)
  const drugFirst = page.query.kind === 'drug'
  const [step, setStep] = useState(0)
  const rowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) setStep(0)
  }, [open])

  const onKey = (e: React.KeyboardEvent) => {
    if (e.target !== rowRef.current) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onToggle()
    }
    if (!open) return
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      setStep((s) => Math.min(3, s + 1))
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setStep((s) => Math.max(0, s - 1))
    }
  }

  return (
    <div className="results__item" role="listitem">
      <div
        ref={rowRef}
        className={`panel__row results__row fade${open ? ' results__row--open' : ''}`}
        style={{ '--i': rank } as React.CSSProperties}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={onToggle}
        onKeyDown={onKey}
      >
        <span className="results__rank figure">{String(rank).padStart(2, '0')}</span>
        <div className="cell cell--name">
          {!drugFirst && <span className="cell__class">{c.drug_class}</span>}
          <span className="cell__line">
            <Link className="cell__name" to={path} onClick={(e) => e.stopPropagation()}>
              {drugFirst ? c.condition : c.name}
            </Link>
            {c.curation === 'draft' && <span className="cell__draft">draft</span>}
          </span>
          {c.delivery && (
            <span className="cell__fine">
              {c.delivery.route}, {c.delivery.barrier.split(';').slice(0, 2).join(';')}
            </span>
          )}
        </div>
        <div className="cell">
          {be && (
            <>
              <span className="cell__line">
                <OutcomeChip be={be} />
                <span>{bestEvidenceText(be)}</span>
              </span>
              {be.label && <span className="cell__sub">{plain(be.label)}</span>}
            </>
          )}
        </div>
        <div className="cell">
          <span>{weakClaim ? cap(weakClaim.short) : 'unknown'}</span>
        </div>
        <div className="cell">
          {safety ? (
            safety.severity === 'none' ? (
              <span className="muted">none flagged</span>
            ) : (
              <>
                <span className="critical medium">{safety.flag}</span>
                <span className="cell__sub">{safety.kind}</span>
              </>
            )
          ) : (
            <span className="muted">not assessed</span>
          )}
        </div>
        <div className="cell cell--count">
          {refuted ? (
            <span className="cell__dash">–</span>
          ) : (
            <>
              <span className="cell__count figure">{unresolvedCount(c, today)}</span>
              <span className="cell__sub">of {c.prerequisites.length} unresolved</span>
            </>
          )}
        </div>
        <Link className="results__open" to={path} aria-label={`Open ${drugFirst ? c.condition : c.name}`} onClick={(e) => e.stopPropagation()}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
      <div className={`grow${open ? ' grow--open' : ''}`} aria-hidden={!open}>
        <div>
          <Walk c={c} step={step} onStep={setStep} onOpen={() => navigate(path)} />
        </div>
      </div>
    </div>
  )
}

// ---- The four-step walk inside a row ---------------------------------------------------------

function Walk({ c, step, onStep, onOpen }: { c: CandidateDetail; step: number; onStep: (s: number) => void; onOpen: () => void }) {
  const reduce = useReducedMotion()
  return (
    <div className="walk">
      <div className="walk__steps" role="tablist" aria-label="Four questions">
        {QUESTIONS.map((q, i) => (
          <button key={q} type="button" role="tab" className="walk__step" aria-selected={step === i} tabIndex={-1} onClick={() => onStep(i)}>
            <span className="walk__n figure">{i + 1}</span>
            <span>{q}</span>
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          className="walk__body"
          initial={reduce ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -4 }}
          transition={{ duration: BASE, ease: EASE_OUT }}
        >
          {step === 0 && <StepPeople c={c} />}
          {step === 1 && <StepMechanism c={c} />}
          {step === 2 && <StepSafety c={c} />}
          {step === 3 && <StepTrial c={c} />}
        </motion.div>
      </AnimatePresence>
      <div className="walk__foot">
        <button type="button" className="btn btn--secondary" onClick={onOpen}>
          Open the appraisal
        </button>
      </div>
    </div>
  )
}

const HUMAN: Source['design'][] = ['rct', 'open-label', 'protocol']

function StepPeople({ c }: { c: CandidateDetail }) {
  const today = todayDate(c)
  const be = bestEvidenceAt(c, today)
  const studies = c.sources.filter((s) => HUMAN.includes(s.design)).sort((a, b) => a.published.localeCompare(b.published))
  return (
    <div className="walk__grid">
      <div className="walk__col">
        <p className="kicker">best evidence</p>
        {be ? (
          <p className="cell__line">
            <OutcomeChip be={be} />
            <span>{bestEvidenceText(be)}</span>
            {be.label && <span className="muted">{plain(be.label)}</span>}
          </p>
        ) : (
          <p className="muted">no human test</p>
        )}
      </div>
      <div className="walk__col">
        <p className="kicker">human studies of this drug in this indication</p>
        {studies.length ? (
          <div className="studies">
            {studies.map((s) => (
              <div className="studies__row" key={s.id}>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.first_author}, <em>{s.journal}</em> {s.year}
                </a>
                <span className="muted">{designWord(s)}</span>
                <span className={s.outcome === 'negative' ? 'critical' : ''}>{s.outcome && s.outcome !== 'na' ? s.outcome : s.design === 'protocol' ? 'registered' : ''}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">none in this record</p>
        )}
      </div>
    </div>
  )
}

function StepMechanism({ c }: { c: CandidateDetail }) {
  const today = todayDate(c)
  const weak = resolveTimeline(c.weakest_link, today)
  const weakClaim = c.chain.claims.find((k) => k.id === weak?.claim)
  const srcById = new Map(c.sources.map((s) => [s.id, s]))
  return (
    <div className="walk__grid">
      <div className="walk__col">
        <p className="kicker">weakest link</p>
        {weak && weakClaim ? (
          <>
            <p className="medium">{cap(weakClaim.short)}</p>
            <p className="muted">{weak.why}</p>
            <p className="walk__sources">
              {weak.sources.map((id) => {
                const s = srcById.get(id)
                return s ? <SourceLine key={id} s={s} /> : null
              })}
            </p>
          </>
        ) : (
          <p className="muted">not identified</p>
        )}
      </div>
      <div className="walk__col">
        <p className="kicker">every link, labelled</p>
        <div className="links">
          {c.chain.claims.map((k) => {
            const r = deriveLabel(k, c.sources, today)
            return (
              <div className="links__row" key={k.id}>
                <span>{k.short}</span>
                <EvidenceLabel label={r.label} qualifier={r.qualifier} />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function StepSafety({ c }: { c: CandidateDetail }) {
  const s = resolveTimeline(c.safety, todayDate(c))
  const srcById = new Map(c.sources.map((x) => [x.id, x]))
  if (!s)
    return (
      <div className="walk__col">
        <p className="medium">not assessed</p>
        <p className="muted">This record carries no safety review. Absence of a flag here is missing data, not reassurance.</p>
      </div>
    )
  return (
    <div className="walk__grid">
      <div className="walk__col">
        <p className="kicker">{s.kind}</p>
        <p className={`medium${s.severity === 'none' ? '' : ' critical'}`}>{s.flag}</p>
        <p>{cap(s.reason)}.</p>
        <p className="walk__sources">
          {s.sources.map((id) => {
            const src = srcById.get(id)
            return src ? <SourceLine key={id} s={src} /> : null
          })}
        </p>
      </div>
      <div className="walk__col">
        <p className="kicker">in the likely trial population</p>
        <p className="muted">{s.population}</p>
      </div>
    </div>
  )
}

function StepTrial({ c }: { c: CandidateDetail }) {
  const today = todayDate(c)
  const n = unresolvedCount(c, today)
  return (
    <div className="walk__col">
      <p className="kicker">
        before a trial, {n} of {c.prerequisites.length} unresolved
      </p>
      <div className="prereqs">
        {c.prerequisites.map((p) => {
          const s = resolvePrerequisite(p, today)
          return (
            <div className="prereqs__row" key={p.id}>
              <span>{p.condition}</span>
              <span className={`medium${s?.resolution === 'unmet' ? ' critical' : ''}`}>{s?.word ?? 'unknown'}</span>
              <span className="muted">{s?.note ?? ''}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---- Board ---------------------------------------------------------------------------------

const STAGES: { id: TrialStage; word: string }[] = [
  { id: 'preclinical', word: 'preclinical' },
  { id: 'open-label', word: 'open-label' },
  { id: 'phase-2', word: 'phase 2 concluded' },
  { id: 'phase-3-enrolling', word: 'phase 3 enrolling' },
  { id: 'phase-3', word: 'phase 3 concluded' },
]

function Board({ page }: { page: ResultsPage }) {
  const navigate = useNavigate()
  const drugFirst = page.query.kind === 'drug'
  return (
    <div className="board arrive" style={{ '--i': 1 } as React.CSSProperties}>
      {STAGES.map((stage, si) => {
        const cards = page.candidates.filter((c) => bestEvidenceAt(c, todayDate(c))?.stage === stage.id)
        return (
          <div className="board__col" key={stage.id}>
            <div className="board__head">
              <span className="medium">{stage.word}</span>
              <span className="board__count figure">{cards.length}</span>
            </div>
            {cards.map((c, i) => {
              const be = bestEvidenceAt(c, todayDate(c))!
              const weak = resolveTimeline(c.weakest_link, todayDate(c))
              return (
                <div key={c.slug} className="fade" style={{ '--i': si + i } as React.CSSProperties}>
                  <div
                    className="panel card"
                    onClick={() => navigate(candidatePath(page, c))}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(candidatePath(page, c))}
                    role="link"
                    tabIndex={0}
                  >
                    {!drugFirst && <span className="card__class">{c.drug_class}</span>}
                    <span className="card__name">{drugFirst ? c.condition : c.name}</span>
                    <span className="cell__line">
                      <OutcomeChip be={be} />
                      <span className="cell__sub">{be.n !== undefined ? `n = ${be.n}` : bestEvidenceText(be)}</span>
                    </span>
                    <span className="card__weak">{weak?.why}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
