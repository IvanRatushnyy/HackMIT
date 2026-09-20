import { describe, expect, it } from 'vitest'
import { isScriptedAsk, SCRIPTED_ASK } from './useAsk'

describe('isScriptedAsk', () => {
  it('recognises the hard-coded example as written', () => {
    expect(SCRIPTED_ASK).toBe('nilotinib for Parkinson’s')
    expect(isScriptedAsk('nilotinib for Parkinson’s')).toBe(true)
  })

  it('forgives the apostrophe, case and surrounding space', () => {
    expect(isScriptedAsk("nilotinib for Parkinson's")).toBe(true)
    expect(isScriptedAsk('  Nilotinib for parkinson’s ')).toBe(true)
    expect(isScriptedAsk('nilotinib  for  Parkinson’s')).toBe(true)
  })

  it('leaves every other ask alone', () => {
    expect(isScriptedAsk('nilotinib for Parkinson’s disease')).toBe(false)
    expect(isScriptedAsk('nilotinib')).toBe(false)
    expect(isScriptedAsk('metformin for Parkinson’s')).toBe(false)
    expect(isScriptedAsk('')).toBe(false)
  })
})
