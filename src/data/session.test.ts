import { afterEach, describe, expect, it, vi } from 'vitest'
import { replaySchedule, type RecordedEvent, type Recording } from './session'
import { candidates, queries } from '../fixtures'

const ev = (seq: number, step: string, phase: RecordedEvent['phase'], at_ms: number, note?: string): RecordedEvent => ({ seq, step, phase, at_ms, done: false, note })

// a run shaped like the real one: three slow retrieval steps, engine steps that take no time, ten settles
const EVENTS: RecordedEvent[] = [
  ev(1, 'L1', 'question', 0),
  ev(2, 'L1', 'progress', 500, 'resolving'),
  ev(3, 'L1', 'settled', 4_000),
  ev(4, 'L2', 'question', 4_000),
  ev(5, 'L2', 'settled', 12_000),
  ev(6, 'L3', 'question', 12_000),
  ev(7, 'L3', 'progress', 15_000, 'searching'),
  ev(8, 'L3', 'settled', 20_000),
  ev(9, 'L4', 'question', 20_000),
  ev(10, 'L4', 'progress', 30_000, 'facet 1'),
  ev(11, 'L4', 'progress', 60_000, 'facet 5'),
  ev(12, 'L4', 'settled', 100_000),
  ev(13, 'L5', 'settled', 100_010),
  ev(14, 'L6', 'settled', 100_020),
  ev(15, 'L7', 'settled', 100_030),
  ev(16, 'L8', 'settled', 100_040),
  ev(17, 'L9', 'settled', 102_000),
  ev(18, 'L10', 'settled', 102_500),
]

describe('replaySchedule', () => {
  it('keeps every step proportional to its real length, with a floor so each can be read', () => {
    const s = replaySchedule(EVENTS, 24_000, 1_100)
    expect(s.steps.L4).toBeGreaterThan(s.steps.L2)
    expect(s.steps.L2).toBeGreaterThan(s.steps.L1)
    for (const step of ['L5', 'L6', 'L7', 'L8']) expect(s.steps[step]).toBe(1_100)
    // the slow steps share the target in proportion; the floors add on top
    expect(s.steps.L4 / s.steps.L2).toBeCloseTo(80_000 / 8_000, 0)
    expect(s.total).toBeCloseTo(Object.values(s.steps).reduce((a, b) => a + b, 0), 6)
  })

  it('places progress lines inside their step at the same fraction as in the real run', () => {
    const s = replaySchedule(EVENTS, 24_000, 1_100)
    const l4Start = s.steps.L1 + s.steps.L2 + s.steps.L3
    expect(s.at.get(9)).toBeCloseTo(l4Start, 6) // the question opens the step
    expect(s.at.get(10)).toBeCloseTo(l4Start + s.steps.L4 * (10_000 / 80_000), 6)
    expect(s.at.get(11)).toBeCloseTo(l4Start + s.steps.L4 * (40_000 / 80_000), 6)
    expect(s.at.get(12)).toBeCloseTo(l4Start + s.steps.L4, 6) // the settle closes it
  })

  it('is monotonic in event order', () => {
    const s = replaySchedule(EVENTS)
    let prev = -1
    for (const e of EVENTS) {
      const t = s.at.get(e.seq)!
      expect(t).toBeGreaterThanOrEqual(prev)
      prev = t
    }
  })
})

/* The scripted mark: a slug asked for as the hard-coded example is served from the fixture even when the
 * session sits on the API source, so the demo never depends on the backend. */
import { SessionSource } from './session'
import { FixtureSource, type DataSource } from './source'

const SLUG = 'nilotinib--parkinsons-disease'

function apiLike(): DataSource & { forgotten: string[] } {
  const rec = { slug: SLUG, kind: 'pair' as const, heading: 'from the api', resolved: '', ledger: { kind: 'recorded' as const, rows: [] }, candidates: [SLUG], pair: { candidate: 'nilotinib', condition: 'parkinsons-disease' } }
  return {
    mode: 'live',
    forgotten: [],
    entities: async () => ({ entities: [] }),
    provenance: async () => ({ today: '', summary: '', production_sources: [], curated: [], synthetic: [], label_overrides: [], curatorial_decisions: [] }),
    query: async () => rec,
    hasRun: () => false,
    forget(slug) {
      this.forgotten.push(slug)
    },
    async *run() {},
    results: async () => ({ query: rec, today: '2026-09-19', candidates: [] }),
    candidate: async () => undefined,
  }
}

describe('SessionSource with a scripted slug', () => {
  it('serves an unmarked slug from the inner source', async () => {
    const s = new SessionSource(apiLike(), new FixtureSource())
    expect((await s.query(SLUG))?.heading).toBe('from the api')
  })

  it('serves a slug marked scripted from the fixture, and the run settles the fixture rows', async () => {
    const inner = apiLike()
    const s = new SessionSource(inner, new FixtureSource())
    s.forget(SLUG, { scripted: true })
    expect(inner.forgotten).toEqual([SLUG])
    const rec = await s.query(SLUG)
    expect(rec?.ledger.kind).toBe('scripted')
    expect(rec?.heading).toBe('Nilotinib for Parkinson’s disease')
    const results = await s.results(SLUG)
    expect(results?.candidates.map((c) => c.drug_slug)).toEqual(['nilotinib'])
    expect((await s.candidate(SLUG, 'nilotinib'))?.slug).toBe(SLUG)
  })

  it('a later ask without the mark goes back to the inner source', async () => {
    const s = new SessionSource(apiLike(), new FixtureSource())
    s.forget(SLUG, { scripted: true })
    expect((await s.query(SLUG))?.ledger.kind).toBe('scripted')
    s.forget(SLUG)
    expect((await s.query(SLUG))?.heading).toBe('from the api')
  })
})

/* A recording of the pair plays only when the ask resolved to it. A slug opened any other way in fixture mode keeps
 * the curated record, so a draft recording never displaces it on a direct URL. */
describe('SessionSource and a recording of the pair', () => {
  const recording = (): Recording => ({
    version: 1,
    recorded_at: '2026-09-20T10:00:00+00:00',
    run: { id: 'ap_1', slug: SLUG, drug: 'nilotinib', disease: 'Parkinson disease', as_of: '2026-09-19', status: 'complete_with_gaps', elapsed_ms: 102_500, llm: 'unavailable', data_mode: 'live' },
    events: EVENTS,
    detail: { candidate: candidates.find((c) => c.slug === SLUG)!, query: { ...queries.find((q) => q.slug === SLUG)!, heading: 'from the recording' } },
  })
  let fetched = 0
  const serve = () => {
    fetched++
    return Promise.resolve(new Response(JSON.stringify(recording()), { headers: { 'content-type': 'application/json' } }))
  }

  afterEach(() => {
    vi.unstubAllGlobals()
    fetched = 0
  })

  it('an unmarked slug in fixture mode is served by the fixture; the recording is not even fetched', async () => {
    vi.stubGlobal('fetch', serve)
    const s = new SessionSource(new FixtureSource())
    expect((await s.query(SLUG))?.ledger.kind).toBe('scripted')
    expect(fetched).toBe(0)
  })

  it('an ask that resolved to the recording replays it, at demo pace, as a recorded ledger', async () => {
    vi.stubGlobal('fetch', serve)
    const s = new SessionSource(new FixtureSource())
    s.forget(SLUG, { replay: true })
    const rec = await s.query(SLUG)
    expect(rec?.heading).toBe('from the recording')
    expect(rec?.ledger.kind).toBe('recorded')
    expect(rec?.ledger.replay_of?.run_id).toBe('ap_1')
    expect(rec?.ledger.estimate?.basis).toMatch(/^a recorded run of 1 min 43 s real time, replayed/)
    expect((await s.results(SLUG))?.candidates.map((c) => c.slug)).toEqual([SLUG])
    expect(fetched).toBe(1)
  })
})
