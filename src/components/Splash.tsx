/* elute — the startup screen, once per page load: the product's definition shown rather than said.
 * On an ink stage, a mixture enters a column as one band and comes out as four, in order, each word
 * appearing at the detector as its band arrives. The wordmark settles along its width axis as the first
 * band lands. Then the stage lifts and the page beneath, already rendered, is there. */

import { useLayoutEffect, useState } from 'react'
import { BANDS, SPLASH_TIMING, splashSchedule } from '../lib/splash'

type Phase = 'run' | 'settled' | 'lift'

/* The column: 160px wide in a 480 × 400 drawing, the detector 48px above its foot, words to its right */
const W = 480
const H = 400
const COL = { x: 64, w: 160, top: 24, bottom: 376 }
const DETECTOR = COL.bottom - 48
const START = COL.top - 48 // the bands begin above the column's mouth, clipped
const GAP = 44 // between resting bands, bottom to top

export function Splash({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>('run')

  useLayoutEffect(() => {
    const t = splashSchedule(SPLASH_TIMING)
    window.scrollTo(0, 0)
    document.documentElement.setAttribute('data-splash', '')
    const timers = [
      setTimeout(() => setPhase('settled'), t.wordSettle),
      setTimeout(() => setPhase('lift'), t.lift),
      setTimeout(onDone, t.done),
    ]
    return () => {
      timers.forEach(clearTimeout)
      document.documentElement.removeAttribute('data-splash')
    }
  }, [onDone])

  const vars = {
    '--splash-delay': `${SPLASH_TIMING.delay}ms`,
    '--splash-word': `${SPLASH_TIMING.word}ms`,
    '--splash-lift': `${SPLASH_TIMING.lift}ms`,
  } as React.CSSProperties

  return (
    <div className={`splash splash--${phase}`} style={vars} aria-hidden="true">
      <div className="splash__center">
        <span className="splash__word">elute</span>
        <svg className="splash__column" viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
          <defs>
            <clipPath id="splash-col">
              <rect x={COL.x} y={COL.top} width={COL.w} height={COL.bottom - COL.top} />
            </clipPath>
          </defs>
          <rect className="splash__glass" x={COL.x} y={COL.top} width={COL.w} height={COL.bottom - COL.top} rx="2" />
          <g clipPath="url(#splash-col)">
            {BANDS.map((b, i) => {
              const rest = DETECTOR - i * GAP - b.h / 2 - START
              return (
                <rect
                  key={b.label}
                  className={`splash__band splash__band--${b.label}`}
                  x={COL.x}
                  y={START}
                  width={COL.w}
                  height={b.h}
                  style={{ '--dur': `${b.dur}ms`, '--rest': `${rest}px` } as React.CSSProperties}
                />
              )
            })}
          </g>
          <line className="splash__detector" x1={COL.x - 24} x2={COL.x + COL.w + 24} y1={DETECTOR} y2={DETECTOR} />
          {BANDS.map((b, i) => (
            <text key={b.label} className={`splash__label splash__label--${b.label}`} x={COL.x + COL.w + 40} y={DETECTOR - i * GAP + 5} style={{ '--dur': `${b.dur}ms` } as React.CSSProperties}>
              {b.label}
            </text>
          ))}
        </svg>
      </div>
    </div>
  )
}
