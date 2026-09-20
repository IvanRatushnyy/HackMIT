/* elute — the four stages of an appraisal: the flow the field on Entry starts. In the header the shard band
 * carries the current stage instead; here the rail shows all four, the current one in ink, the rest faint. */

import { Link } from 'react-router-dom'
import { Export, Flask, MagnifyingGlass, Scales, type Icon } from '@phosphor-icons/react'

export type StageId = 'ask' | 'research' | 'appraisal' | 'share'

export const STAGES: { id: StageId; word: string }[] = [
  { id: 'ask', word: 'ask' },
  { id: 'research', word: 'research' },
  { id: 'appraisal', word: 'appraisal' },
  { id: 'share', word: 'share' },
]

const ICON: Record<StageId, Icon> = {
  ask: MagnifyingGlass,
  research: Flask,
  appraisal: Scales,
  share: Export,
}

export function StageIcon({ id }: { id: StageId }) {
  const Glyph = ICON[id]
  return <Glyph size={16} aria-hidden="true" />
}

/** The stages fade in one after another, 40ms apart, the way rows do. Each one is the flow's own back
 * button: a stage this page can address (`hrefs`) is a link, one it can't stays plain — there's no other
 * back navigation in elute, so this rail carries all of it. */
export function Stages({ current, hrefs }: { current: StageId; hrefs?: Partial<Record<StageId, string>> }) {
  const at = STAGES.findIndex((s) => s.id === current)
  return (
    <ol className="stages" aria-label="The four stages">
      {STAGES.map((s, i) => {
        const now = i === at
        const href = hrefs?.[s.id]
        const content = (
          <>
            <span className="stage__box">
              <StageIcon id={s.id} />
            </span>
            <span>
              {i + 1} {s.word}
            </span>
          </>
        )
        return (
          <li key={s.id} className={`stage fade${now ? ' stage--now' : ''}`} style={{ '--i': i } as React.CSSProperties} aria-current={now ? 'step' : undefined}>
            {href && !now ? (
              <Link className="stage__link" to={href}>
                {content}
              </Link>
            ) : (
              <span className="stage__link">{content}</span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
