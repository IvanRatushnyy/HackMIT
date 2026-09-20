/* elute — the startup screen's timeline, in ms from the first frame. Durations come from the CSS tokens. */

export type SplashTiming = {
  fade: number    // one plane's fade (--shard-fade)
  stagger: number // between planes (--shard-stagger)
  planes: number  // how many planes the mark has
  ground: number  // how many of them are the ground pieces
  groundGap: number // extra time between ground pieces (--shard-ground-gap)
  word: number    // the wordmark's fade-in (--splash-word)
  hold: number    // the composed hero on screen (--splash-hold)
  move: number    // the wordmark's travel to the header (--splash-move)
}

export type SplashSchedule = { wordIn: number; decompose: number; move: number; done: number }

/** Compose the planes, fade the wordmark in, hold, decompose the planes, move the wordmark, done. */
export function splashSchedule(t: SplashTiming): SplashSchedule {
  const cascade = Math.max(0, t.planes - 1) * t.stagger + Math.max(0, t.ground - 1) * t.groundGap + t.fade
  const wordIn = cascade
  const decompose = wordIn + t.word + t.hold
  const move = decompose + cascade
  return { wordIn, decompose, move, done: move + t.move }
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}
