/* elute — Working → Results on one route.
 * Working: the ledger builds row by row beside a panel showing the latest finished step.
 * Results: a grouped list (not yet refuted / refuted in controlled studies) or a board by trial stage. */

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Header, Kicker } from '../components/frame'
import { WorkingRow, type RowState } from '../components/Ledger'
import { bestEvidenceText, formatClock, formatDate, OutcomeChip } from '../components/evidence'
import { rowDurations, source } from '../data/source'
import type { BestEvidence, CandidateDetail, QueryRecord, ResultsPage, TrialStage } from '../data/types'
import { bestEvidenceAt, ledgerResult, resolveTimeline, todayDate, unresolvedCount } from '../lib/evidence'
import { touchRecent } from '../lib/recent'

type Phase = 'loading' | 'working' | 'results' | 'missing'

const KIND_WORD = { condition: 'condition → candidates', drug: 'drug → indications', pair: 'pair → appraisal' } as const

export function Query() {
  const { query = '' } = useParams()
  const navigate = useNavigate()
  const [q, setQ] = useState<QueryRecord | undefined>()
  const [phase, setPhase] = useState<Phase>('loading')
  const [done, setDone] = useState(0) // rows completed
  const [page, setPage] = useState<ResultsPage | undefined>()
  const [params, setParams] = useSearchParams()
  const view: 'list' | 'board' = params.get('view') === 'board' ? 'board' : 'list'
  const setView = (v: 'list' | 'board') => {
    const p = new URLSearchParams(params)
    if (v === 'board') p.set('view', 'board')
    else p.delete('view')
    setParams(p, { replace: true })
  }
  const [selectedStep, setSelectedStep] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const started = useRef(0)

  useEffect(() => {
    let cancelled = false
    setPhase('loading')
    setDone(0)
    setPage(undefined)
    setSelectedStep(null)
    source.query(query).then(async (rec) => {
      if (cancelled) return
      if (!rec) {
        setPhase('missing')
        return
      }
      setQ(rec)
      touchRecent(rec.slug)
      const finish = async () => {
        const p = await source.results(query)
        if (cancelled) return
        if (rec.pair) {
          navigate(`/q/${query}/${rec.pair.candidate}`, { replace: true })
          return
        }
        setPage(p)
        setPhase('results')
      }
      if (source.hasRun(query)) {
        setDone(rec.ledger.rows.length)
        await finish()
        return
      }
      setPhase('working')
      started.current = performance.now()
      let i = 0
      for await (const _ev of source.run(query)) {
        if (cancelled) return
        i++
        setDone(i)
        setSelectedStep((s) => (s === null || s === i - 2 ? i - 1 : s))
      }
      await finish()
    }).catch((e: unknown) => {
      // a rejected POST (backend down, unresolvable pair) is a missing appraisal, not a page stuck on loading
      console.warn('[elute] query failed', e)
      if (!cancelled) setPhase('missing')
    })
    return () => {
      cancelled = true
    }
  }, [query, navigate])

  // The status line's clock
  useEffect(() => {
    if (phase !== 'working') return
    const t = setInterval(() => setElapsed(performance.now() - started.current), 250)
    return () => clearInterval(t)
  }, [phase])

  const today = page?.today ?? '2026-09-19'

  if (phase === 'missing' || (q && !q)) {
    return (
      <main className="page">
        <Header />
        <div className="col">
          <Missing />
        </div>
      </main>
    )
  }

  const durations = q ? rowDurations(q.ledger) : []
  const totalMs = durations.reduce((a, b) => a + b, 0)
  const recorded = q?.ledger.kind === 'recorded'
  const selected = q && selectedStep !== null ? q.ledger.rows[selectedStep] : undefined

  return (
    <main className="page">
      <Header />
      {q && (
        <div className="col">
          <div className="title arrive">
            <div className="title__main">
              <Kicker>{phase === 'working' ? KIND_WORD[q.kind] : q.kind === 'drug' ? 'drug' : 'condition'}</Kicker>
              <h1 className="display-sm">{q.heading}</h1>
              {phase === 'results' && page && (
                <p className="title__sub">
                  {page.candidates.length} candidates with human data · ordered by fewest unresolved prerequisites as of {formatDate(today)} ·{' '}
                  <Link to={`/q/${q.slug}/sources`}>sources</Link>
                </p>
              )}
              {phase === 'working' && <p className="title__sub">{q.resolved}</p>}
            </div>
            {phase === 'working' && (
              <p className="status" aria-live="polite">
                step {Math.min(done + 1, q.ledger.rows.length)} of {q.ledger.rows.length} · {formatClock(elapsed)} ·{' '}
                {recorded ? `accelerated replay, about ${Math.round(totalMs / 1000)} s` : `scripted, about ${Math.round(totalMs / 1000)} s`} · results open when done
              </p>
            )}
            {phase === 'results' && (
              <div className="title__aside">
                <div className="seg" role="tablist" aria-label="View">
                  <button type="button" role="tab" className="seg__item" aria-selected={view === 'list'} onClick={() => setView('list')}>
                    List
                  </button>
                  <button type="button" role="tab" className="seg__item" aria-selected={view === 'board'} onClick={() => setView('board')}>
                    Board
                  </button>
                </div>
              </div>
            )}
          </div>

          {phase === 'working' && (
            <div className="working arrive" style={{ '--i': 1 } as React.CSSProperties}>
              {/* The ledger's shadow is raspberry until the last step completes */}
              <ul className={`panel${done < q.ledger.rows.length ? ' panel--working' : ''}`} aria-label="Evidence ledger">
                {q.ledger.rows.map((row, i) => {
                  const state: RowState = i < done ? 'done' : i === done ? 'running' : 'pending'
                  return (
                    <WorkingRow
                      key={row.id}
                      row={row}
                      index={i}
                      state={state}
                      cutoff={today}
                      selected={selectedStep === i}
                      onSelect={() => setSelectedStep(i)}
                      durationMs={durations[i]}
                      recorded={!!recorded}
                    />
                  )
                })}
              </ul>
              {selected && (
                <div className="arrive" key={selected.id}>
                  <aside className="panel panel--pad step-panel" aria-label={`Step ${selected.id}`}>
                    <Kicker>
                      step {selectedStep! + 1} · {selected.step}
                    </Kicker>
                    <div className="step-panel__list">
                      {selected.records
                        .filter((r) => r.published <= today)
                        .slice(0, 8)
                        .map((r, i) => (
                          <div className="step-panel__item" key={i}>
                            <span>{r.value}</span>
                            <span className="faint">{r.published.slice(0, 4)}</span>
                          </div>
                        ))}
                      {selected.records.length === 0 && <div className="step-panel__item muted">nothing returned</div>}
                    </div>
                    <p className="step-panel__foot">
                      {ledgerResult(selected, today)} · {selected.source}
                    </p>
                  </aside>
                </div>
              )}
            </div>
          )}

          {phase === 'results' && page && (view === 'list' ? <ResultsList page={page} /> : <Board page={page} />)}
        </div>
      )}
    </main>
  )
}

export function Missing() {
  if (source.mode === 'live') {
    return (
      <div className="empty">
        <h1 className="display-sm">no appraisal at this address</h1>
        <p>
          Live mode appraises one drug for one condition. <Link to="/">Ask again</Link> as “nilotinib for Parkinson’s disease”.
        </p>
      </div>
    )
  }
  return (
    <div className="empty">
      <h1 className="display-sm">no curated appraisal at this address</h1>
      <p>
        Fixture mode covers <Link to="/q/parkinsons-disease">Parkinson’s disease</Link>, <Link to="/q/metformin">metformin</Link>, and{' '}
        <Link to="/q/nilotinib--parkinsons-disease">nilotinib for Parkinson’s</Link>.
      </p>
    </div>
  )
}

export function candidatePath(page: ResultsPage, c: CandidateDetail) {
  return `/q/${page.query.slug}/${page.query.kind === 'drug' ? c.condition_slug : c.drug_slug}`
}

const isRefuted = (be?: BestEvidence) => !!be && be.controlled && be.outcome === 'negative'

// ---- List ----------------------------------------------------------------------------------

function ResultsList({ page }: { page: ResultsPage }) {
  const drugFirst = page.query.kind === 'drug'
  const groups: { word: string; rows: CandidateDetail[] }[] = [
    { word: 'not yet refuted', rows: page.candidates.filter((c) => !isRefuted(bestEvidenceAt(c, todayDate(c)))) },
    { word: 'refuted in controlled studies', rows: page.candidates.filter((c) => isRefuted(bestEvidenceAt(c, todayDate(c)))) },
  ]
  let rank = 0
  return (
    <div className="arrive" style={{ '--i': 1 } as React.CSSProperties}>
      <div className="thead results__head">
        <span className="kicker">#</span>
        <span className="kicker">{drugFirst ? 'indication' : 'candidate'}</span>
        <span className="kicker">best evidence</span>
        <span className="kicker">weakest link</span>
        <span className="kicker">safety</span>
        <span className="kicker" style={{ textAlign: 'right' }}>
          unresolved
        </span>
      </div>
      {groups
        .filter((g) => g.rows.length)
        .map((g) => (
          <div key={g.word}>
            <p className="results__group">{g.word}</p>
            <div className="panel" role="list">
              {g.rows.map((c) => {
                rank++
                return <Row key={c.slug} c={c} rank={rank} page={page} />
              })}
            </div>
          </div>
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
  const refuted = isRefuted(be)
  const path = candidatePath(page, c)
  const drugFirst = page.query.kind === 'drug'
  return (
    <div className="panel__row results__row fade" style={{ '--i': rank } as React.CSSProperties} role="listitem" onClick={() => navigate(path)}>
      <span className="results__rank">{String(rank).padStart(2, '0')}</span>
      <div className="cell">
        <Link className="display-xs cell__name" to={path} onClick={(e) => e.stopPropagation()}>
          {drugFirst ? c.condition : c.name}
        </Link>
        <span className="cell__sub">
          {c.mechanism.split('→').slice(1).join('→').trim() || c.drug_class}
          {c.curation === 'draft' ? ' · draft' : ''}
        </span>
      </div>
      <div className="cell">
        {be && (
          <>
            <span className="cell__line">
              <OutcomeChip be={be} />
              <span>{bestEvidenceText(be)}</span>
            </span>
            <span className="cell__sub">{be.label}</span>
          </>
        )}
      </div>
      <div className="cell">
        <span>{weakClaim ? `${cap(weakClaim.short)}` : '—'}</span>
        {weak && <span className="cell__sub">{weak.why}</span>}
      </div>
      <div className="cell">
        {safety ? (
          safety.severity === 'none' ? (
            <span className="muted">none flagged · label reviewed</span>
          ) : (
            <span>
              <span className="critical medium">{safety.flag}</span> <span className="cell__sub">— {safety.kind}</span>
            </span>
          )
        ) : (
          <span className="muted">not assessed</span>
        )}
      </div>
      {refuted ? <span className="cell__dash">–</span> : <span className="cell__count">{unresolvedCount(c, today)}</span>}
    </div>
  )
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

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
              <span className="board__count">{cards.length}</span>
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
                    <span className="display-xs">{drugFirst ? c.condition : c.name}</span>
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
