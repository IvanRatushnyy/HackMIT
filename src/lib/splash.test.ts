import { describe, expect, it } from 'vitest'
import { splashSchedule } from './splash'

describe('splashSchedule', () => {
  const t = splashSchedule({ fade: 240, stagger: 40, planes: 12, ground: 2, groundGap: 80, word: 400, hold: 1000, move: 400 })
  it('composes the planes before the wordmark, holds a second, then decomposes and moves', () => {
    expect(t.wordIn).toBe(11 * 40 + 80 + 240) // the last ground piece, a gap later, has finished fading
    expect(t.decompose).toBe(t.wordIn + 400 + 1000)
    expect(t.move).toBe(t.decompose + 11 * 40 + 80 + 240)
    expect(t.done).toBe(t.move + 400)
  })
  it('collapses to nothing when every duration is zero (reduced motion)', () => {
    const z = splashSchedule({ fade: 0, stagger: 0, planes: 12, ground: 2, groundGap: 0, word: 0, hold: 0, move: 0 })
    expect(z).toEqual({ wordIn: 0, decompose: 0, move: 0, done: 0 })
  })
})
