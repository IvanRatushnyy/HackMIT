import { describe, expect, it } from 'vitest'
import { nilotinib } from '../fixtures/nilotinib'
import { metforminAd } from '../fixtures/drafts'
import { buildExport, INCLUDE_ALL, toJson, toMarkdown } from './export'

const today = nilotinib.cutoffs[2]
const nov2017 = nilotinib.cutoffs[1]

describe('export model', () => {
  it('omits the assessment entirely when not included (JSON too)', () => {
    const doc = buildExport(nilotinib, today, { choice: 'deprioritise', line: 'private reasoning' }, 'note', { ...INCLUDE_ALL, call: false })
    expect(doc.call).toBeUndefined()
    expect(toJson(doc)).not.toContain('private reasoning')
    expect(toMarkdown(doc)).not.toContain('private reasoning')
  })
  it('carries the evidence date and no later sources at a historical cutoff', () => {
    const doc = buildExport(nilotinib, nov2017, {}, 'note')
    expect(doc.dateLine).toMatch(/20 Nov 2017/)
    const sources = doc.sections.find((s) => s.key === 'sources')!
    expect(sources.lines.some((l) => l.includes('Simuni'))).toBe(false)
    expect(doc.sections.find((s) => s.heading === 'Critical appraisal')!.lines).toHaveLength(3)
  })
  it('says when safety was not assessed rather than implying no warning', () => {
    const noSafety = { ...metforminAd, safety: undefined }
    const doc = buildExport(noSafety, noSafety.cutoffs[0], {}, 'note')
    expect(doc.sections.find((s) => s.heading === 'Safety')!.lines[0]).toMatch(/Not assessed/)
    const withSafety = buildExport(metforminAd, metforminAd.cutoffs[0], {}, 'note')
    expect(withSafety.sections.find((s) => s.heading === 'Safety')!.lines[0]).toMatch(/lactic acidosis/)
  })
})
