/* elute — the ask box on Entry: a chat composer with the paste button and the send button inside it.
 * The box is glass in the stylesheet's own terms: a translucent surface with a backdrop blur over a soft
 * shadow that sits behind it as a sibling, so the shadow shows through the lower part of the box and spills
 * out below it, glowing raspberry at the rim while the field has focus. */

import { useLayoutEffect, useRef } from 'react'
import { useAsk } from './useAsk'

export function Ask({ pasteOpen, pasteId, onPaste }: { pasteOpen: boolean; pasteId: string; onPaste: () => void }) {
  const t = useAsk()
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
      <div className="ask__shadow" aria-hidden="true" />
      <div className="ask">
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
          <button type="button" className="ask__send" aria-label="Appraise" disabled={!t.text.trim()} onClick={t.submit}>
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 19V5M6 11l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
      {t.note && <p className="ask__note annotation">{t.note}</p>}
    </div>
  )
}
