import { describe, expect, it } from 'vitest'
import { candidates } from '../fixtures'
import { isTested, orderTested, registers } from './registers'

const pd = candidates.filter((c) => c.condition_slug === 'parkinsons-disease')
const by = (slug: string) => pd.find((c) => c.slug === slug)!

describe('registers', () => {
  it('a controlled study reported puts a candidate in the tested register', () => {
    expect(isTested(by('nilotinib--parkinsons-disease'))).toBe(true)
    expect(isTested(by('exenatide--parkinsons-disease'))).toBe(true)
    expect(isTested(by('ambroxol--parkinsons-disease'))).toBe(false)
  })
  it('orders the tested register by outcome, then by n', () => {
    const order = orderTested(pd.filter(isTested)).map((c) => c.drug_slug)
    // all negative today, so by n descending: isradipine 336, simvastatin 235, exenatide 194, nilotinib 76, metformin 60
    expect(order).toEqual(['isradipine', 'simvastatin', 'exenatide', 'nilotinib', 'metformin'])
  })
  it('lists the untested register first and drops an empty register', () => {
    const regs = registers(pd)
    expect(regs.map((r) => r.id)).toEqual(['untested', 'tested'])
    expect(regs[0].rows.map((c) => c.drug_slug)).toEqual(['ambroxol'])
    expect(registers(pd.filter(isTested)).map((r) => r.id)).toEqual(['tested'])
  })
})
