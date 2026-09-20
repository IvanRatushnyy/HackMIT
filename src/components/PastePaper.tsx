/* elute — paste a paper: PMID, DOI, registry id, or abstract. The extraction is shown before
 * anything runs, so a wrong read is caught in two seconds. Unmatched text never navigates. */

import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Kicker } from './frame'
import { plain } from './evidence'
import { readPaper, type Paper } from '../fixtures/papers'

export function PastePaper({ id, onClose }: { id?: string; onClose: () => void }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  // ?paste=1&text=… pre-fills and reads, so the moment is deep-linkable for the demo.
  const initial = params.get('text') ?? ''
  const [text, setText] = useState(initial)
  const [paper, setPaper] = useState<Paper | null | undefined>(initial ? (readPaper(initial) ?? null) : undefined)

  const read = () => setPaper(readPaper(text) ?? null)

  return (
    <div className="arrive">
      <div id={id} className="panel panel--pad paste" role="region" aria-label="Paste a paper">
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
        </div>

        {paper === null && (
          <p className="paste__none">Not in the curated set. In production the identifier is resolved through Europe PMC and the design classified before an appraisal starts.</p>
        )}

        {paper && (
          <div className="paste__read fade" key={paper.id}>
            <p className="medium">{paper.extraction.title}</p>
            <p className="paste__cite">{paper.extraction.citation}</p>
            <dl className="paste__facts">
              <dt>design</dt>
              <dd>{paper.extraction.design}</dd>
              <dt>blinded</dt>
              <dd>{paper.extraction.blinded}</dd>
              <dt>placebo arm</dt>
              <dd>{paper.extraction.placebo}</dd>
              <dt>n</dt>
              <dd>{paper.extraction.n ?? 'not stated'}</dd>
              <dt>outcome</dt>
              <dd>{paper.extraction.outcome}</dd>
              <dt>classifies at</dt>
              <dd>{plain(paper.extraction.source)}</dd>
            </dl>
            <div className="paste__actions">
              <button type="button" className="btn btn--primary" onClick={() => navigate(`/q/${paper.appraise.slug}`)}>
                Appraise {paper.appraise.word}
              </button>
              <span className="paste__stop">If the read is wrong, stop here.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
