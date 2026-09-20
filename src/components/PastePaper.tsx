/* elute — paste a paper: PMID, DOI, registry id, or abstract. The extraction is shown before
 * anything runs, so a wrong read is caught in two seconds. Unmatched text never navigates. */

import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Kicker } from './frame'
import { readPaper, type Paper } from '../fixtures/papers'

export function PastePaper({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  // ?paste=1&text=… pre-fills and reads, so the moment is deep-linkable for the demo.
  const initial = params.get('text') ?? ''
  const [text, setText] = useState(initial)
  const [paper, setPaper] = useState<Paper | null | undefined>(initial ? (readPaper(initial) ?? null) : undefined)

  const read = () => setPaper(readPaper(text) ?? null)

  return (
    <div className="panel panel--pad paste rise" role="region" aria-label="Paste a paper">
      <div className="paste__head">
        <Kicker>paste a paper</Kicker>
        <button type="button" className="cite" onClick={onClose}>
          close
        </button>
      </div>
      <textarea
        className="textarea"
        aria-label="PMID, DOI, registry id, or abstract"
        placeholder="PMID, DOI, NCT id, or an abstract"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setPaper(undefined)
        }}
      />
      <div className="paste__actions">
        <button type="button" className="btn btn--primary" onClick={read} disabled={!text.trim()}>
          Read
        </button>
        <span className="cell__sub">Shows what was extracted — design, blinding, n — before anything runs.</span>
      </div>

      {paper === null && (
        <p className="cell__sub">
          Couldn’t match this to the curated set. In production the identifier would be resolved through Europe PMC and the study design classified before any
          appraisal starts.
        </p>
      )}

      {paper && (
        <div className="paste__read rise" key={paper.id}>
          <Kicker>what was read</Kicker>
          <p className="medium">{paper.extraction.title}</p>
          <p className="cell__sub">{paper.extraction.citation}</p>
          <dl className="paste__facts">
            <dt>design</dt>
            <dd>{paper.extraction.design}</dd>
            <dt>blinded</dt>
            <dd>{paper.extraction.blinded}</dd>
            <dt>placebo arm</dt>
            <dd>{paper.extraction.placebo}</dd>
            <dt>n</dt>
            <dd>{paper.extraction.n ?? '—'}</dd>
            <dt>outcome</dt>
            <dd>{paper.extraction.outcome}</dd>
            <dt>would classify at</dt>
            <dd>{paper.extraction.source}</dd>
          </dl>
          <div className="paste__actions">
            <button type="button" className="btn btn--primary" onClick={() => navigate(`/q/${paper.appraise.slug}`)}>
              Appraise {paper.appraise.word}
            </button>
            <span className="cell__sub">If the read is wrong, stop here.</span>
          </div>
        </div>
      )}
    </div>
  )
}
