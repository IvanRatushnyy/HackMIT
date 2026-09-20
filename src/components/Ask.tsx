/* elute — the ask box on Entry: one paper sheet with the field, the paste circle and the ink send circle
 * inside it, and the three example chips beneath that teach the three modes by example. */

import { useLayoutEffect, useRef } from 'react'
import type { useAsk } from './useAsk'

type Ask = ReturnType<typeof useAsk>

const EXAMPLES = ['Parkinson’s disease', 'metformin', 'nilotinib for Parkinson’s']

export function Ask({ t, pasteOpen, pasteId, onPaste }: { t: Ask; pasteOpen: boolean; pasteId: string; onPaste: () => void }) {
  const input = useRef<HTMLTextAreaElement>(null)

  // The field grows with its text, up to the stylesheet's max-height
  useLayoutEffect(() => {
    const el = input.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [t.text])

  return (
    <div className="ask-wrap">
      <div className={`ask panel${t.launching ? ' ask--launching' : ''}`}>
        <textarea
          ref={input}
          className="ask__input"
          rows={2}
          aria-label="Drug, condition, or drug for condition"
          placeholder="Drug, condition, or drug for condition"
          value={t.text}
          onChange={(e) => t.onChange(e.target.value)}
          onKeyDown={t.onKey}
        />
        <div className="ask__actions">
          <button
            type="button"
            className="ask__plus"
            aria-label="Paste a paper (PMID, DOI, abstract)"
            aria-expanded={pasteOpen}
            aria-controls={pasteId}
            onClick={onPaste}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <button type="button" className="ask__send" aria-label="Appraise" disabled={!t.text.trim() || t.launching} onClick={t.submit}>
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 19V5M6 11l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
      <div className="ask__under">
        <div className="ask__examples" aria-label="Examples">
          {EXAMPLES.map((word) => (
            <button key={word} type="button" className="chip chip--button" onClick={() => t.go(word)} disabled={t.launching}>
              {word}
            </button>
          ))}
        </div>
        {t.note && (
          <p className="ask__note" role="status">
            {t.note}
          </p>
        )}
      </div>
    </div>
  )
}
