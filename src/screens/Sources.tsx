/* elute — Sources: the run's ledger with its records, the tool calls, the packages, and the status rules.
 * This is the provenance surface for the scientist and the IT reviewer. */

import { useEffect, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { Header, Kicker } from '../components/frame'
import { ProvenanceBlock } from '../components/Ledger'
import { source } from '../data/source'
import type { CandidateDetail, Cutoff, Provenance, QueryRecord } from '../data/types'
import { findCutoff, ledgerResult } from '../lib/evidence'
import pkg from '../../package.json'

const RULES = [
  ['Override', 'A hand-curated label with its stated reason applies first; every override is listed below.'],
  ['Unknown', 'No evidence published on or before the date tests or supports the claim.'],
  ['Refuted', 'A source directly tested the claim in a blinded, controlled study and found it false.'],
  ['Contested', 'Evidence on both sides — or evidence only against, when nothing supports the claim.'],
  ['Established', 'Supporting evidence from two or more independent groups with nothing against it, or acceptance by a regulator.'],
  ['Single-source', 'Supporting evidence from one group only; the qualifier gives n, design and blinding.'],
]

type Tab = 'ledger' | 'tools' | 'packages' | 'rules'

export function Sources() {
  const { query = 'parkinsons-disease' } = useParams()
  const location = useLocation()
  const [params] = useSearchParams()
  const [q, setQ] = useState<QueryRecord | undefined>()
  const [prov, setProv] = useState<Provenance | undefined>()
  const [tab, setTab] = useState<Tab>('ledger')
  // A citation from a historical Detail carries ?asof=<cutoff>&c=<candidate>; the page then filters to that date.
  const [frozen, setFrozen] = useState<{ candidate: CandidateDetail; cutoff: Cutoff } | undefined>()

  useEffect(() => {
    source.query(query).then(setQ)
    source.provenance().then(setProv)
    const asof = params.get('asof')
    const cand = params.get('c')
    if (asof && cand) {
      source.candidate(query, cand).then((c) => {
        if (!c) return
        const cutoff = findCutoff(c, asof)
        setFrozen(cutoff.id === asof ? { candidate: c, cutoff } : undefined)
      })
    } else setFrozen(undefined)
  }, [query, params])

  // A citation link like #L7 lands on its row
  useEffect(() => {
    if (!q || !location.hash) return
    const el = document.getElementById(location.hash.slice(1))
    el?.scrollIntoView({ block: 'center' })
  }, [q, location.hash])

  const today = frozen ? frozen.cutoff.date : (prov?.today ?? '2026-09-19')
  const isToday = !frozen
  const runAt = q?.ledger.rows[0]?.execution.run_at
  const records = q?.ledger.rows.reduce((n, r) => n + r.records.filter((x) => x.published <= today).length, 0) ?? 0
  const recorded = q?.ledger.kind === 'recorded'

  return (
    <main className="page">
      <Header />
      <div className="col">
        <div className="title arrive">
          <div className="title__main">
            <Kicker>run · {runAt ? runAt.replace('T', ' ').slice(0, 16) : ''}</Kicker>
            <h1 className="display-sm">sources</h1>
            {q && (
              <p className="title__sub">
                <Link to={`/q/${q.slug}`}>{q.heading}</Link> → {q.kind === 'drug' ? 'indications' : q.kind === 'pair' ? 'appraisal' : 'candidates'} · {q.ledger.rows.length} steps ·{' '}
                {records} records · {recorded ? 'recorded run' : 'scripted sequence, not a live run'}
              </p>
            )}
            {frozen && (
              <p className="detail__frozen">
                {frozen.cutoff.note} Records after this date are not shown.{' '}
                <Link to={`/q/${query}/${params.get('c')}?asof=${frozen.cutoff.id}`}>← back to the appraisal</Link>
              </p>
            )}
          </div>
          <div className="title__aside">
            <div className="seg" role="tablist" aria-label="Sources view">
              {(
                [
                  ['ledger', 'Ledger'],
                  ['tools', 'Tool calls'],
                  ['packages', 'Packages'],
                  ['rules', 'Status rules'],
                ] as [Tab, string][]
              ).map(([id, word]) => (
                <button key={id} type="button" role="tab" className="seg__item" aria-selected={tab === id} onClick={() => setTab(id)}>
                  {word}
                </button>
              ))}
            </div>
          </div>
        </div>

        {q && tab === 'ledger' && (
          <div className="arrive" style={{ '--i': 1 } as React.CSSProperties} key="ledger">
            <div className="thead sources__head">
              <span className="kicker">line</span>
              <span className="kicker">step</span>
              <span className="kicker">source</span>
              <span className="kicker">retrieved</span>
              <span className="kicker" style={{ textAlign: 'right' }}>
                time
              </span>
              <span />
            </div>
            <div className="panel">
              {q.ledger.rows.map((row, i) => (
                <div key={row.id} id={row.id}>
                  <div className="panel__row sources__row">
                    <span className="sources__line">{i + 1}.1</span>
                    <span className="sources__step">{row.step}</span>
                    <span>{row.source}</span>
                    <span>
                      {ledgerResult(row, today)}
                      {row.execution.retry ? ` · ${row.execution.retry.reason}, retried` : ''}
                    </span>
                    <span className="sources__time">{recorded && row.elapsed_ms !== undefined ? `${(row.elapsed_ms / 1000).toFixed(1)} s` : '–'}</span>
                    <span />
                  </div>
                  {row.records
                    .filter((r) => r.published <= today)
                    .map((r, j) => (
                      <div className="panel__row sources__row sources__row--record" key={j} style={{ minHeight: 40 }}>
                        <span className="sources__line">
                          {i + 1}.{j + 2}
                        </span>
                        <span className="sources__step">{r.value.split(' · ')[0]}</span>
                        <span>{row.source.split(' · ')[0]}</span>
                        <span>{r.value.split(' · ').slice(1).join(' · ') || r.value}</span>
                        <span className="sources__time">{r.published.slice(0, 4)}</span>
                        <span className="sources__open">{r.source && <SourceOpen q={q} id={r.source} />}</span>
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {q && tab === 'tools' && (
          <div className="toolcalls arrive" key="tools">
            {q.ledger.rows.map((row) => (
              <div key={row.id} className="section">
                <Kicker>
                  {row.id} · {row.step}
                </Kicker>
                <ProvenanceBlock row={row} cutoff={today} isToday={isToday} />
              </div>
            ))}
          </div>
        )}

        {tab === 'packages' && (
          <div className="arrive" key="packages">
            <div className="panel">
              <table className="deps">
                <thead>
                  <tr>
                    <th>package</th>
                    <th>version</th>
                    <th>license</th>
                    <th>role</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(pkg.dependencies).map(([name, v]) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td className="raw">{v}</td>
                      <td>MIT</td>
                      <td className="muted">{ROLE[name] ?? ''}</td>
                    </tr>
                  ))}
                  <tr>
                    <td>liquid-glass-js (vendored)</td>
                    <td className="raw">design/glass/vendor/VERSION</td>
                    <td>MIT</td>
                    <td className="muted">not loaded in v1</td>
                  </tr>
                </tbody>
              </table>
              <p className="panel__row muted text-sm" style={{ minHeight: 48 }}>
                Fixture mode makes no network requests and needs no keys. In production the ledger steps would call the sources listed under Status rules.
              </p>
            </div>
          </div>
        )}

        {prov && tab === 'rules' && (
          <div className="rules arrive" key="rules">
            <div className="section">
              <Kicker>label rules, in order</Kicker>
              <ol>
                {RULES.map(([w, t]) => (
                  <li key={w}>
                    <span className="medium">{w}.</span> {t}
                  </li>
                ))}
              </ol>
            </div>
            {prov.label_overrides.length > 0 && (
              <div className="section">
                <Kicker>curated overrides in this fixture</Kicker>
                <ul>
                  {prov.label_overrides.map((o) => (
                    <li key={o.candidate + o.claim}>
                      <span className="medium">{o.candidate}</span> — {o.claim}: {o.why}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="section">
              <Kicker>curatorial decisions</Kicker>
              <ul>
                {prov.curatorial_decisions.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
            <div className="section">
              <Kicker>curated</Kicker>
              <ul>
                {prov.curated.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
              <Kicker>synthetic or draft</Kicker>
              <ul>
                {prov.synthetic.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
              <Kicker>in production this would run on</Kicker>
              <ul>
                {prov.production_sources.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            <div className="section">
              <Kicker>what this is not</Kicker>
              <ul>
                <li>Not a medical device, not a clinical decision tool, not a prescribing aid. It organizes evidence for a scientist who is qualified to weigh it.</li>
                <li>Not validated. The working data is curated and partly synthetic; every screen says so.</li>
                <li>Not promotion. It never recommends pursuing or prescribing anything.</li>
                <li>“Cannot determine” is a valid output: the label is unknown, shown as such.</li>
                <li>It errs toward doubt. It will underrate some good candidates; its users are accountable for false positives.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

const ROLE: Record<string, string> = {
  react: 'UI',
  'react-dom': 'UI',
  'react-router-dom': 'routes',
  'html2canvas-pro': 'glass snapshot (unused in v1)',
}

function SourceOpen({ q, id }: { q: QueryRecord; id: string }) {
  const [url, setUrl] = useState<string | undefined>()
  useEffect(() => {
    let cancelled = false
    Promise.all(q.candidates.map((slug) => source.candidate(q.slug, slug.split('--')[q.kind === 'drug' ? 1 : 0]))).then((cands) => {
      if (cancelled) return
      for (const c of cands) {
        const s = c?.sources.find((x) => x.id === id)
        if (s) {
          setUrl(s.url)
          return
        }
      }
    })
    return () => {
      cancelled = true
    }
  }, [q, id])
  return url ? (
    <a href={url} target="_blank" rel="noreferrer">
      open
    </a>
  ) : null
}
