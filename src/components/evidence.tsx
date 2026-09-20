/* elute — evidence label, driver bar, best-evidence badge, source line. */

import type { BestEvidence, CandidateDetail, Label, Source } from '../data/types'

export function EvidenceLabel({ label, qualifier }: { label: Label; qualifier?: string }) {
  return (
    <span className={`label label--${label}`}>
      {label}
      {qualifier && <span className="label__qualifier"> · {qualifier}</span>}
    </span>
  )
}

const SEGMENTS = ['mechanism', 'clinical', 'exposure', 'safety'] as const

export function DriverBar({ drivers, refutedClinical }: { drivers: CandidateDetail['drivers']; refutedClinical: boolean }) {
  const words = SEGMENTS.map((s) => `${s} ${drivers[s]} of 3${s === 'clinical' && refutedClinical ? ' (controlled negative)' : ''}`).join(', ')
  return (
    <div className="drivers" role="img" aria-label={words} title={words}>
      {SEGMENTS.map((s) => (
        <div className="drivers__seg" key={s}>
          <span className="drivers__word">{s}</span>
          <span className="drivers__pips">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`drivers__pip${i < drivers[s] ? ' drivers__pip--on' : ''}${
                  s === 'clinical' && refutedClinical ? ' drivers__pip--refuted' : ''
                }`}
              />
            ))}
          </span>
        </div>
      ))}
    </div>
  )
}

export function BestEvidenceBadge({ be }: { be: BestEvidence }) {
  const dot = be.outcome === 'none' ? 'none' : be.outcome === 'negative' && be.controlled ? 'negative' : 'ok'
  const text =
    be.outcome === 'none'
      ? 'no human test'
      : `${be.design} · ${be.outcome}${be.n !== undefined ? ` · n = ${be.n}` : ''}`
  return (
    <span className="row__badge">
      <span className={`row__dot${dot === 'negative' ? ' row__dot--negative' : dot === 'none' ? ' row__dot--none' : ''}`} />
      {text}
    </span>
  )
}

export function designWord(s: Source): string {
  const parts: string[] = []
  switch (s.design) {
    case 'rct':
      parts.push(s.blinded ? 'blinded RCT' : 'randomised, unblinded')
      break
    case 'open-label':
      parts.push('open-label')
      break
    case 'pk':
      parts.push('PK measurement')
      break
    case 'commentary':
      parts.push('commentary')
      break
    case 'preclinical':
      parts.push('preclinical')
      break
    case 'observational':
      parts.push('observational')
      break
    case 'protocol':
      parts.push('protocol')
      break
    case 'label':
      parts.push('product label')
      break
    case 'regulatory':
      parts.push('regulatory')
      break
    case 'meta-analysis':
      parts.push('meta-analysis')
      break
  }
  if (s.n !== undefined) parts.push(`n = ${s.n}`)
  return parts.join(' · ')
}

export function SourceLine({ s, onCite }: { s: Source; onCite?: (ledger: string) => void }) {
  return (
    <span className="evidence__source">
      <a href={s.url} target="_blank" rel="noreferrer">
        {s.first_author}, <em>{s.journal}</em> {s.year}
      </a>
      <span className="evidence__meta">
        {designWord(s)}
        {onCite && (
          <>
            {' '}
            <button type="button" className="cite" onClick={() => onCite(s.ledger)}>
              [{s.ledger}]
            </button>
          </>
        )}
      </span>
    </span>
  )
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${d} ${months[m - 1]} ${y}`
}
