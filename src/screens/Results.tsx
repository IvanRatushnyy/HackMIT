/* elute — Results: two registers (tested in placebo-controlled trials / not yet tested against placebo)
 * or a board by trial stage. Each row answers the scientist's four questions in their order; selecting a
 * row opens the same four questions as a stepper in place. Rendered on /q/:query once the ledger has run. */

import { Link, useNavigate } from 'react-router-dom'
import { bestEvidenceText, OutcomeChip, plain } from '../components/evidence'
import type { CandidateDetail, ResultsPage, TrialStage } from '../data/types'
import { bestEvidenceAt, resolveTimeline, todayDate } from '../lib/evidence'
import { registers } from '../lib/registers'

export function Results({ page, view }: { page: ResultsPage; view: 'list' | 'board' }) {
  return view === 'list' ? <ResultsList page={page} /> : <Board page={page} />
}

export function candidatePath(page: ResultsPage, c: CandidateDetail) {
  return `/q/${page.query.slug}/${page.query.kind === 'drug' ? c.condition_slug : c.drug_slug}`
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)


// ---- List ----------------------------------------------------------------------------------
// One row per candidate: the name, its class, and the three things a scientist asks first: the best human
// evidence, the weakest link in the mechanism, and the safety flag. Everything else waits on the appraisal.

function ResultsList({ page }: { page: ResultsPage }) {
  const drugFirst = page.query.kind === 'drug'
  let rank = 0
  return (
    <div className="arrive results" style={{ '--i': 1 } as React.CSSProperties}>
      {registers(page.candidates).map((g) => (
        <section key={g.id} className="register" aria-labelledby={`register-${g.id}`}>
          <div className="register__head">
            <h2 className="register__word" id={`register-${g.id}`}>
              {g.word}
            </h2>
            <span className="register__n">{g.rows.length}</span>
          </div>
          <div className="thead results__head">
            <span />
            <span className="kicker">{drugFirst ? 'indication' : 'candidate'}</span>
            <span className="kicker">best human evidence</span>
            <span className="kicker">weakest link</span>
            <span className="kicker">safety</span>
            <span />
          </div>
          <div className="panel" role="list">
            {g.rows.map((c) => {
              rank++
              return <Row key={c.slug} c={c} rank={rank} page={page} />
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

function Row({ c, rank, page }: { c: CandidateDetail; rank: number; page: ResultsPage }) {
  const navigate = useNavigate()
  const today = todayDate(c)
  const be = bestEvidenceAt(c, today)
  const weak = resolveTimeline(c.weakest_link, today)
  const weakClaim = c.chain.claims.find((k) => k.id === weak?.claim)
  const safety = resolveTimeline(c.safety, today)
  const path = candidatePath(page, c)
  const drugFirst = page.query.kind === 'drug'
  const mechanism = c.mechanism.split('→').slice(1).join('→').trim()
  return (
    <div
      className="panel__row results__row fade"
      style={{ '--i': rank } as React.CSSProperties}
      role="listitem link"
      tabIndex={0}
      onClick={() => navigate(path)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate(path)
        }
      }}
    >
      <span className="results__rank figure">{String(rank).padStart(2, '0')}</span>
      <div className="cell cell--name">
        <span className="cell__name">{drugFirst ? c.condition : c.name}</span>
        {!drugFirst && <span className="cell__class">{c.drug_class}</span>}
        <span className="cell__mech">{mechanism}</span>
      </div>
      <div className="cell">
        {be ? (
          <>
            <span className="cell__line">
              <OutcomeChip be={be} />
              <span className="cell__strong">{bestEvidenceText(be)}</span>
            </span>
            {be.label && <span className="cell__sub">{plain(be.label)}</span>}
          </>
        ) : (
          <span className="muted">no human test</span>
        )}
      </div>
      <div className="cell">
        <span className="cell__strong">{weakClaim ? cap(weakClaim.short) : 'unknown'}</span>
        {weak && <span className="cell__sub">{weak.why}</span>}
      </div>
      <div className="cell">
        {safety ? (
          safety.severity === 'none' ? (
            <span className="muted">none flagged</span>
          ) : (
            <>
              <span className="critical cell__strong">{safety.flag}</span>
              <span className="cell__sub">{safety.kind}</span>
            </>
          )
        ) : (
          <span className="muted">not assessed</span>
        )}
      </div>
      <Link className="results__open" to={path} aria-label={`Open ${drugFirst ? c.condition : c.name}`} onClick={(e) => e.stopPropagation()}>
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
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
