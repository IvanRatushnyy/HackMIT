/* elute — Export appraisal: format, what to include, and a live preview built from the same
 * cutoff-filtered model the Detail page shows. Markdown and JSON download; Print gives a PDF. */

import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { DataNote, Header, Kicker } from '../components/frame'
import { source } from '../data/source'
import type { CandidateDetail } from '../data/types'
import { findCutoff, isToday as isTodayCutoff } from '../lib/evidence'
import { assessmentKey, buildExport, INCLUDE_ALL, loadAssessment, toJson, toMarkdown, type ExportInclude } from '../lib/export'

type Format = 'markdown' | 'json' | 'print'

const INCLUDES: { key: keyof ExportInclude; word: string }[] = [
  { key: 'objections', word: 'Critical appraisal' },
  { key: 'mechanism', word: 'Mechanism chain with evidence' },
  { key: 'safety', word: 'Safety and before a trial' },
  { key: 'call', word: 'Your call and reasoning' },
  { key: 'sources', word: 'Sources ledger' },
  { key: 'note', word: 'Data note' },
]

export function Export({ banner }: { banner: string }) {
  const { query = '', candidate: candidateParam = '' } = useParams()
  const [params] = useSearchParams()
  const [c, setC] = useState<CandidateDetail | undefined | null>(undefined)
  const [format, setFormat] = useState<Format>('markdown')
  const [include, setInclude] = useState<ExportInclude>(INCLUDE_ALL)
  const [copied, setCopied] = useState<'doc' | 'link' | null>(null)

  useEffect(() => {
    source.candidate(query, candidateParam).then((x) => setC(x ?? null))
  }, [query, candidateParam])

  const cutoff = c ? findCutoff(c, params.get('asof')) : undefined
  const doc = useMemo(() => {
    if (!c || !cutoff) return undefined
    const a = loadAssessment(assessmentKey(query, c.slug, cutoff.id))
    return buildExport(c, cutoff, a, banner, include)
  }, [c, cutoff, include, query, banner])

  if (c === undefined) return <Shell banner={banner} />
  if (c === null || !cutoff || !doc) {
    return (
      <Shell banner={banner}>
        <p>
          No appraisal at this address. <Link to="/">Start again</Link>.
        </p>
      </Shell>
    )
  }

  const detailHref = `/q/${query}/${candidateParam}${isTodayCutoff(c, cutoff) ? '' : `?asof=${cutoff.id}`}`
  const fileBase = `elute-${c.slug}-${cutoff.id}`

  const download = () => {
    if (format === 'print') {
      window.print()
      return
    }
    const text = format === 'markdown' ? toMarkdown(doc) : toJson(doc)
    const blob = new Blob([text], { type: format === 'markdown' ? 'text/markdown' : 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${fileBase}.${format === 'markdown' ? 'md' : 'json'}`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const copy = async (what: 'doc' | 'link') => {
    try {
      await navigator.clipboard.writeText(what === 'doc' ? (format === 'json' ? toJson(doc) : toMarkdown(doc)) : `${location.origin}${detailHref}`)
      setCopied(what)
      setTimeout(() => setCopied(null), 1600)
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <Shell banner={banner}>
      <div className="export">
        <aside className="export__side no-print fade">
          <div className="title__main">
            <Kicker>
              <Link to={detailHref}>← {c.name} for {c.condition}</Link>
            </Kicker>
            <h1 className="display-sm">export appraisal</h1>
          </div>

          <div className="export__group">
            <Kicker>format</Kicker>
            <div className="export__formats" role="radiogroup" aria-label="Format">
              {(
                [
                  ['markdown', 'Markdown'],
                  ['json', 'JSON'],
                  ['print', 'PDF (print)'],
                ] as [Format, string][]
              ).map(([id, word]) => (
                <button key={id} type="button" role="radio" className="choice" aria-checked={format === id} onClick={() => setFormat(id)}>
                  {word}
                </button>
              ))}
            </div>
          </div>

          <div className="export__group">
            <Kicker>include</Kicker>
            <div className="panel">
              {INCLUDES.map((i) => (
                <button key={i.key} type="button" role="checkbox" className="check" aria-checked={include[i.key]} onClick={() => setInclude({ ...include, [i.key]: !include[i.key] })}>
                  <span className="check__box" aria-hidden="true" />
                  <span className={i.key === 'note' ? 'muted' : ''}>{i.word}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="export__actions">
            <button type="button" className="btn btn--primary btn--lg" onClick={download}>
              {format === 'print' ? 'Print' : format === 'markdown' ? 'Download .md' : 'Download .json'}
            </button>
            <button type="button" className="btn btn--secondary btn--lg" onClick={() => copy('doc')}>
              {copied === 'doc' ? 'Copied' : 'Copy'}
            </button>
            <button type="button" className="btn btn--secondary btn--lg" onClick={() => copy('link')}>
              {copied === 'link' ? 'Copied' : 'Copy link'}
            </button>
          </div>
        </aside>

        <div className="fade" style={{ '--i': 1 } as React.CSSProperties}>
          <Kicker>preview</Kicker>
          <div className="panel preview" style={{ marginTop: 8 }}>
            <div>
              <h2 className="display-xs">{doc.title}</h2>
              <p className="preview__meta">{doc.meta}</p>
            </div>
            {doc.call && (
              <div className="preview__call">
                <Kicker>your call</Kicker>
                <p className="medium">{doc.call.choice}</p>
                <p className="cell__sub">{doc.call.line || 'Reasoning is added on the Detail page'}</p>
              </div>
            )}
            {/* Every included line is rendered: the preview is the print document. */}
            {doc.sections
              .filter((s) => s.key !== 'call')
              .map((s, i) => (
                <div className="preview__section" key={s.heading + i}>
                  <Kicker>{s.heading}</Kicker>
                  {s.lines.map((l, j) => (
                    <p key={j}>{l}</p>
                  ))}
                </div>
              ))}
            <p className="preview__foot">
              {doc.sourceCount} source lines · fixture data · not a medical device{doc.dataNote ? ` · ${doc.dataNote}` : ''}
            </p>
          </div>
        </div>
      </div>
    </Shell>
  )
}

function Shell({ banner, children }: { banner: string; children?: React.ReactNode }) {
  return (
    <main className="page">
      <Header />
      <div className="col">{children}</div>
      <DataNote text={banner} />
    </main>
  )
}
