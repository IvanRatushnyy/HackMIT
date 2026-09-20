/* elute — the startup screen's timeline, in ms from the first frame: the single source of its timings.
 *
 * A mixture enters the column as one dark band. The compounds travel at different speeds, so what was one
 * thing comes out as four, in order; each word appears at the detector as its band arrives. The wordmark
 * settles along its width axis as the first band lands. Then the stage lifts. */

export type Band = { label: 'established' | 'contested' | 'unknown' | 'single-source'; dur: number; h: number }

/** The four bands, in the order they leave the column: what is established leaves first. */
export const BANDS: Band[] = [
  { label: 'established', dur: 1400, h: 28 },
  { label: 'contested', dur: 1800, h: 22 },
  { label: 'unknown', dur: 2200, h: 14 },
  { label: 'single-source', dur: 2600, h: 18 },
]

export type SplashTiming = {
  delay: number   // before the first band moves
  bands: number[] // each band's travel time
  word: number    // the wordmark's settle along the width axis
  hold: number    // the separated bands on screen after the last lands
  lift: number    // the stage fading out
}

export const SPLASH_TIMING: SplashTiming = { delay: 200, bands: BANDS.map((b) => b.dur), word: 640, hold: 400, lift: 400 }

export type SplashSchedule = { wordSettle: number; lift: number; done: number }

/** The wordmark settles as the first band lands; the stage lifts a hold after the last; done when lifted. */
export function splashSchedule(t: SplashTiming): SplashSchedule {
  const first = t.bands.length ? Math.min(...t.bands) : 0
  const last = t.bands.length ? Math.max(...t.bands) : 0
  const wordSettle = t.delay + first
  const lift = t.delay + last + t.hold
  return { wordSettle, lift, done: lift + t.lift }
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}
