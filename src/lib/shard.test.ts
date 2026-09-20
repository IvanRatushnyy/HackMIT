import { describe, expect, it } from 'vitest'
import shardSvg from '../../design/shard/shard.svg?raw'
import { parseShard } from './shard'

const BRAND = new Set(['#D3D2D2', '#82204A', '#06070D', '#47667D'])

describe('parseShard', () => {
  const shard = parseShard(shardSvg)
  it('keeps every plane in document order: the first is the bottommost, the last the topmost', () => {
    expect(shard.planes).toHaveLength(13)
    expect(shard.planes[0].fill).toBe('#D3D2D2') // the dust ground, in two pieces so it composes smoothly
    expect(shard.planes[1].fill).toBe('#D3D2D2')
    expect(shard.planes[12].fill).toBe('#06070D') // the small black tip at the top of the stack
  })
  it('reads the viewBox and only brand fills', () => {
    expect(shard.viewBox).toEqual({ width: 1440, height: 744 })
    for (const p of shard.planes) {
      expect(BRAND.has(p.fill)).toBe(true)
      expect(p.d.length).toBeGreaterThan(20)
    }
  })
})
