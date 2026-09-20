/* elute — Working, stage 2 of 4: the ten checks build one at a time, then the page hands over to the
 * appraisal. An appraisal is one drug for one condition (the backend's Phase 1 contract), so any other
 * address is a missing one. */

import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Header } from '../components/frame'
import { Pipeline } from '../components/Pipeline'
import { rowDurations, source } from '../data/source'
import type { QueryRecord } from '../data/types'
import { touchRecent } from '../lib/recent'

type Phase = 'loading' | 'working' | 'missing'


export function Query() {
  const { query = '' } = useParams()
  const navigate = useNavigate()
  const [q, setQ] = useState<QueryRecord | undefined>()
  const [phase, setPhase] = useState<Phase>('loading')
  const [done, setDone] = useState(0) // rows completed
  const [selectedStep, setSelectedStep] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    setPhase('loading')
    setDone(0)
    setSelectedStep(null)
    source.query(query).then(async (rec) => {
      if (cancelled) return
      if (!rec?.pair) {
        setPhase('missing')
        return
      }
      const pair = rec.pair
      setQ(rec)
      touchRecent(rec.slug)
      const finish = async () => {
        await source.results(query)
        if (cancelled) return
        navigate(`/q/${query}/${pair.candidate}`, { replace: true })
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


  const today = new Date().toISOString().slice(0, 10)

  if (phase === 'missing') {
    return (
      <main className="page">
        <Header stage="research" query={query} />
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
      <Header stage="research" query={query} />
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
          {phase === 'working' && (
            <div className="working arrive" style={{ '--i': 1 } as React.CSSProperties}>
              <Pipeline rows={q.ledger.rows} done={done} kind={q.kind} cutoff={today} selected={selectedStep} onSelect={setSelectedStep} durations={durations} />
            </div>
          )}
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
          An appraisal is one drug for one condition. <Link to="/">Ask again</Link> as “nilotinib for Parkinson’s disease”.
        </p>
      </div>
    )
  }
  return (
    <div className="empty">
      <h1 className="display-sm">no curated appraisal at this address</h1>
      <p>
        An appraisal is one drug for one condition. Fixture mode covers <Link to="/q/nilotinib--parkinsons-disease">nilotinib for Parkinson’s disease</Link>.
      </p>
    </div>
  )
}
