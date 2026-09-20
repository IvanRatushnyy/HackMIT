/* elute — Detail: the screen the two-minute test is run on.
 * Everything evidence-bearing on this page is resolved at the selected cutoff; a date change animates what
 * enters and leaves rather than re-mounting the page, so the pathway's live context stays. */

import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { Header } from '../components/frame'
import { AsOfControl, BeforeTrial, Objections, SafetyPanel, YourCall } from '../components/detail'
import { Pathway } from '../components/Pathway'
import { bestEvidenceText, OutcomeChip, plain } from '../components/evidence'
import { source } from '../data/source'
import type { CandidateDetail, Cutoff, QueryRecord } from '../data/types'
import { bestEvidenceAt, findCutoff, isToday as isTodayCutoff, resolveTimeline, unresolvedCount, visibleObjections } from '../lib/evidence'
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
  const sourcesHref = `/q/${query}/sources${isToday ? '' : `?asof=${cutoff.id}&c=${candidateParam}`}`
  const exportHref = `/q/${query}/${candidateParam}/export${isToday ? '' : `?asof=${cutoff.id}`}`

  const changeCutoff = (next: Cutoff) => {
    if (next.id === cutoff.id) return
    const p = new URLSearchParams(params)
    if (isTodayCutoff(c, next)) p.delete('asof')
    else p.set('asof', next.id)
    setParams(p, { replace: true })
  }

  const backTo = q.kind === 'pair' ? { to: `/q/${c.condition_slug}`, word: `all candidates for ${c.condition}` } : { to: `/q/${query}`, word: 'all candidates' }
  const weak = resolveTimeline(c.weakest_link, cutoff.date)
  const weakClaim = c.chain.claims.find((k) => k.id === weak?.claim)
  const safety = resolveTimeline(c.safety, cutoff.date)
  const nObj = visibleObjections(c, cutoff.date).length
  const nPre = unresolvedCount(c, cutoff.date)
  const MAP = [
    { id: 'objections', word: 'the case against', count: `${nObj}` },
    { id: 'pathway', word: 'the pathway', count: weakClaim ? 'weakest link marked' : '' },
    { id: 'prereqs', word: 'before a trial', count: `${nPre} of ${c.prerequisites.length} unresolved` },
    { id: 'call', word: 'your call', count: '' },
  ]

  return (
    <main className="page">
      <Header stage="appraisal" links={{ research: `/q/${query}`, candidates: `/q/${query}` }} />
      <div className="col detail">
        <motion.div className="detail__title" {...arrive(reduce)}>
          <div className="detail__title-main">
            <p className="detail__back">
              <Link to={backTo.to}>← {backTo.word}</Link>
            </p>
            <p className="kicker">4 appraisal</p>
            <h1 className="display-hero detail__name">{c.name}</h1>
            <p className="detail__class">
              {c.drug_class} · for {c.condition} · approved for {c.approved_indication}
              {c.curation === 'draft' && <span className="detail__draft">draft record, sources not yet verified</span>}
            </p>
          </div>
          <div className="detail__title-aside">
            <AsOfControl cutoffs={c.cutoffs} current={cutoff} onChange={changeCutoff} />
          </div>
        </motion.div>

        <motion.div className="facts" {...arrive(reduce, 0.04)}>
          <div className="fact">
            <span className="fact__k">best human evidence</span>
            {be ? (
              <span className="fact__v">
                <OutcomeChip be={be} />
                <span>{bestEvidenceText(be)}</span>
              </span>
            ) : (
              <span className="fact__v muted">no human test</span>
            )}
            {be?.label && <span className="fact__s">{plain(be.label)}</span>}
          </div>
          <div className="fact">
            <span className="fact__k">weakest link</span>
            <span className="fact__v">{weakClaim ? weakClaim.short.charAt(0).toUpperCase() + weakClaim.short.slice(1) : 'unknown'}</span>
            {weak && <span className="fact__s">{weak.why}</span>}
          </div>
          <div className="fact">
            <span className="fact__k">safety</span>
            {safety ? (
              <>
                <span className={`fact__v${safety.severity === 'none' ? ' muted' : ' critical'}`}>{safety.flag}</span>
                <span className="fact__s">{safety.kind}</span>
              </>
            ) : (
              <span className="fact__v muted">not assessed</span>
            )}
          </div>
          <nav className="pagemap" aria-label="On this page">
            <span className="fact__k">on this page</span>
            <ol>
              {MAP.map((m, i) => (
                <li key={m.id}>
                  <a href={`#${m.id}`}>
                    <span className="pagemap__n">{i + 1}</span>
                    <span className="pagemap__w">{m.word}</span>
                    {m.count && <span className="pagemap__c">{m.count}</span>}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
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
      <Header stage="appraisal" />
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
