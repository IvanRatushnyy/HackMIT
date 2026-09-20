/* elute — the startup screen: the hero from the mockup, once per page load.
 * The planes compose (topmost first), the wordmark fades in, the hero holds for a second, the planes
 * come apart (bottommost first), and the wordmark travels to its place in the header as the page fades in. */

import { useLayoutEffect, useRef, useState } from 'react'
import { SHARD, Shard, type ShardPhase } from './frame'
import { GROUND_PLANES } from '../lib/shard'
import { splashSchedule } from '../lib/splash'

type Phase = 'compose' | 'word' | 'decompose' | 'move'
const BAND: Record<Phase, ShardPhase> = { compose: 'in', word: 'shown', decompose: 'out', move: 'hidden' }

/** A duration token as ms: "240ms" → 240, "1s" → 1000. */
function ms(style: CSSStyleDeclaration, name: string): number {
  const v = style.getPropertyValue(name).trim()
  const n = parseFloat(v)
  if (!Number.isFinite(n)) return 0
  return v.endsWith('ms') ? n : n * 1000
}

/** FLIP: point the hero wordmark at the header's box. Without a header to land on it just fades. */
function aim(word: HTMLElement) {
  const target = document.querySelector<HTMLElement>('.header .wordmark')
  if (!target) {
    word.style.opacity = '0'
    return
  }
  const from = word.getBoundingClientRect()
  const to = target.getBoundingClientRect()
  word.style.setProperty('--dx', `${to.left - from.left}px`)
  word.style.setProperty('--dy', `${to.top - from.top}px`)
  word.style.setProperty('--s', String(to.height / from.height))
}

export function Splash({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>('compose')
  const root = useRef<HTMLDivElement>(null)
  const word = useRef<HTMLSpanElement>(null)

  // A layout effect, so the cleanup that unhides the header's wordmark lands in the same paint as the unmount.
  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const style = getComputedStyle(el)
    const t = splashSchedule({
      fade: ms(style, '--shard-fade'),
      stagger: ms(style, '--shard-stagger'),
      planes: SHARD.planes.length,
      ground: GROUND_PLANES,
      groundGap: ms(style, '--shard-ground-gap'),
      word: ms(style, '--splash-word'),
      hold: ms(style, '--splash-hold'),
      move: ms(style, '--splash-move'),
    })
    window.scrollTo(0, 0)
    document.documentElement.setAttribute('data-splash', '')
    const timers = [
      setTimeout(() => setPhase('word'), t.wordIn),
      setTimeout(() => setPhase('decompose'), t.decompose),
      setTimeout(() => {
        if (word.current) aim(word.current)
        setPhase('move')
      }, t.move),
      setTimeout(onDone, t.done),
    ]
    return () => {
      timers.forEach(clearTimeout)
      document.documentElement.removeAttribute('data-splash')
    }
  }, [onDone])

  return (
    <div ref={root} className={`splash splash--${phase}`} aria-hidden="true">
      <div className="splash__bg" />
      <div className="splash__band">
        <span ref={word} className="wordmark splash__word">
          elute
        </span>
      </div>
      <Shard className="splash__shard" phase={BAND[phase]} fit="xMidYMin slice" />
    </div>
  )
}
