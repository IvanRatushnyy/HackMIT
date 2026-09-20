/* elute — Detail: the screen the two-minute test is run on.
 * Everything evidence-bearing on this page is resolved at the selected cutoff. */

import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Banner, Header, Sheet } from '../components/frame'
import { Appraisal, AsOfControl, AssessmentSection, Chain, Prerequisites, Rail, SafetySection, type RailState } from '../components/detail'
import { source } from '../data/source'
import type { CandidateDetail, Cutoff, QueryRecord } from '../data/types'
import { findCutoff, isToday as isTodayCutoff } from '../lib/evidence'

export function Detail({ banner }: { banner: string }) {
  const { query = '', candidate: candidateParam = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState<QueryRecord | undefined>()
  const [c, setC] = useState<CandidateDetail | undefined | null>(undefined)
  const [rail, setRail] = useState<RailState>({ kind: 'ledger' })
  const [fading, setFading] = useState(false)

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

  const changeCutoff = (next: Cutoff) => {
    if (next.id === cutoff.id) return
    setFading(true)
    setTimeout(() => {
      // Replace, not push: the date is view state, so Back returns to the list (spec §3).
      const p = new URLSearchParams(params)
      if (isTodayCutoff(c, next)) p.delete('asof')
      else p.set('asof', next.id)
      setParams(p, { replace: true })
      setFading(false)
    }, 120)
  }

  const backTo = q.kind === 'pair' ? { to: `/q/${c.condition_slug}`, word: `← All candidates for ${c.condition}` } : { to: `/q/${query}`, word: '← Results · as of today' }
  const selectedClaim = rail.kind === 'claim' ? rail.id : null

  return (
    <main className="page">
      <Header />
      <Banner text={banner} />
      <div className="page__body">
        <Sheet>
          <div className="detail__bar">
            <Link className="detail__back" to={backTo.to}>
              {backTo.word}
            </Link>
            <div className="detail__bar-row">
              <div>
                <h1 className="display-md">{c.name}</h1>
                <p className="detail__meta">
                  {c.drug_class} · approved for {c.approved_indication} · for {c.condition}
                  {c.curation === 'draft' ? ' · draft record, sources not yet verified' : ''}
                </p>
              </div>
              <AsOfControl cutoffs={c.cutoffs} current={cutoff} onChange={changeCutoff} />
            </div>
            <p className="detail__frozen">{cutoff.note}</p>
          </div>

          <div className={`detail__body fade${fading ? ' fade--out' : ''}`}>
            <Appraisal candidate={c} cutoff={cutoff} onCite={(id) => setRail({ kind: 'citation', id })} />
            <Chain candidate={c} cutoff={cutoff} selected={selectedClaim} onSelect={(id) => setRail(id ? { kind: 'claim', id } : { kind: 'ledger' })} />
            <SafetySection candidate={c} cutoff={cutoff} />
            <Prerequisites candidate={c} cutoff={cutoff} isToday={isToday} />
            <AssessmentSection candidate={c} cutoff={cutoff} query={query} dataNote={`${banner} ${cutoff.note}`} />
          </div>
        </Sheet>
        <Rail candidate={c} cutoff={cutoff} isToday={isToday} ledger={q.ledger.rows} state={rail} onState={setRail} />
      </div>
    </main>
  )
}

function Frame({ banner, missing = false }: { banner: string; missing?: boolean }) {
  return (
    <main className="page">
      <Header />
      <Banner text={banner} />
      <div className="page__body page__body--full">
        <Sheet>
          {missing && (
            <div className="empty">
              <h1 className="display-md">No curated appraisal at this address</h1>
              <p>
                Fixture mode covers <Link to="/q/parkinsons-disease">Parkinson’s disease</Link>, <Link to="/q/metformin">metformin</Link>, and{' '}
                <Link to="/q/nilotinib--parkinsons-disease">nilotinib for Parkinson’s</Link>.
              </p>
            </div>
          )}
        </Sheet>
      </div>
    </main>
  )
}
