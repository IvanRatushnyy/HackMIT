/* elute — the stage rail: the five stages of an appraisal, in the header of every page, so the person
 * always sees where they are and where this ends. Finished stages link back; the current one is in ink. */

import { Link } from 'react-router-dom'

export type StageId = 'ask' | 'research' | 'candidates' | 'appraisal' | 'share'

export const STAGES: { id: StageId; word: string }[] = [
  { id: 'ask', word: 'ask' },
  { id: 'research', word: 'research' },
  { id: 'candidates', word: 'candidates' },
  { id: 'appraisal', word: 'appraisal' },
  { id: 'share', word: 'share' },
]

const ICON: Record<StageId, React.ReactNode> = {
  ask: <path d="M7 12a5 5 0 1 0 10 0a5 5 0 1 0-10 0M15.5 15.5L20 20" />,
  research: <path d="M9 3h6M10 3v6l-5 9a1.5 1.5 0 0 0 1.3 2.2h11.4A1.5 1.5 0 0 0 19 18l-5-9V3M8 15h8" />,
  candidates: <path d="M4 6h16M4 12h16M4 18h10" />,
  appraisal: <path d="M12 4v16M5 8h14M7 8l-3 6a3 3 0 0 0 6 0l-3-6M17 8l-3 6a3 3 0 0 0 6 0l-3-6" />,
  share: <path d="M5 12v7h14v-7M12 4v11M8 8l4-4 4 4" />,
}

export function StageIcon({ id }: { id: StageId }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON[id]}
    </svg>
  )
}

/** `links` gives a finished stage somewhere to go back to. */
export function Stages({ current, links = {} }: { current: StageId; links?: Partial<Record<StageId, string>> }) {
  const at = STAGES.findIndex((s) => s.id === current)
  return (
    <nav className="stages" aria-label="Stages">
      {STAGES.map((s, i) => {
        const state = i < at ? 'done' : i === at ? 'now' : 'next'
        const cls = `stage stage--${state}`
        const inner = (
          <>
            <span className="stage__box">
              {state === 'done' ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7" />
                </svg>
              ) : (
                <StageIcon id={s.id} />
              )}
            </span>
            <span>
              {i + 1} {s.word}
            </span>
          </>
        )
        const to = links[s.id]
        return to && state === 'done' ? (
          <Link key={s.id} to={to} className={cls}>
            {inner}
          </Link>
        ) : (
          <span key={s.id} className={cls} aria-current={state === 'now' ? 'step' : undefined}>
            {inner}
          </span>
        )
      })}
    </nav>
  )
}
