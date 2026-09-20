/* elute — Entry: the ask box centred in the space under the header, the shard composition rippling
 * behind it, paste a paper behind the + button. Submitting sends one ripple out from the box and the
 * next page arrives on its wake. */

import { useContext, useId, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useReducedMotion } from 'motion/react'
import { Header, StartupDone } from '../components/frame'
import { Ask } from '../components/Ask'
import { PastePaper } from '../components/PastePaper'
import { useAsk } from '../components/useAsk'

const RIPPLE_MS = 640

/* wait: under the startup screen · go: arriving after it · settled: an ordinary page reveal */
type Arrival = 'wait' | 'go' | 'settled'

function useArrival(): Arrival {
  const done = useContext(StartupDone)
  const [underSplash] = useState(() => !done)
  return !underSplash ? 'settled' : done ? 'go' : 'wait'
}

export function Entry() {
  const [params] = useSearchParams()
  const [paste, setPaste] = useState(params.get('paste') === '1')
  const pasteId = useId()
  const arrival = useArrival()
  const reduce = useReducedMotion()
  /* A generated loop could replace the mesh ground on this page: drop `public/entry-loop.mp4` and a poster in,
   * render <video className="entry__loop" muted loop playsInline autoPlay poster="/entry-loop.jpg" src="/entry-loop.mp4" />
   * inside .entry before the block, hidden under reduced motion by entry.css. Kling 3.0 prompt, 5 s, 16:9, 1080p:
   * "Four thin curved planes of glass in ink black, slate blue-grey, dust grey and deep raspberry, stacked and
   * intersecting like the layers of a crystal, slowly sliding apart into four separate bands, drifting on a plain
   * warm-white paper background, soft studio light, macro product render, no text, no people, no molecules, the
   * last frame matching the first for a seamless loop." Generate three, keep the one whose seam does not show. */
  const ripple = useRef<HTMLDivElement>(null)

  // One ripple from the box outward, then the navigation; the wait is the ripple's length
  const launch = () => {
    const el = ripple.current
    if (!el || reduce) return 0
    el.animate(
      [
        { transform: 'scale(0.2)', opacity: 0.9 },
        { transform: 'scale(1)', opacity: 0 },
      ],
      { duration: RIPPLE_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' },
    )
    return RIPPLE_MS - 200
  }
  const t = useAsk(launch)

  return (
    <main className="page">
      <Header />
      <div className={`entry entry--${arrival}`}>
        <div className="entry__block">
          <Ask t={t} pasteOpen={paste} pasteId={pasteId} onPaste={() => setPaste((p) => !p)} />
          {paste && <PastePaper id={pasteId} onClose={() => setPaste(false)} />}
        </div>
        <div ref={ripple} className="entry__ripple" aria-hidden="true" />
      </div>
    </main>
  )
}
