/* elute — Entry: stage 1 of 5. The headline says what the tool does; the field is the pivot of the page;
 * under it, the four stages that follow, so the person knows what pressing Enter starts and where it ends. */

import { Header } from '../components/frame'
import { Molecule } from '../components/Molecule'
import { StageIcon } from '../components/Stages'
import { useAsk } from '../components/useAsk'

const EXAMPLES = ['Parkinson’s disease', 'metformin', 'nilotinib for Parkinson’s']

const NEXT = [
  { id: 'research', word: 'research', line: 'ten checks against public sources, about half a minute' },
  { id: 'candidates', word: 'candidates', line: 'every drug with human data, ranked, weakest link shown' },
  { id: 'appraisal', word: 'appraisal', line: 'the case against, the pathway, what a trial would need' },
  { id: 'share', word: 'share', line: 'a discussion deck for the meeting, with your call' },
] as const

export function Entry() {
  const t = useAsk()
  return (
    <main className="page">
      <Header stage="ask" />
      <div className="land">
        <div className="land__top">
          <div className="land__lead">
            <h1 className="land__title">
              prove it
              <br />
              to me
            </h1>
            <p className="land__body">
              Name a condition, an approved drug, or a candidate pair. Elute checks it against the public record and puts
              the strongest argument against it on the page first, dated and sourced. It organises evidence for a scientist
              who is qualified to weigh it. It never recommends.
            </p>
          </div>
          <Molecule className="land__art" />
        </div>

        <form
          className="land__ask"
          onSubmit={(e) => {
            e.preventDefault()
            t.submit()
          }}
        >
          <label className="land__label" htmlFor="ask">
            1 ask
          </label>
          <div className="land__field">
            <input
              id="ask"
              className="land__input"
              type="text"
              placeholder="a condition, a drug, or a drug for a condition"
              value={t.text}
              onChange={(e) => t.onChange(e.target.value)}
              autoComplete="off"
              autoFocus
            />
            <button type="submit" className="land__go" disabled={!t.text.trim() || t.launching}>
              appraise
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </div>
          <div className="land__examples" aria-label="Examples">
            <span className="land__try">try</span>
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

        <ol className="land__next" aria-label="What happens next">
          {NEXT.map((s, i) => (
            <li key={s.id} className="land__step">
              <span className="land__step-icon">
                <StageIcon id={s.id} />
              </span>
              <span className="land__step-n">{i + 2}</span>
              <span className="land__step-word">{s.word}</span>
              <span className="land__step-line">{s.line}</span>
            </li>
          ))}
        </ol>
      </div>
    </main>
  )
}
