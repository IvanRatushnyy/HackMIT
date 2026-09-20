/* elute — Detail: the screen the two-minute test is run on.
 * Everything evidence-bearing on this page is resolved at the selected cutoff. */

import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { DataNote, Header } from '../components/frame'
import { AsOfControl, BeforeTrial, Mechanism, Objections, SafetyPanel, YourCall } from '../components/detail'
import { bestEvidenceText, DriverBar, OutcomeChip } from '../components/evidence'
import { source } from '../data/source'
import type { CandidateDetail, Cutoff, QueryRecord } from '../data/types'
import { bestEvidenceAt, findCutoff, isToday as isTodayCutoff } from '../lib/evidence'

export function Detail({ banner }: { banner: string }) {
  const { query = '', candidate: candidateParam = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState<QueryRecord | undefined>()
  const [c, setC] = useState<CandidateDetail | undefined | null>(undefined)

  useEffect(() => {
    let cancelled = false
    Promise.all([source.query(query), source.candidate(query, candidateParam)]).then(([rec, cand]) => {
      if (cancelled) return
      setQ(rec)
      setC(cand ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [query, candidateParam])

  if (c === undefined) return <Frame banner={banner} />
  if (c === null || !q) return <Frame banner={banner} missing />

  const cutoff = findCutoff(c, params.get('asof'))
  const isToday = isTodayCutoff(c, cutoff)
  const be = bestEvidenceAt(c, cutoff.date)
  const refuted = !!be && be.controlled && be.outcome === 'negative'
  const sourcesHref = `/q/${query}/sources`
  const exportHref = `/q/${query}/${candidateParam}/export${isToday ? '' : `?asof=${cutoff.id}`}`

  const changeCutoff = (next: Cutoff) => {
    if (next.id === cutoff.id) return
    // Replace, not push: the date is view state, so Back returns to the list (spec §3).
    const p = new URLSearchParams(params)
    if (isTodayCutoff(c, next)) p.delete('asof')
    else p.set('asof', next.id)
    setParams(p, { replace: true })
  }

  const backTo = q.kind === 'pair' ? { to: `/q/${c.condition_slug}`, word: `← all candidates for ${c.condition}` } : { to: `/q/${query}`, word: '← results · as of today' }

  return (
    <main className="page">
      <Header />
      <div className="col">
        <div className="title rise">
          <div className="title__main">
            <p className="detail__meta">
              <Link to={backTo.to}>{backTo.word}</Link> · {c.drug_class} · approved for {c.approved_indication} · {c.mechanism.split('→').slice(1).join('→').trim()}
              {c.curation === 'draft' ? ' · draft record, sources not yet verified' : ''}
            </p>
            <h1 className="display-sm detail__title">
              {c.name} <span className="muted">for {c.condition}</span>
            </h1>
            <div className="detail__evidence">
              {be && (
                <>
                  <OutcomeChip be={be} />
                  <span>
                    {bestEvidenceText(be)}
                    {be.label ? ` · ${be.label}` : ''}
                  </span>
                </>
              )}
              {isToday && <DriverBar drivers={c.drivers} refutedClinical={refuted} />}
            </div>
          </div>
          <div className="title__aside">
            <AsOfControl cutoffs={c.cutoffs} current={cutoff} onChange={changeCutoff} />
          </div>
        </div>

        {/* Keyed on the cutoff: a date change re-mounts the body as one staggered reveal. */}
        <div className="detail__body" key={cutoff.id}>
          <div className="rise" style={{ '--i': 1 } as React.CSSProperties}>
            <Objections candidate={c} cutoff={cutoff} sourcesHref={sourcesHref} />
          </div>
          <div className="rise" style={{ '--i': 2 } as React.CSSProperties}>
            <Mechanism candidate={c} cutoff={cutoff} sourcesHref={sourcesHref} />
          </div>
          <div className="two rise" style={{ '--i': 3 } as React.CSSProperties}>
            <SafetyPanel candidate={c} cutoff={cutoff} />
            <BeforeTrial candidate={c} cutoff={cutoff} isToday={isToday} />
          </div>
          <div className="rise" style={{ '--i': 4 } as React.CSSProperties}>
            <YourCall candidate={c} cutoff={cutoff} query={query} exportHref={exportHref} />
          </div>
        </div>
      </div>
      <DataNote text={banner} />
    </main>
  )
}

function Frame({ banner, missing = false }: { banner: string; missing?: boolean }) {
  return (
    <main className="page">
      <Header />
      <div className="col">
        {missing && (
          <div className="empty">
            <h1 className="display-sm">no curated appraisal at this address</h1>
            <p>
              Fixture mode covers <Link to="/q/parkinsons-disease">Parkinson’s disease</Link>, <Link to="/q/metformin">metformin</Link>, and{' '}
              <Link to="/q/nilotinib--parkinsons-disease">nilotinib for Parkinson’s</Link>.
            </p>
          </div>
        )}
      </div>
      <DataNote text={banner} />
    </main>
  )
}
