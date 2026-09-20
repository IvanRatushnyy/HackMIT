/* elute — evidence primitives: label, outcome chip, driver bar, source line, dates. */

import type { BestEvidence, Label, Source } from '../data/types'

/** Record strings use a middle dot as a structured separator; on screen it is a comma. */
export function plain(s: string): string {
  return s.replace(/\s*·\s*/g, ', ')
}

export function EvidenceLabel({ label, qualifier }: { label: Label; qualifier?: string }) {
  return (
    <span className={`label label--${label}`}>
      {label}
      {qualifier && <span className="label__qualifier">({qualifier})</span>}
    </span>
  )
}

/** The outcome of the most decisive study, as an outlined word. */
export function OutcomeChip({ be }: { be: BestEvidence }) {
  const word = be.outcome === 'none' ? 'untested' : be.outcome
  const cls = be.outcome === 'negative' && be.controlled ? ' chip--negative' : be.outcome === 'none' ? ' chip--muted' : ''
  return <span className={`chip${cls}`}>{word}</span>
}

export function bestEvidenceText(be: BestEvidence): string {
  if (be.outcome === 'none') return 'no human test'
  return `${be.design}${be.n !== undefined ? `, n = ${be.n}` : ''}`
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
  return parts.join(', ')
}

export function shortCite(s: Source): string {
  return `${s.first_author.split(' ')[0]} ${s.year}`
}

export function SourceLine({ s, cite }: { s: Source; cite?: string }) {
  return (
    <span className="evidence__src">
      <a href={s.url} target="_blank" rel="noreferrer">
        {s.first_author}, <em>{s.journal}</em> {s.year}
      </a>{' '}
      <span className="evidence__meta">
        {designWord(s)}
        {cite && (
          <>
            {' '}
            <a className="cite" href={cite}>
              [{s.ledger}]
            </a>
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
