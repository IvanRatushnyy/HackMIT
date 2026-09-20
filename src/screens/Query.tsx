/* elute — Working → Results on one route.
 * Working: the ledger builds row by row beside a panel showing the latest finished step.
 * Results: a grouped list (not yet refuted / refuted in controlled studies) or a board by trial stage. */

import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Header } from '../components/frame'
import { Pipeline } from '../components/Pipeline'
import { formatDate } from '../components/evidence'
import { rowDurations, source } from '../data/source'
import type { QueryRecord, ResultsPage } from '../data/types'
import { Results } from './Results'
import { touchRecent } from '../lib/recent'

type Phase = 'loading' | 'working' | 'results' | 'missing'


export function Query() {
  const { query = '' } = useParams()
  const navigate = useNavigate()
  const [q, setQ] = useState<QueryRecord | undefined>()
  const [phase, setPhase] = useState<Phase>('loading')
  const [done, setDone] = useState(0) // rows completed
  const [page, setPage] = useState<ResultsPage | undefined>()
  const [params] = useSearchParams()
  const view: 'list' | 'board' = params.get('view') === 'board' ? 'board' : 'list'
  const [selectedStep, setSelectedStep] = useState<number | null>(null)

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
      let i = 0
      for await (const _ev of source.run(query)) {
        if (cancelled) return
        i++
        setDone(i)
      }
      await new Promise((r) => setTimeout(r, 1100))
      if (cancelled) return
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


  const today = page?.today ?? '2026-09-19'

  if (phase === 'missing' || (q && !q)) {
    return (
      <main className="page">
        <Header stage="research" />
        <div className="col">
          <Missing />
        </div>
      </main>
    )
  }

  const durations = q ? rowDurations(q.ledger) : []
  const recorded = q?.ledger.kind === 'recorded'

  const total = q?.ledger.rows.length ?? 0
  return (
    <main className="page">
      <Header stage={phase === 'results' ? 'candidates' : 'research'} />
      {q && (
        <div className="col">
          {phase === 'working' && (
            <div className="working-title arrive">
              <div className="title__main">
                <h1 className="display-sm">checking {q.heading}</h1>
              </div>
              <p className="working-title__count" aria-live="polite">
                <b>{Math.min(done, total)}</b> of {total} done{recorded ? '' : ', scripted replay'}
              </p>
            </div>
          )}
          {phase === 'results' && page && (
            <div className="title arrive">
              <div className="title__main">
                <h1 className="display-sm">{q.heading}</h1>
                <p className="purpose">
                  {page.candidates.length} approved drugs with human data in this indication as of {formatDate(today)}. Open one to read the case against it.{' '}
                  <Link to={`/q/${q.slug}/sources`}>what was checked</Link>
                </p>
              </div>
            </div>
          )}

          {phase === 'working' && (
            <div className="working arrive" style={{ '--i': 1 } as React.CSSProperties}>
              <Pipeline rows={q.ledger.rows} done={done} kind={q.kind} cutoff={today} selected={selectedStep} onSelect={setSelectedStep} durations={durations} />
            </div>
          )}

          {phase === 'results' && page && <Results page={page} view={view} />}
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
