/* elute — Detail sections, in the mockup's order: objections, mechanism (chain + claim panel),
 * safety and before-a-trial side by side, your call. Each is a pure function of the candidate and a cutoff. */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { CandidateDetail, Cutoff, Source } from '../data/types'
import { deriveLabel, resolvePrerequisite, resolveTimeline, unresolvedCount, visibleObjections, type LabelResult } from '../lib/evidence'
import { EvidenceLabel, formatDate, shortCite, SourceLine } from './evidence'
import { Kicker } from './frame'
import { assessmentKey, loadAssessment, saveAssessment, type Assessment } from '../lib/export'

// ---- Evidence as of -----------------------------------------------------------------

export function AsOfControl({ cutoffs, current, onChange }: { cutoffs: Cutoff[]; current: Cutoff; onChange: (c: Cutoff) => void }) {
  const single = cutoffs.length === 1
  return (
    <div className="asof">
      <div className="seg" role="radiogroup" aria-label="Evidence as of">
        {cutoffs.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            className="seg__item"
            aria-checked={c.id === current.id}
            disabled={single}
            onClick={() => onChange(c)}
            onKeyDown={(e) => {
              const i = cutoffs.findIndex((x) => x.id === current.id)
              if (e.key === 'ArrowRight') onChange(cutoffs[Math.min(i + 1, cutoffs.length - 1)])
              if (e.key === 'ArrowLeft') onChange(cutoffs[Math.max(i - 1, 0)])
            }}
          >
            {c.label}
          </button>
        ))}
      </div>
      <p className="detail__frozen">{current.note}</p>
    </div>
  )
}

// ---- Objections ----------------------------------------------------------------------

function boldFigure(text: string, figure?: string) {
  if (!figure || !text.includes(figure)) return text
  const [before, after] = text.split(figure)
  return (
    <>
      {before}
      <strong>{figure}</strong>
      {after}
    </>
  )
}

export function Objections({ candidate, cutoff, sourcesHref, limit }: { candidate: CandidateDetail; cutoff: Cutoff; sourcesHref?: string; limit?: number }) {
  const [open, setOpen] = useState<string | null>(null)
  const srcById = new Map(candidate.sources.map((s) => [s.id, s]))
  let objections = visibleObjections(candidate, cutoff.date)
  if (limit) objections = objections.slice(0, limit)
  return (
    <section className="section" aria-labelledby="objections">
      <h2 className="display-xs" id="objections">
        critical appraisal
      </h2>
      <div className="panel">
        {objections.length === 0 ? (
          <p className="panel__row annotation">Nothing published on or before this date.</p>
        ) : (
          objections.map((o, i) => {
            const srcs = o.sources.map((id) => srcById.get(id)).filter((s): s is Source => !!s)
            const isOpen = open === o.id
            return (
              <div key={o.id}>
                <button type="button" className="panel__row objection" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : o.id)}>
                  <span className="objection__n">{i + 1}</span>
                  <span className="objection__claim">{o.claim}</span>
                  <span className="objection__src">{srcs.map(shortCite).join(' · ')}</span>
                  <span className="objection__mark" aria-hidden="true">
                    +
                  </span>
                </button>
                <div className={`grow${isOpen ? ' grow--open' : ''}`} aria-hidden={!isOpen}>
                  <div>
                    <div className="objection__body">
                      <p>{boldFigure(o.evidence, o.figure)}</p>
                      <p className="cell__sub">
                        {srcs.map((s, j) => (
                          <span key={s.id}>
                            {j > 0 && ' · '}
                            <a href={s.url} target="_blank" rel="noreferrer">
                              {s.first_author}, <em>{s.journal}</em> {s.year}
                            </a>
                          </span>
                        ))}
                        {' · '}published {formatDate(o.published)}
                        {sourcesHref &&
                          o.cites.map((c) => (
                            <span key={c}>
                              {' '}
                              <Link className="cite" to={`${sourcesHref}#${c}`}>
                                [{c}]
                              </Link>
                            </span>
                          ))}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}

// ---- Mechanism chain: horizontal; nodes are boxes, claims are the links between them ----------

export function Mechanism({ candidate, cutoff, sourcesHref }: { candidate: CandidateDetail; cutoff: Cutoff; sourcesHref: string }) {
  const [selected, setSelected] = useState<string | null>(null)
  const weak = resolveTimeline(candidate.weakest_link, cutoff.date)
  const labels = candidate.chain.claims.map((k) => ({ claim: k, r: deriveLabel(k, candidate.sources, cutoff.date) }))
  const current = labels.find((l) => l.claim.id === selected) ?? null

  return (
    <section className="section" aria-labelledby="mechanism">
      <h2 className="display-xs" id="mechanism">
        mechanism
      </h2>
      <p className="section__lede">For the hypothesis to hold, each link must be true. Select a link to see who says so and what argues against it.</p>
      <div className="chain" role="list">
        <span className="node node--drug" role="listitem">
          {candidate.chain.drug}
        </span>
        {labels.map(({ claim, r }) => (
          <span key={claim.id} style={{ display: 'contents' }} role="listitem">
            <button
              type="button"
              className="link"
              aria-pressed={selected === claim.id}
              onClick={() => setSelected(selected === claim.id ? null : claim.id)}
              aria-label={`${claim.short}: ${r.label}`}
            >
              <span className={`link__line link__line--${r.label} label--${r.label}`} aria-hidden="true" />
              <EvidenceLabel label={r.label} />
              <span className="link__caption">{claim.short}</span>
              {weak?.claim === claim.id && <span className="link__weak">weakest link</span>}
            </button>
            <span className="node">{claim.node}</span>
          </span>
        ))}
      </div>
      {current && (
        <div className="panel claim-panel rise" key={current.claim.id + cutoff.id}>
          <div className="claim-panel__col">
            <Kicker>claim</Kicker>
            <p className="claim-panel__text">{current.claim.text}</p>
            <p>
              <EvidenceLabel label={current.r.label} qualifier={current.r.qualifier} />
            </p>
            <p className="cell__sub">{current.r.why}</p>
            {weak?.claim === current.claim.id && (
              <p className="cell__sub critical">
                <span className="medium">weakest link</span> — {weak.why}
              </p>
            )}
          </div>
          <div className="claim-panel__col">
            <Kicker>evidence</Kicker>
            <ClaimEvidence r={current.r} sourcesHref={sourcesHref} />
          </div>
        </div>
      )}
    </section>
  )
}

function ClaimEvidence({ r, sourcesHref }: { r: LabelResult; sourcesHref: string }) {
  const rows: { dir: string; s: Source }[] = [
    ...r.supports.map((s) => ({ dir: 'for', s })),
    ...r.against.map((s) => ({ dir: 'against', s })),
  ]
  if (rows.length === 0) return <p className="cell__sub">nothing published on or before this date</p>
  return (
    <div>
      {rows.map(({ dir, s }) => (
        <div className="evidence__row" key={dir + s.id}>
          <span className="evidence__dir">{dir}</span>
          <SourceLine s={s} cite={`${sourcesHref}#${s.ledger}`} />
        </div>
      ))}
    </div>
  )
}

// ---- Safety ------------------------------------------------------------------------------

export function SafetyPanel({ candidate, cutoff }: { candidate: CandidateDetail; cutoff: Cutoff }) {
  const s = resolveTimeline(candidate.safety, cutoff.date)
  const srcById = new Map(candidate.sources.map((x) => [x.id, x]))
  return (
    <section className="section" aria-labelledby="safety">
      <h2 className="display-xs" id="safety">
        safety
      </h2>
      <div className="panel panel--pad safety">
        {s ? (
          <>
            <div className="safety__head">
              <p className="safety__flag">
                {s.flag} — {s.kind}
              </p>
            </div>
            <p>{s.reason.charAt(0).toUpperCase() + s.reason.slice(1)}.</p>
            <p className="cell__sub">{s.population}</p>
            <p className="safety__src">
              {s.sources.map((id) => {
                const src = srcById.get(id)
                return src ? (
                  <a key={id} href={src.url} target="_blank" rel="noreferrer">
                    {src.first_author}, {src.journal} {src.year}
                  </a>
                ) : null
              })}
            </p>
          </>
        ) : (
          <>
            <p className="safety__flag" style={{ color: 'var(--color-ink-muted)' }}>
              none flagged
            </p>
            <p className="cell__sub">No boxed warning and no population-specific safety argument on or before this date.</p>
          </>
        )}
      </div>
    </section>
  )
}

// ---- Before a trial ----------------------------------------------------------------------------

export function BeforeTrial({ candidate, cutoff, isToday }: { candidate: CandidateDetail; cutoff: Cutoff; isToday: boolean }) {
  const n = unresolvedCount(candidate, cutoff.date)
  const srcById = new Map(candidate.sources.map((x) => [x.id, x]))
  return (
    <section className="section" aria-labelledby="prereqs">
      <h2 className="display-xs" id="prereqs">
        before a trial <span className="muted">· {n} of {candidate.prerequisites.length} unresolved{isToday ? '' : ' at this date'}</span>
      </h2>
      <div className="panel">
        {candidate.prerequisites.map((p) => {
          const s = resolvePrerequisite(p, cutoff.date)
          const ref = s?.sources.map((id) => srcById.get(id)?.ledger).filter(Boolean)[0]
          return (
            <div className="panel__row prereq" key={p.id} title={s?.note}>
              <span>{p.condition}</span>
              <span className={`prereq__word${s?.resolution === 'unmet' ? '' : ' prereq__word--met'}`}>{s?.word ?? 'unknown'}</span>
              <span className="prereq__ref">{ref ?? ''}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ---- Your call ---------------------------------------------------------------------------------

const CHOICES = ['pursue', 'needs specific data', 'deprioritise'] as const

export function YourCall({ candidate, cutoff, query, exportHref }: { candidate: CandidateDetail; cutoff: Cutoff; query: string; exportHref: string }) {
  const key = assessmentKey(query, candidate.slug, cutoff.id)
  const [a, setA] = useState<Assessment>(() => loadAssessment(key))

  useEffect(() => {
    setA(loadAssessment(key))
  }, [key])

  const update = (next: Assessment) => {
    setA(next)
    saveAssessment(key, next)
  }

  return (
    <section className="section" aria-labelledby="call">
      <h2 className="display-xs" id="call">
        your call
      </h2>
      <div className="call">
        <div className="call__choices" role="radiogroup" aria-label="Your call">
          {CHOICES.map((c) => (
            <button key={c} type="button" role="radio" className="choice" aria-checked={a.choice === c} onClick={() => update({ ...a, choice: a.choice === c ? undefined : c })}>
              {c}
            </button>
          ))}
        </div>
        <div className="call__reason">
          <Kicker>your reasoning</Kicker>
          <textarea className="textarea" aria-label="Your reasoning" placeholder="In your words." value={a.line ?? ''} onChange={(e) => update({ ...a, line: e.target.value })} />
          <div className="call__actions">
            <Link className="btn btn--primary" to={exportHref}>
              Export appraisal
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
