import { describe, expect, it } from 'vitest'
import { BANDS, SPLASH_TIMING, splashSchedule } from './splash'

describe('splashSchedule', () => {
  it('settles the wordmark as the first band lands, lifts a hold after the last, about three seconds in all', () => {
    const t = splashSchedule(SPLASH_TIMING)
    expect(t.wordSettle).toBe(200 + 1400)
    expect(t.lift).toBe(200 + 2600 + 400)
    expect(t.done).toBe(t.lift + 400)
    expect(t.done).toBeLessThanOrEqual(3600)
  })
  it('bands leave in label order, the established one first', () => {
    expect(BANDS.map((b) => b.label)).toEqual(['established', 'contested', 'unknown', 'single-source'])
    for (let i = 1; i < BANDS.length; i++) expect(BANDS[i].dur).toBeGreaterThan(BANDS[i - 1].dur)
  })
  it('collapses to nothing when every duration is zero (reduced motion)', () => {
    const z = splashSchedule({ delay: 0, bands: [0, 0, 0, 0], word: 0, hold: 0, lift: 0 })
    expect(z).toEqual({ wordSettle: 0, lift: 0, done: 0 })
  })
})
