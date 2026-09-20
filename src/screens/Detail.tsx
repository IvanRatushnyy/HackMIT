/* elute — Detail: the screen the two-minute test is run on.
 * Everything evidence-bearing on this page is resolved at the selected cutoff; a date change animates what
 * enters and leaves rather than re-mounting the page, so the pathway's live context stays. */

import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { Header } from '../components/frame'
import { AsOfControl, BeforeTrial, Objections, SafetyPanel, YourCall } from '../components/detail'
import { Pathway } from '../components/Pathway'
import { bestEvidenceText, DriverBar, OutcomeChip, plain } from '../components/evidence'
import { source } from '../data/source'
import type { CandidateDetail, Cutoff, QueryRecord } from '../data/types'
import { bestEvidenceAt, findCutoff, isToday as isTodayCutoff } from '../lib/evidence'
import { arrive } from '../lib/motion'

export function Detail() {
  const { query = '', candidate: candidateParam = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState<QueryRecord | undefined>()
  const [c, setC] = useState<CandidateDetail | undefined | null>(undefined)
  const reduce = useReducedMotion()

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

  if (c === undefined) return <Frame />
  if (c === null || !q) return <Frame missing />

  const cutoff = findCutoff(c, params.get('asof'))
  const isToday = isTodayCutoff(c, cutoff)
  const be = bestEvidenceAt(c, cutoff.date)
  const refuted = !!be && be.controlled && be.outcome === 'negative'
  const sourcesHref = `/q/${query}/sources${isToday ? '' : `?asof=${cutoff.id}&c=${candidateParam}`}`
  const exportHref = `/q/${query}/${candidateParam}/export${isToday ? '' : `?asof=${cutoff.id}`}`

  const changeCutoff = (next: Cutoff) => {
    if (next.id === cutoff.id) return
    const p = new URLSearchParams(params)
    if (isTodayCutoff(c, next)) p.delete('asof')
    else p.set('asof', next.id)
    setParams(p, { replace: true })
  }

  const backTo = q.kind === 'pair' ? { to: `/q/${c.condition_slug}`, word: `all candidates for ${c.condition}` } : { to: `/q/${query}`, word: 'results' }
  const mechanism = c.mechanism.split('→').slice(1).join('→').trim()

  return (
    <main className="page">
      <Header />
      <div className="col detail">
        <motion.div className="detail__title" {...arrive(reduce)}>
          <div className="detail__title-main">
            <p className="detail__back">
              <Link to={backTo.to}>← {backTo.word}</Link>
            </p>
            <h1 className="display-hero detail__name">{c.name}</h1>
            <p className="detail__class">
              for {c.condition}
              <span className="muted">. {c.drug_class}, approved for {c.approved_indication}</span>
            </p>
            <p className="detail__mechanism">
              {mechanism}
              {c.curation === 'draft' && <span className="detail__draft">draft record, sources not yet verified</span>}
            </p>
            <div className="detail__evidence">
              {be && (
                <>
                  <OutcomeChip be={be} />
                  <span className="detail__evidence-text">
                    {bestEvidenceText(be)}
                    {be.label && <span className="muted">, {plain(be.label)}</span>}
                  </span>
                </>
              )}
              {isToday && <DriverBar drivers={c.drivers} refutedClinical={refuted} />}
            </div>
          </div>
          <div className="detail__title-aside">
            <AsOfControl cutoffs={c.cutoffs} current={cutoff} onChange={changeCutoff} />
          </div>
        </motion.div>

        <div className="detail__body">
          <motion.div {...arrive(reduce, 0.08)}>
            <Objections candidate={c} cutoff={cutoff} sourcesHref={sourcesHref} />
          </motion.div>
          <motion.div {...arrive(reduce, 0.16)}>
            <Pathway candidate={c} cutoff={cutoff} sourcesHref={sourcesHref} />
          </motion.div>
          <motion.div className="detail__two" {...arrive(reduce, 0.24)}>
            <SafetyPanel candidate={c} cutoff={cutoff} />
            <BeforeTrial candidate={c} cutoff={cutoff} isToday={isToday} />
          </motion.div>
          <motion.div {...arrive(reduce, 0.32)}>
            <YourCall candidate={c} cutoff={cutoff} query={query} exportHref={exportHref} />
          </motion.div>
        </div>
      </div>
    </main>
  )
}

function Frame({ missing = false }: { missing?: boolean }) {
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
    </main>
  )
}
