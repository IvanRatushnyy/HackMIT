/* elute — Entry: stage 1 of 5. Under the flow, the title, one sentence, and the field, centred. Under the
 * startup screen the blocks wait; when it lifts and the header band has composed, they arrive in turn. */

import { useContext, useState } from 'react'
import { ArrowRight } from '@phosphor-icons/react'
import { Header, StartupDone } from '../components/frame'
import { useAsk } from '../components/useAsk'

const EXAMPLES = ['Parkinson’s disease', 'metformin', 'nilotinib for Parkinson’s']

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
            prove it
            <br />
            to me
          </h1>
          <p className="land__body">The strongest argument against a repurposing candidate first, dated and sourced. It never recommends.</p>
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
              aria-label="A condition, a drug, or a drug for a condition"
              placeholder="a condition, a drug, or a drug for a condition"
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
          <div className="land__examples" aria-label="Examples">
            <span className="faint">try</span>
            {EXAMPLES.map((word) => (
              <button key={word} type="button" className="land__example" onClick={() => t.go(word)} disabled={t.launching}>
                {word}
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
