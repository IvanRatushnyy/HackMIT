/* elute — the five stages of an appraisal: the flow the field on Entry starts. In the header the shard band
 * carries the current stage instead; here the rail shows all five, the current one in ink, the rest faint. */

import { Export, Flask, ListBullets, MagnifyingGlass, Scales, type Icon } from '@phosphor-icons/react'

export type StageId = 'ask' | 'research' | 'candidates' | 'appraisal' | 'share'

export const STAGES: { id: StageId; word: string }[] = [
  { id: 'ask', word: 'ask' },
  { id: 'research', word: 'research' },
  { id: 'candidates', word: 'candidates' },
  { id: 'appraisal', word: 'appraisal' },
  { id: 'share', word: 'share' },
]

const ICON: Record<StageId, Icon> = {
  ask: MagnifyingGlass,
  research: Flask,
  candidates: ListBullets,
  appraisal: Scales,
  share: Export,
}

export function StageIcon({ id }: { id: StageId }) {
  const Glyph = ICON[id]
  return <Glyph size={16} aria-hidden="true" />
}

/** The stages fade in one after another, 40ms apart, the way rows do. */
export function Stages({ current }: { current: StageId }) {
  const at = STAGES.findIndex((s) => s.id === current)
  return (
    <ol className="stages" aria-label="The five stages">
      {STAGES.map((s, i) => (
        <li key={s.id} className={`stage fade${i === at ? ' stage--now' : ''}`} style={{ '--i': i } as React.CSSProperties} aria-current={i === at ? 'step' : undefined}>
          <span className="stage__box">
            <StageIcon id={s.id} />
          </span>
          <span>
            {i + 1} {s.word}
          </span>
        </li>
      ))}
    </ol>
  )
}
