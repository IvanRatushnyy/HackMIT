/* elute — Entry (Figma Desktop-1): white band, shard hero with three example chips,
 * and the worked nilotinib appraisal below so the tool's character shows before anyone types. */

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Banner, Shard, Sheet, Wordmark } from '../components/frame'
import { SearchField } from '../components/SearchField'
import { Appraisal } from '../components/detail'
import { source } from '../data/source'
import type { CandidateDetail } from '../data/types'
import { findCutoff } from '../lib/evidence'

const CHIPS = [
  { word: 'Parkinson’s disease', slug: 'parkinsons-disease' },
  { word: 'metformin', slug: 'metformin' },
  { word: 'nilotinib for Parkinson’s', slug: 'nilotinib--parkinsons-disease' },
]

export function Entry({ banner }: { banner: string }) {
  const navigate = useNavigate()
  const [worked, setWorked] = useState<CandidateDetail | undefined>()

  useEffect(() => {
    source.candidate('parkinsons-disease', 'nilotinib').then(setWorked)
  }, [])

  return (
    <main className="page">
      <header className="band">
        <div className="band__mark">
          <Wordmark variant="entry" />
        </div>
        <div className="band__ask">
          <p className="band__sentence">Approved drugs that might treat something else — and the strongest case against each one.</p>
          <SearchField autoFocus />
        </div>
        <Banner text={banner} />
      </header>

      <div className="hero">
        <Shard />
        <div className="hero__chips pill-group" role="group" aria-label="Examples">
          {CHIPS.map((c) => (
            <button key={c.slug} type="button" className="pill" onClick={() => navigate(`/q/${c.slug}`)}>
              {c.word}
            </button>
          ))}
        </div>
      </div>

      {worked && (
        <section className="worked" aria-labelledby="worked">
          <h2 className="section__title" id="worked">
            What an appraisal looks like — nilotinib for Parkinson’s disease
          </h2>
          <Sheet>
            <Appraisal candidate={worked} cutoff={findCutoff(worked, 'today')} limit={3} />
          </Sheet>
          <Link className="worked__link" to="/q/parkinsons-disease/nilotinib">
            Open the full appraisal →
          </Link>
        </section>
      )}
    </main>
  )
}
