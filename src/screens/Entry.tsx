/* elute — Entry: one field with the Appraise button, three mode examples, and the recent list. */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DataNote, Header, Kicker } from '../components/frame'
import { SearchField } from '../components/SearchField'
import { source } from '../data/source'
import type { QueryRecord } from '../data/types'
import { loadRecent, whenWord } from '../lib/recent'

const MODES = [
  { word: 'condition → candidates', slug: 'parkinsons-disease', title: 'Try: Parkinson’s disease' },
  { word: 'drug → indications', slug: 'metformin', title: 'Try: metformin' },
  { word: 'pair → appraisal', slug: 'nilotinib--parkinsons-disease', title: 'Try: nilotinib for Parkinson’s disease' },
]

type RecentRow = { q: QueryRecord; at: string; meta: string }

export function Entry({ banner }: { banner: string }) {
  const navigate = useNavigate()
  const [rows, setRows] = useState<RecentRow[]>([])

  useEffect(() => {
    const seed = ['parkinsons-disease', 'nilotinib--parkinsons-disease', 'metformin']
    const recent = loadRecent()
    const slugs = [...recent.map((r) => r.slug), ...seed.filter((s) => !recent.some((r) => r.slug === s))]
    Promise.all(slugs.map((s) => source.query(s))).then(async (qs) => {
      const out: RecentRow[] = []
      for (const q of qs) {
        if (!q) continue
        const page = await source.results(q.slug)
        const n = page?.candidates.length ?? 0
        const meta = q.kind === 'pair' ? 'appraisal' : q.kind === 'drug' ? `${n} indications` : `${n} candidates`
        const at = recent.find((r) => r.slug === q.slug)?.at
        out.push({ q, at: at ? whenWord(at) : 'example', meta })
      }
      setRows(out)
    })
  }, [])

  return (
    <main className="page">
      <Header entry />
      <div className="col col--narrow entry">
        <div className="entry__block rise" style={{ '--i': 0 } as React.CSSProperties}>
          <Kicker>appraise</Kicker>
          <SearchField big autoFocus />
          <div className="entry__modes">
            {MODES.map((m) => (
              <button key={m.slug} type="button" className="chip chip--button" title={m.title} onClick={() => navigate(`/q/${m.slug}`)}>
                {m.word}
              </button>
            ))}
          </div>
        </div>

        {rows.length > 0 && (
          <div className="entry__block rise" style={{ '--i': 2 } as React.CSSProperties}>
            <Kicker>recent</Kicker>
            <div className="panel" role="list">
              {rows.map((r) => (
                <div key={r.q.slug} className="panel__row recent__row" role="listitem" onClick={() => navigate(`/q/${r.q.slug}`)}>
                  <span className="display-xs recent__name">{r.q.heading}</span>
                  <span className="recent__meta">{r.meta}</span>
                  <span className="recent__when">{r.at}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <DataNote text={banner} />
    </main>
  )
}
