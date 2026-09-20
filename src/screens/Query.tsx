/* elute — Working → Results on one route. The ledger fills the sheet while it runs,
 * then collapses into one disclosure line and the ordered rows rise in beneath it. */

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Banner, Header, Sheet } from '../components/frame'
import { LedgerDisclosure, LedgerList } from '../components/Ledger'
import { BestEvidenceBadge, DriverBar } from '../components/evidence'
import { source } from '../data/source'
import type { CandidateDetail, LedgerRow, QueryRecord, ResultsPage } from '../data/types'
import { bestEvidenceAt, CLINICAL_LEVELS, clinicalLevel, resolveTimeline, todayDate, unresolvedCount } from '../lib/evidence'
import { formatDate } from '../components/evidence'

type Phase = 'loading' | 'working' | 'results' | 'missing'

export function Query({ banner, replayBanner }: { banner: string; replayBanner: string }) {
  const { query = '' } = useParams()
  const navigate = useNavigate()
  const [q, setQ] = useState<QueryRecord | undefined>()
  const [phase, setPhase] = useState<Phase>('loading')
  const [rows, setRows] = useState<LedgerRow[]>([])
  const [running, setRunning] = useState<string | undefined>()
  const [page, setPage] = useState<ResultsPage | undefined>()
  const [view, setView] = useState<'list' | 'scatter'>('list')

  useEffect(() => {
    let cancelled = false
    setPhase('loading')
    setRows([])
    setPage(undefined)
    source.query(query).then(async (rec) => {
      if (cancelled) return
      if (!rec) {
        setPhase('missing')
        return
      }
      setQ(rec)
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
        setRows(rec.ledger.rows)
        await finish()
        return
      }
      setPhase('working')
      const next = rec.ledger.rows
      let i = 0
      setRunning(next[0]?.id)
      for await (const ev of source.run(query)) {
        if (cancelled) return
        i++
        setRows(next.slice(0, i))
        setRunning(ev.done ? undefined : next[i]?.id)
      }
      await finish()
    })
    return () => {
      cancelled = true
    }
  }, [query, navigate])

  const today = page?.today ?? '2026-09-19'
  const isWorking = phase === 'working'

  return (
    <main className="page">
      <Header />
      <Banner text={isWorking || phase === 'results' ? replayBanner : banner} />
      <div className="page__body page__body--full">
        <Sheet>
          {phase === 'missing' && (
            <div className="empty">
              <h1 className="display-md">No curated appraisal at this address</h1>
              <p>
                Fixture mode covers <Link to="/q/parkinsons-disease">Parkinson’s disease</Link>, <Link to="/q/metformin">metformin</Link>, and{' '}
                <Link to="/q/nilotinib--parkinsons-disease">nilotinib for Parkinson’s</Link>.
              </p>
            </div>
          )}
          {q && phase !== 'missing' && (
            <>
              <div className="query__head">
                <h1 className="display-md">{q.heading}</h1>
                <p className="query__sub">
                  {q.resolved}
                  {q.subheading ? ` · ${q.subheading}` : ''}
                </p>
              </div>

              {isWorking && (
                <>
                  {running && rows.length < q.ledger.rows.length && (
                    <p className="section__lede" aria-live="polite">
                      Working — step {rows.length + 1} of {q.ledger.rows.length}
                    </p>
                  )}
                  <LedgerList
                    rows={running ? [...rows, q.ledger.rows[rows.length]].filter(Boolean) : rows}
                    cutoff={today}
                    isToday
                    runningId={running}
                    animate
                  />
                </>
              )}

              {phase === 'results' && page && (
                <>
                  <LedgerDisclosure rows={q.ledger.rows} cutoff={today} isToday />
                  <div className="results__bar">
                    <p className="section__lede">
                      Ordered by fewest unresolved trial prerequisites as of {formatDate(today)} (fixture date) — not by a score.
                    </p>
                    <div className="seg" role="tablist" aria-label="View">
                      <button type="button" role="tab" className="seg__item" aria-selected={view === 'list'} onClick={() => setView('list')}>
                        List
                      </button>
                      <button type="button" role="tab" className="seg__item" aria-selected={view === 'scatter'} onClick={() => setView('scatter')}>
                        Scatter
                      </button>
                    </div>
                  </div>
                  {view === 'list' ? <Results page={page} /> : <Scatter page={page} />}
                </>
              )}
            </>
          )}
        </Sheet>
      </div>
    </main>
  )
}

function candidatePath(page: ResultsPage, c: CandidateDetail) {
  return `/q/${page.query.slug}/${page.query.kind === 'drug' ? c.condition_slug : c.drug_slug}`
}

function Results({ page }: { page: ResultsPage }) {
  const navigate = useNavigate()
  const drugFirst = page.query.kind === 'drug'
  return (
    <ol className="results" aria-label="Candidates">
      {page.candidates.map((c, i) => {
        const today = todayDate(c)
        const be = bestEvidenceAt(c, today)
        const weak = resolveTimeline(c.weakest_link, today)
        const weakClaim = c.chain.claims.find((k) => k.id === weak?.claim)
        const safety = resolveTimeline(c.safety, today)
        const open = unresolvedCount(c, today)
        const refuted = !!be && be.controlled && be.outcome === 'negative'
        const path = candidatePath(page, c)
        return (
          <li className="row" key={c.slug} onClick={() => navigate(path)}>
            <span className="row__rank">{String(i + 1).padStart(2, '0')}</span>
            <div className="row__line">
              <span className="row__main">
                <Link className="row__name" to={path} onClick={(e) => e.stopPropagation()}>
                  {drugFirst ? c.condition : c.name}
                </Link>
                {!drugFirst && (
                  <span className="row__meta">
                    {' '}
                    · {c.drug_class} · approved for {c.approved_indication}
                  </span>
                )}
                {c.curation === 'draft' && <span className="row__meta"> · draft</span>}
              </span>
              <span className="row__figure">
                {open} of {c.prerequisites.length} prerequisites open
              </span>
            </div>
            <div className="row__line">
              <span className="row__main">
                <span className="row__weak">Weakest link:</span> {weakClaim?.short ?? '—'}
                {weak ? ` — ${weak.why}` : ''}
              </span>
              <span className="row__figure row__meta">
                {c.counts.sources} sources · {c.counts.trials} {c.counts.trials === 1 ? 'trial' : 'trials'}
              </span>
            </div>
            <div className="row__line">
              {be && <BestEvidenceBadge be={be} />}
              <DriverBar drivers={c.drivers} refutedClinical={refuted} />
              <span className="row__mech">{c.mechanism}</span>
              {safety && (
                <span className="row__safety">
                  <span className="critical medium">{safety.flag}</span> — {safety.kind}
                </span>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function Scatter({ page }: { page: ResultsPage }) {
  const navigate = useNavigate()
  const W = 800
  const H = 480
  const padL = 64
  const padB = 48
  const padT = 24
  const padR = 24
  const xs = (v: number) => padL + (v / 3) * (W - padL - padR)
  const ys = (lvl: number) => H - padB - (lvl / 4) * (H - padB - padT)

  const points = useMemo(() => {
    const pts = page.candidates.map((c) => {
      const be = bestEvidenceAt(c, todayDate(c))
      const lvl = be ? clinicalLevel(be) : 2
      return { c, x: c.drivers.mechanism, lvl }
    })
    // identical coordinates offset 16px apart in name order; never jitter
    const seen = new Map<string, number>()
    return pts
      .sort((a, b) => a.c.name.localeCompare(b.c.name))
      .map((p) => {
        const k = `${p.x}:${p.lvl}`
        const n = seen.get(k) ?? 0
        seen.set(k, n + 1)
        return { ...p, dx: n * 16 }
      })
  }, [page])

  return (
    <div className="scatter">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Mechanism support against clinical test status">
        <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="var(--color-line)" />
        <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="var(--color-line)" />
        {CLINICAL_LEVELS.map((word, i) => (
          <text key={word} x={padL - 8} y={ys(i) + 4} textAnchor="end" fontSize="12" fill="var(--color-ink-muted)">
            {i}
          </text>
        ))}
        {[0, 1, 2, 3].map((v) => (
          <text key={v} x={xs(v)} y={H - padB + 20} textAnchor="middle" fontSize="12" fill="var(--color-ink-muted)">
            {v}
          </text>
        ))}
        <text x={W - padR} y={H - 8} textAnchor="end" fontSize="12" fill="var(--color-ink-muted)">
          mechanism support (pips)
        </text>
        <text x={padL - 48} y={padT - 8} fontSize="12" fill="var(--color-ink-muted)">
          clinical test status
        </text>
        {points.map((p) => {
          const cx = xs(p.x) + p.dx
          const cy = ys(p.lvl)
          const raspberry = p.lvl === 0
          return (
            <g key={p.c.slug} style={{ cursor: 'pointer' }} onClick={() => navigate(candidatePath(page, p.c))} role="link" tabIndex={0} aria-label={`${p.c.name}: mechanism ${p.x}, ${CLINICAL_LEVELS[p.lvl]}`}>
              <rect x={cx - 4} y={cy - 4} width={8} height={8} fill={raspberry ? 'var(--evidence-refuted)' : 'var(--color-ink)'} />
              <text x={cx + 10} y={cy + 4 + (p.dx ? 12 : 0)} fontSize="14" fill="var(--color-ink)">
                {page.query.kind === 'drug' ? p.c.condition : p.c.name}
              </text>
            </g>
          )
        })}
      </svg>
      <p className="scatter__legend">
        Clinical test status: {CLINICAL_LEVELS.map((w, i) => `${i} ${w}`).join(' · ')}. A raspberry point is a controlled negative.
      </p>
    </div>
  )
}
