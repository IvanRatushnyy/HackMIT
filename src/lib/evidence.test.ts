import { describe, expect, it } from 'vitest'
import { nilotinib } from '../fixtures/nilotinib'
import {
  clinicalLevel,
  deriveLabel,
  ledgerResult,
  resolveTimeline,
  unresolvedCount,
  validateCandidate,
  visibleObjections,
} from './evidence'
import type { Claim, LedgerRow, Source } from '../data/types'

const cutoff = (id: string) => nilotinib.cutoffs.find((c) => c.id === id)!.date

describe('nilotinib expected labels (spec §7.3)', () => {
  const expected: Record<string, [string, string, string]> = {
    c1: ['established', 'established', 'established'],
    c2: ['established', 'established', 'established'],
    c3: ['established', 'established', 'established'],
    c4: ['contested', 'contested', 'contested'],
    c5: ['single-source', 'contested', 'refuted'],
  }
  for (const claim of nilotinib.chain.claims) {
    it(`${claim.id} ${claim.short}`, () => {
      const [jul, nov, today] = expected[claim.id]
      expect(deriveLabel(claim, nilotinib.sources, cutoff('jul-2016')).label).toBe(jul)
      expect(deriveLabel(claim, nilotinib.sources, cutoff('nov-2017')).label).toBe(nov)
      expect(deriveLabel(claim, nilotinib.sources, cutoff('today')).label).toBe(today)
    })
  }

  it('c5 at Jul 2016 carries the single-source qualifier', () => {
    const r = deriveLabel(nilotinib.chain.claims[4], nilotinib.sources, cutoff('jul-2016'))
    expect(r.qualifier).toBe('n = 12 · open-label · not replicated')
  })

  it('c3 carries its scope', () => {
    const r = deriveLabel(nilotinib.chain.claims[2], nilotinib.sources, cutoff('today'))
    expect(r.qualifier).toBe('in mouse models')
  })
})

describe('objections by cutoff (PRD §12 backtest)', () => {
  it('Jul 2016: exposure and uncontrolled only; MAO-B absent', () => {
    expect(visibleObjections(nilotinib, cutoff('jul-2016')).map((o) => o.id)).toEqual(['o-exposure', 'o-uncontrolled'])
  })
  it('Nov 2017: three pre-trial objections, none post-trial', () => {
    expect(visibleObjections(nilotinib, cutoff('nov-2017')).map((o) => o.id)).toEqual([
      'o-exposure',
      'o-uncontrolled',
      'o-biomarker',
    ])
  })
  it('Today: all four', () => {
    expect(visibleObjections(nilotinib, cutoff('today'))).toHaveLength(4)
  })
})

describe('contradiction-only and refutes', () => {
  const src = (over: Partial<Source>): Source => ({
    id: 'x',
    first_author: 'A',
    journal: 'J',
    year: 2020,
    published: '2020-01-01',
    design: 'pk',
    controlled: false,
    group: 'G',
    url: 'u',
    ledger: 'L1',
    ...over,
  })
  it('contradicts only → contested, with the no-support why', () => {
    const claim: Claim = { id: 'k', node: 'n', short: 's', text: 't', evidence: [{ source: 'x', direction: 'contradicts' }] }
    const r = deriveLabel(claim, [src({})], '2021-01-01')
    expect(r.label).toBe('contested')
    expect(r.why).toMatch(/No published evidence supports/)
  })
  it('refutes → refuted before contested is considered', () => {
    const claim: Claim = {
      id: 'k',
      node: 'n',
      short: 's',
      text: 't',
      evidence: [
        { source: 'x', direction: 'refutes' },
        { source: 'y', direction: 'supports' },
      ],
    }
    const s = [
      src({ id: 'x', design: 'rct', controlled: true, blinded: true, outcome: 'negative' }),
      src({ id: 'y', group: 'H' }),
    ]
    expect(deriveLabel(claim, s, '2021-01-01').label).toBe('refuted')
  })
  it('nothing visible → unknown', () => {
    const claim: Claim = { id: 'k', node: 'n', short: 's', text: 't', evidence: [{ source: 'x', direction: 'supports' }] }
    expect(deriveLabel(claim, [src({ published: '2022-01-01' })], '2021-01-01').label).toBe('unknown')
  })
})

describe('prerequisites', () => {
  it('nilotinib has 4 of 5 unresolved today; conditional counts as resolved', () => {
    expect(unresolvedCount(nilotinib, cutoff('today'))).toBe(4)
  })
  it('timeline resolves to the last entry at or before the cutoff', () => {
    const t = [
      { from: '2010-01-01', value: 'a' },
      { from: '2015-01-01', value: 'b' },
    ]
    expect(resolveTimeline(t, '2009-12-31')).toBeUndefined()
    expect(resolveTimeline(t, '2012-01-01')).toBe('a')
    expect(resolveTimeline(t, '2015-01-01')).toBe('b')
  })
})

describe('publishability (spec §7.5)', () => {
  it('nilotinib is publishable at every cutoff', () => {
    expect(validateCandidate(nilotinib)).toEqual([])
  })
  it('a record valid today but undefined at an earlier cutoff fails', () => {
    const broken = structuredClone(nilotinib)
    broken.prerequisites[0].status = [{ from: '2020-01-01', value: broken.prerequisites[0].status[0].value }]
    const problems = validateCandidate(broken)
    expect(problems.some((p) => p.includes('p-engagement') && p.includes('jul-2016'))).toBe(true)
  })
  it("'refutes' on an uncontrolled source is rejected", () => {
    const broken = structuredClone(nilotinib)
    const claim = broken.chain.claims[4]
    claim.evidence.push({ source: 'schwarzschild-2016', direction: 'refutes' })
    expect(validateCandidate(broken).some((p) => p.includes("'refutes'"))).toBe(true)
  })
})

describe('ledger derived counts', () => {
  const row: LedgerRow = {
    id: 'L5',
    step: 'Registered trials',
    source: 'ClinicalTrials.gov v2',
    unit: 'trials',
    execution: { tool: 't', query: 'q', run_at: '2026-09-19T00:00:00Z', verified: { by: 'automated' } },
    records: [
      { value: 'a', published: '2014-11-01' },
      { value: 'b', published: '2016-11-04' },
      { value: 'c', published: '2021-03-01' },
    ],
  }
  it('counts only records on or before the cutoff', () => {
    expect(ledgerResult(row, '2017-11-20')).toBe('2 trials')
    expect(ledgerResult(row, '2015-01-01')).toBe('1 trial')
    expect(ledgerResult(row, '2026-09-19')).toBe('3 trials')
  })
})

describe('scatter mapping is exhaustive', () => {
  it('maps every controlled × outcome pair to a level', () => {
    const outcomes = ['positive', 'negative', 'mixed', 'none'] as const
    for (const controlled of [true, false]) {
      for (const outcome of outcomes) {
        const level = clinicalLevel({ design: 'x', controlled, outcome, stage: 'phase-2' })
        expect(level).toBeGreaterThanOrEqual(0)
        expect(level).toBeLessThanOrEqual(4)
      }
    }
    expect(clinicalLevel({ design: 'x', controlled: true, outcome: 'negative', stage: 'phase-2' })).toBe(0)
    expect(clinicalLevel({ design: 'x', controlled: false, outcome: 'none', stage: 'preclinical' })).toBe(2)
  })
})
