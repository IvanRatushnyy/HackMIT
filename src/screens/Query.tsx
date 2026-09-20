/* elute — Working → Results on one route.
 * Working: the ledger builds row by row beside a panel showing the latest finished step.
 * Results: a grouped list (not yet refuted / refuted in controlled studies) or a board by trial stage. */

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Header, Kicker } from '../components/frame'
import { WorkingLedger } from '../components/Ledger'
import { formatClock, formatDate, plain } from '../components/evidence'
import { rowDurations, source } from '../data/source'
import type { QueryRecord, ResultsPage } from '../data/types'
import { Results } from './Results'
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
      }
      await finish()
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
                  {page.candidates.length} candidates with human data as of {formatDate(today)}.{' '}
                  <Link to={`/q/${q.slug}/sources`}>sources</Link>
                </p>
              )}
              {phase === 'working' && <p className="title__sub">{plain(q.resolved)}</p>}
            </div>
            {phase === 'working' && (
              <p className="status" aria-live="polite">
                step {Math.min(done + 1, q.ledger.rows.length)} of {q.ledger.rows.length}, {formatClock(elapsed)},{' '}
                {recorded ? `accelerated replay, about ${Math.round(totalMs / 1000)} s` : `scripted, about ${Math.round(totalMs / 1000)} s`}, results open when done
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
              <WorkingLedger
                rows={q.ledger.rows}
                done={done}
                kind={q.kind}
                cutoff={today}
                selected={selectedStep}
                onSelect={setSelectedStep}
                durations={durations}
                recorded={!!recorded}
              />
            </div>
          )}

          {phase === 'results' && page && <Results page={page} view={view} />}
        </div>
      )}
    </main>
  )
}

function Missing() {
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
