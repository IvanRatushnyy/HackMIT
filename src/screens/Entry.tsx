/* elute — Entry: stage 1 of 4. Under the flow, the title, one sentence, and the field, centred. Under the
 * startup screen the blocks wait; when it lifts and the header band has composed, they arrive in turn. */

import { useContext, useState } from 'react'
import { ArrowRight } from '@phosphor-icons/react'
import { Header, StartupDone } from '../components/frame'
import { useAsk } from '../components/useAsk'

/* wait: under the startup screen · go: arriving after it · settled: an ordinary page reveal */
type Arrival = 'wait' | 'go' | 'settled'

function useArrival(): Arrival {
  const done = useContext(StartupDone)
  const [underSplash] = useState(() => !done)
  return !underSplash ? 'settled' : done ? 'go' : 'wait'
}

export function Entry() {
  const t = useAsk()
  const arrival = useArrival()
  return (
    <main className="page">
      <Header stage="ask" />
      <div className={`land land--${arrival}`}>
        <div className="land__lead arrive" style={{ '--i': 0 } as React.CSSProperties}>
          <h1 className="land__title">
            find the trials
            <br />
            worth running
          </h1>
          <p className="land__body">
            Name a drug and a disease. Elute reads the targets, trials and papers, shows where the case is weakest, and tells you what to test first. Every claim is dated and sourced.
          </p>
        </div>

        <form
          className="land__ask arrive"
          style={{ '--i': 2 } as React.CSSProperties}
          onSubmit={(e) => {
            e.preventDefault()
            t.submit()
          }}
        >
          <div className="land__field">
            <input
              id="ask"
              className="land__input"
              type="text"
              aria-label="A drug for a condition, for example nilotinib for Parkinson’s disease"
              placeholder="which drug, for which condition?"
              value={t.text}
              onChange={(e) => t.onChange(e.target.value)}
              autoComplete="off"
              autoFocus
            />
            <button type="submit" className="btn btn--primary btn--lg" disabled={!t.text.trim() || t.launching}>
              appraise
              <ArrowRight size={16} weight="bold" aria-hidden="true" />
            </button>
          </div>
          {/* The hard-coded example always; recorded runs beside it, worded as they were asked (src/components/useAsk.ts). */}
          <div className="land__examples" aria-label="Examples">
            <span className="faint">try:</span>
            {t.examples.map((ex) => (
              <button key={ex.key} type="button" className="land__example" onClick={ex.pick} disabled={t.launching} title={ex.title}>
                {ex.text}
              </button>
            ))}
          </div>
          {t.note && (
            <p className="land__note" role="status">
              {t.note}
            </p>
          )}
        </form>
      </div>
    </main>
  )
}
