/* elute — Working, stage 2 of 4: the ten checks build one at a time, then the page hands over to the appraisal.
 *
 * The page says up front how long it expects to take and on what basis, keeps a clock and a remaining-time estimate
 * while it runs, shows what each step is doing as it does it, and keeps everything it showed (src/lib/runlog.ts) so
 * the stage can be reopened from the rail without running again. An appraisal is one drug for one condition (the
 * backend's Phase 1 contract), so any other address is a missing one. */

import { useEffect, useMemo, useState } from 'react'
import { ArrowRight } from '@phosphor-icons/react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Header } from '../components/frame'
import { Pipeline } from '../components/Pipeline'
import type { StepLive } from '../components/Step'
import { rowDurations, source } from '../data/source'
import type { LedgerRow, QueryRecord } from '../data/types'
import { touchRecent } from '../lib/recent'
import { clockWord, durationWord } from '../lib/runlog'

type Phase = 'loading' | 'working' | 'done' | 'missing'

const HANDOVER_MS = 1600
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export function Query() {
  const { query = '' } = useParams()
  const navigate = useNavigate()
  const [q, setQ] = useState<QueryRecord | undefined>()
  const [rows, setRows] = useState<LedgerRow[]>([])
  const [phase, setPhase] = useState<Phase>('loading')
  const [done, setDone] = useState(0) // rows completed
  const [live, setLive] = useState<Record<string, StepLive>>({})
  const [selectedStep, setSelectedStep] = useState<number | null>(null)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [finishedAt, setFinishedAt] = useState<number | null>(null)
  const [revisit, setRevisit] = useState(false)
  const [now, setNow] = useState(() => performance.now())

  useEffect(() => {
    let cancelled = false
    setPhase('loading')
    setDone(0)
    setLive({})
    setSelectedStep(null)
    setStartedAt(null)
    setFinishedAt(null)
    setRevisit(false)
    source
      .query(query)
      .then(async (rec) => {
        if (cancelled) return
        if (!rec?.pair) {
          setPhase('missing')
          return
        }
        const pair = rec.pair
        setQ(rec)
        setRows(rec.ledger.rows)
        touchRecent(rec.slug)
        if (source.hasRun(query)) {
          // reopened from the rail or reloaded: everything as it settled, no handover
          setDone(rec.ledger.rows.length)
          setRevisit(true)
          setSelectedStep(rec.ledger.rows.length - 1)
          setPhase('done')
          return
        }
        setPhase('working')
        const t0 = performance.now()
        setStartedAt(t0)
        let i = 0
        for await (const ev of source.run(query)) {
          if (cancelled) return
          const t = performance.now() - t0
          if (ev.phase === 'question') {
            setLive((prev) => {
              const s: StepLive = prev[ev.step] ?? { notes: [] }
              return { ...prev, [ev.step]: { ...s, reasoning: ev.reasoning ?? s.reasoning, startedAt: s.startedAt ?? t } }
            })
          } else if (ev.phase === 'progress') {
            setLive((prev) => {
              const s = prev[ev.step] ?? { notes: [], startedAt: t }
              return { ...prev, [ev.step]: { ...s, notes: [...s.notes, { at_ms: ev.at_ms ?? Math.round(t), note: ev.note ?? '' }] } }
            })
          } else if (ev.phase === 'settled' && ev.row) {
            i++
            const row = ev.row
            setRows((prev) => prev.map((r) => (r.id === ev.step ? row : r)))
            setLive((prev) => {
              const s: StepLive = prev[ev.step] ?? { notes: [] }
              return { ...prev, [ev.step]: { ...s, settledAt: t } }
            })
            setDone(i)
          }
        }
        if (cancelled) return
        setFinishedAt(performance.now())
        setPhase('done')
        await sleep(HANDOVER_MS)
        if (cancelled) return
        navigate(`/q/${query}/${pair.candidate}`, { replace: true })
      })
      .catch((e: unknown) => {
        // a rejected POST (backend down, unresolvable pair) is a missing appraisal, not a page stuck on loading
        console.warn('[elute] query failed', e)
        if (!cancelled) setPhase('missing')
      })
    return () => {
      cancelled = true
    }
  }, [query, navigate])

  // the clock, a quarter-second at a time, only while working
  useEffect(() => {
    if (phase !== 'working') return
    const id = setInterval(() => setNow(performance.now()), 250)
    return () => clearInterval(id)
  }, [phase])

  const today = new Date().toISOString().slice(0, 10)
  const durations = useMemo(() => (q ? rowDurations(q.ledger) : []), [q])
  const total = rows.length

  // time: elapsed overall, elapsed in the current step, and what is expected to remain
  const elapsed = startedAt === null ? 0 : (finishedAt ?? now) - startedAt
  const current = done < total ? rows[done] : undefined
  const currentStart = (current && live[current.id]?.startedAt) ?? (done > 0 ? live[rows[done - 1].id]?.settledAt : 0) ?? 0
  const currentElapsed = current ? Math.max(0, elapsed - currentStart) : 0
  const remainingPlanned = durations.slice(done).reduce((s, d) => s + d, 0) - currentElapsed
  const remaining = Math.max(0, remainingPlanned)
  const overrun = !!current && durations[done] > 1500 && currentElapsed > durations[done] * 1.5
  const behind = remainingPlanned < 0
  const expectedTotal = durations.reduce((s, d) => s + d, 0)
  const basis = q?.ledger.estimate?.basis ?? (q?.ledger.kind === 'scripted' ? 'a scripted sequence, not a live run' : undefined)
  const replay = q?.ledger.replay_of
  const recordedTotal = q?.ledger.recorded_total_ms ?? rows.reduce((s, r) => s + (r.elapsed_ms ?? 0), 0)

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

  const candidateHref = q?.pair ? `/q/${query}/${q.pair.candidate}` : undefined

  return (
    <main className="page">
      <Header stage="research" query={query} candidate={phase === 'done' ? q?.pair?.candidate : undefined} />
      {q && (phase === 'working' || phase === 'done') && (
        <div className="col">
          <div className="working-title arrive">
            <div className="title__main">
              <h1 className="display-sm">
                {phase === 'done' ? 'checked' : 'checking'} {q.heading}
              </h1>
              <p className="working-title__basis">
                {phase === 'working' && basis && (
                  <>
                    expected to take about {durationWord(expectedTotal)}, from {basis}
                  </>
                )}
                {phase === 'done' && replay && (
                  <>
                    a replay of the run recorded {replay.recorded_at.replace('T', ' ').slice(0, 16)} UTC, {durationWord(replay.elapsed_ms)} of real time
                    {replay.llm === 'openai' ? ', reasoning worded by the model' : ', no model: template reasoning only'}
                  </>
                )}
                {phase === 'done' && !replay && q.ledger.kind === 'recorded' && recordedTotal > 0 && <>a live run, {durationWord(recordedTotal)} of tool and model time</>}
                {phase === 'done' && !replay && q.ledger.kind === 'scripted' && <>a scripted sequence with real source names, not a live run</>}
              </p>
            </div>
            <div className="working-title__aside">
              <p className="working-title__count" aria-live="polite">
                <b>{Math.min(done, total)}</b> of {total} done
              </p>
              <p className="working-title__time" aria-live="polite">
                {phase === 'working' && (
                  <>
                    <span className="working-title__clock">{clockWord(elapsed)}</span> elapsed
                    {' · '}
                    {behind ? <span className="working-title__over">longer than expected</span> : remaining > 0 ? <>about {durationWord(remaining)} left</> : <>almost there</>}
                  </>
                )}
                {phase === 'done' && !revisit && (
                  <>
                    done in {durationWord(elapsed || recordedTotal || 0)}
                    <span className="working-title__handover"> · opening the appraisal</span>
                  </>
                )}
                {phase === 'done' && revisit && (
                  <>
                    {recordedTotal > 0 && <>took {durationWord(recordedTotal)} · </>}
                    kept in this browser
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="working arrive" style={{ '--i': 1 } as React.CSSProperties}>
            <Pipeline rows={rows} done={done} kind={q.kind} cutoff={today} selected={selectedStep} onSelect={setSelectedStep} durations={durations} live={live} currentElapsedMs={currentElapsed} overrun={overrun} />
          </div>
          {phase === 'done' && revisit && candidateHref && (
            <div className="working-foot arrive" style={{ '--i': 2 } as React.CSSProperties}>
              <p className="working-foot__note">Every step above is as it settled. The appraisal stands on these records.</p>
              <Link className="btn btn--primary" to={candidateHref}>
                open the appraisal
                <ArrowRight size={16} weight="bold" aria-hidden="true" />
              </Link>
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
