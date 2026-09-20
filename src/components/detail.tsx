/* elute — Detail sections: as-of control, critical appraisal, chain of claims,
 * safety, prerequisites, assessment. Each is a pure function of the candidate and a cutoff. */

import { useEffect, useState } from 'react'
import type { CandidateDetail, Cutoff, Label, LedgerRow, Source } from '../data/types'
import {
  deriveLabel,
  resolvePrerequisite,
  resolveTimeline,
  unresolvedCount,
  visibleObjections,
  type LabelResult,
} from '../lib/evidence'
import { EvidenceLabel, formatDate, SourceLine } from './evidence'
import { LedgerList, ProvenanceBlock } from './Ledger'
import { assessmentKey, buildExport, loadAssessment, saveAssessment, toMarkdown, type Assessment } from '../lib/export'

// ---- Evidence as of -----------------------------------------------------------------

export function AsOfControl({ cutoffs, current, onChange }: { cutoffs: Cutoff[]; current: Cutoff; onChange: (c: Cutoff) => void }) {
  const single = cutoffs.length === 1
  return (
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
  )
}

// ---- Critical appraisal ---------------------------------------------------------------

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

export function Appraisal({
  candidate,
  cutoff,
  onCite,
  limit,
}: {
  candidate: CandidateDetail
  cutoff: Cutoff
  onCite?: (id: string) => void
  limit?: number
}) {
  const srcById = new Map(candidate.sources.map((s) => [s.id, s]))
  let objections = visibleObjections(candidate, cutoff.date)
  if (limit) objections = objections.slice(0, limit)
  return (
    <section className="section" aria-labelledby="appraisal">
      <h2 className="section__title" id="appraisal">
        Critical appraisal
      </h2>
      {objections.length === 0 ? (
        <p className="annotation">Nothing published on or before this date.</p>
      ) : (
        <ol className="objections">
          {objections.map((o) => {
            const first = srcById.get(o.sources[0])
            return (
              <li className="objection" key={o.id}>
                <p className="objection__claim">{o.claim}</p>
                <p>{boldFigure(o.evidence, o.figure)}</p>
                <p className="objection__source">
                  {first && (
                    <>
                      {first.first_author}, <em>{first.journal}</em> {first.year} · {describe(first)} · {formatDate(o.published)}
                    </>
                  )}{' '}
                  {o.cites.map((c) => (
                    <button type="button" className="cite" key={c} onClick={() => onCite?.(c)} disabled={!onCite}>
                      [{c}]
                    </button>
                  ))}
                </p>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

function describe(s: Source): string {
  const parts: string[] = []
  if (s.design === 'rct') parts.push(s.blinded ? 'double-blind RCT' : 'randomised')
  else if (s.design === 'open-label') parts.push('open-label')
  else if (s.design === 'pk') parts.push('PK measurement')
  else parts.push(s.design)
  if (s.n !== undefined) parts.push(`n = ${s.n}`)
  return parts.join(' · ')
}

// ---- Mechanism chain (ordered claims, vertical) -----------------------------------------

type Filter = 'all' | Label

export function Chain({
  candidate,
  cutoff,
  selected,
  onSelect,
}: {
  candidate: CandidateDetail
  cutoff: Cutoff
  selected: string | null
  onSelect: (id: string | null) => void
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const weak = resolveTimeline(candidate.weakest_link, cutoff.date)
  const labels = candidate.chain.claims.map((k) => ({ claim: k, r: deriveLabel(k, candidate.sources, cutoff.date) }))
  const filters: { id: Filter; word: string }[] = [
    { id: 'all', word: 'All' },
    { id: 'contested', word: 'Contested' },
    { id: 'single-source', word: 'Single-source' },
    { id: 'refuted', word: 'Refuted' },
  ]
  return (
    <section className="section" aria-labelledby="chain">
      <h2 className="section__title" id="chain">
        Mechanism chain
      </h2>
      <p className="section__lede">For the hypothesis to hold, each of these must be true. Each claim carries the status of its own evidence.</p>
      <div className="chain">
        <div className="chain__filter pill-group" role="radiogroup" aria-label="Filter claims by label">
          {filters.map((f) => (
            <button key={f.id} type="button" role="radio" className="pill" aria-checked={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.word}
            </button>
          ))}
        </div>
        <span className="chain__end">{candidate.chain.drug}</span>
        {labels.map(({ claim, r }) => {
          const dimmed = filter !== 'all' && r.label !== filter
          const isWeak = weak?.claim === claim.id
          return (
            <div key={claim.id}>
              <span className="chain__arrow" aria-hidden="true" />
              <button
                type="button"
                className={`claim${dimmed ? ' claim--dimmed' : ''}`}
                aria-pressed={selected === claim.id}
                onClick={() => onSelect(selected === claim.id ? null : claim.id)}
              >
                <span className={`claim__marker claim__marker--${r.label}`} aria-hidden="true" />
                <span className="claim__body">
                  <span className="claim__line">
                    <span className="claim__text">{claim.text}</span>
                    <EvidenceLabel label={r.label} qualifier={r.qualifier} />
                  </span>
                  {isWeak && (
                    <span className="claim__weak">
                      weakest link — {weak!.why}
                    </span>
                  )}
                </span>
              </button>
            </div>
          )
        })}
        <span className="chain__arrow" aria-hidden="true" />
        <span className="chain__end">{candidate.chain.condition}</span>
      </div>
    </section>
  )
}

// ---- Safety as a reason ------------------------------------------------------------------

export function SafetySection({ candidate, cutoff }: { candidate: CandidateDetail; cutoff: Cutoff }) {
  const s = resolveTimeline(candidate.safety, cutoff.date)
  if (!s) return null
  const srcById = new Map(candidate.sources.map((x) => [x.id, x]))
  return (
    <section className="section" aria-labelledby="safety">
      <h2 className="section__title" id="safety">
        Safety in the likely trial population
      </h2>
      <div className="safety">
        <p>
          <span className="safety__flag">{s.flag}</span> — {s.kind}: {s.reason}.
        </p>
        <p>{s.population}</p>
        <p className="objection__source">
          {s.sources.map((id) => {
            const src = srcById.get(id)
            return src ? (
              <span key={id}>
                {src.first_author}, <em>{src.journal}</em> {src.year}
              </span>
            ) : null
          })}
        </p>
      </div>
    </section>
  )
}

// ---- Trial prerequisites --------------------------------------------------------------------

export function Prerequisites({ candidate, cutoff, isToday }: { candidate: CandidateDetail; cutoff: Cutoff; isToday: boolean }) {
  const n = unresolvedCount(candidate, cutoff.date)
  return (
    <section className="section" aria-labelledby="prereqs">
      <h2 className="section__title" id="prereqs">
        Trial prerequisites — {n} of {candidate.prerequisites.length} unresolved{isToday ? '' : ' at this date'}
      </h2>
      <ul className="prereqs">
        {candidate.prerequisites.map((p) => {
          const s = resolvePrerequisite(p, cutoff.date)
          return (
            <li className="prereq" key={p.id}>
              <span className="prereq__condition">{p.condition}</span>
              <span className={s?.resolution === 'unmet' ? '' : 'muted'}>{s?.word ?? 'unknown'}</span>
              <span className="prereq__note">{s?.note}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// ---- Your assessment ---------------------------------------------------------------------------

const CHOICES = ['pursue', 'needs specific data', 'deprioritise'] as const

export function AssessmentSection({
  candidate,
  cutoff,
  query,
  dataNote,
}: {
  candidate: CandidateDetail
  cutoff: Cutoff
  query: string
  dataNote: string
}) {
  const key = assessmentKey(query, candidate.slug, cutoff.id)
  const [a, setA] = useState<Assessment>(() => loadAssessment(key))
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setA(loadAssessment(key))
  }, [key])

  const update = (next: Assessment) => {
    setA(next)
    saveAssessment(key, next)
  }

  const copy = async () => {
    const md = toMarkdown(buildExport(candidate, cutoff, a, dataNote))
    try {
      await navigator.clipboard.writeText(md)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard blocked: nothing to do */
    }
  }

  return (
    <section className="section" aria-labelledby="assessment">
      <h2 className="section__title" id="assessment">
        Your assessment
      </h2>
      <div className="assessment">
        <div className="assessment__choices" role="radiogroup" aria-label="Your assessment">
          {CHOICES.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              className="assessment__choice"
              aria-checked={a.choice === c}
              onClick={() => update({ ...a, choice: a.choice === c ? undefined : c })}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="assessment__row">
          <input
            className="field"
            type="text"
            placeholder="In your words."
            aria-label="Your assessment, in your words"
            value={a.line ?? ''}
            onChange={(e) => update({ ...a, line: e.target.value })}
          />
          <div className="assessment__actions">
            <button type="button" className="btn btn--primary" onClick={copy}>
              {copied ? 'Copied' : 'Copy as document'}
            </button>
            <button type="button" className="btn btn--secondary" onClick={() => window.print()}>
              Print
            </button>
          </div>
        </div>
      </div>
      <PrintDocument candidate={candidate} cutoff={cutoff} assessment={a} dataNote={dataNote} />
    </section>
  )
}

function PrintDocument({ candidate, cutoff, assessment, dataNote }: { candidate: CandidateDetail; cutoff: Cutoff; assessment: Assessment; dataNote: string }) {
  const doc = buildExport(candidate, cutoff, assessment, dataNote)
  return (
    <div className="print-only">
      <p className="annotation">{doc.dataNote}</p>
      {doc.sections.map((s) => (
        <section key={s.heading} className="section">
          <h2 className="section__title">{s.heading}</h2>
          <ul>
            {s.lines.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </section>
      ))}
      <p className="annotation">Data note: {doc.dataNote}</p>
    </div>
  )
}

// ---- Rail -------------------------------------------------------------------------------------------

export type RailState = { kind: 'ledger' } | { kind: 'citation'; id: string } | { kind: 'claim'; id: string }

export function Rail({
  candidate,
  cutoff,
  isToday,
  ledger,
  state,
  onState,
}: {
  candidate: CandidateDetail
  cutoff: Cutoff
  isToday: boolean
  ledger: LedgerRow[]
  state: RailState
  onState: (s: RailState) => void
}) {
  const back = (
    <button type="button" className="rail__back" onClick={() => onState({ kind: 'ledger' })}>
      ← Ledger
    </button>
  )

  if (state.kind === 'citation') {
    const row = ledger.find((r) => r.id === state.id)
    if (!row) return <aside className="rail">{back}</aside>
    return (
      <aside className="rail" aria-label="Citation">
        {back}
        <p className="rail__title">
          {row.id} · {row.step}
        </p>
        <p className="muted text-sm">{row.source}</p>
        <ProvenanceBlock row={row} cutoff={cutoff.date} isToday={isToday} />
      </aside>
    )
  }

  if (state.kind === 'claim') {
    const claim = candidate.chain.claims.find((k) => k.id === state.id)
    if (!claim) return <aside className="rail">{back}</aside>
    const r = deriveLabel(claim, candidate.sources, cutoff.date)
    const weak = resolveTimeline(candidate.weakest_link, cutoff.date)
    return (
      <aside className="rail" aria-label="Claim evidence">
        {back}
        <ClaimEvidence claim={claim} r={r} weakWhy={weak?.claim === claim.id ? weak.why : undefined} onCite={(id) => onState({ kind: 'citation', id })} />
      </aside>
    )
  }

  return (
    <aside className="rail" aria-label="Evidence ledger">
      <p className="rail__title">Evidence ledger · {ledger.length} steps</p>
      <LedgerList rows={ledger} cutoff={cutoff.date} isToday={isToday} compact />
    </aside>
  )
}

function ClaimEvidence({
  claim,
  r,
  weakWhy,
  onCite,
}: {
  claim: CandidateDetail['chain']['claims'][number]
  r: LabelResult
  weakWhy?: string
  onCite: (id: string) => void
}) {
  return (
    <div className="evidence">
      <p className="rail__title">{claim.text}</p>
      <p>
        <EvidenceLabel label={r.label} qualifier={r.qualifier} />
      </p>
      <div>
        <p className="evidence__head">Why this label</p>
        <p className="text-sm">{r.why}</p>
      </div>
      <div>
        <p className="evidence__head">Who says so</p>
        {r.supports.length ? (
          r.supports.map((s) => <SourceLine key={s.id} s={s} onCite={onCite} />)
        ) : (
          <p className="text-sm muted">nothing published on or before this date</p>
        )}
      </div>
      <div>
        <p className="evidence__head">What argues against</p>
        {r.against.length ? (
          r.against.map((s) => <SourceLine key={s.id} s={s} onCite={onCite} />)
        ) : (
          <p className="text-sm muted">nothing published on or before this date</p>
        )}
      </div>
      {weakWhy && (
        <div>
          <p className="evidence__head">Weakest link</p>
          <p className="text-sm critical">{weakWhy}</p>
        </div>
      )}
    </div>
  )
}

