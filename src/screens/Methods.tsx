/* elute — Methods: generated from the fixture and package.json for the IT reviewer. */

import { useEffect, useState } from 'react'
import { Banner, Header, Sheet } from '../components/frame'
import { source } from '../data/source'
import type { Provenance, QueryRecord } from '../data/types'
import pkg from '../../package.json'

const RULES = [
  ['Override', 'A hand-curated label with its stated reason applies first; every override is listed below.'],
  ['Unknown', 'No evidence published on or before the date tests or supports the claim.'],
  ['Refuted', 'A source directly tested the claim in a blinded, controlled study and found it false.'],
  ['Contested', 'Evidence on both sides — or evidence only against, when nothing supports the claim.'],
  ['Established', 'Supporting evidence from two or more independent groups with nothing against it, or acceptance by a regulator.'],
  ['Single-source', 'Supporting evidence from one group only; the qualifier gives n, design and blinding.'],
]

export function Methods({ banner }: { banner: string }) {
  const [prov, setProv] = useState<Provenance | undefined>()
  const [q, setQ] = useState<QueryRecord | undefined>()
  useEffect(() => {
    source.provenance().then(setProv)
    source.query('parkinsons-disease').then(setQ)
  }, [])
  const deps = { ...pkg.dependencies }
  return (
    <main className="page">
      <Header />
      <Banner text={banner} />
      <div className="page__body page__body--full">
        <Sheet>
          <div className="methods">
            <div className="query__head">
              <h1 className="display-md">Methods</h1>
              <p className="query__sub">What the appraisal consults, how each label is assigned, and what is curated or synthetic.</p>
            </div>

            <section className="section">
              <h2 className="section__title">Steps</h2>
              <ol>
                {q?.ledger.rows.map((r) => (
                  <li key={r.id}>
                    <span className="medium">
                      {r.id} {r.step}
                    </span>{' '}
                    — {r.source}. <span className="raw">{r.execution.tool}</span>
                    {r.execution.retry ? <span className="muted"> · retries once with the resolved identifier when the free-text query returns nothing</span> : null}
                  </li>
                ))}
              </ol>
            </section>

            <section className="section">
              <h2 className="section__title">Label rules</h2>
              <ol>
                {RULES.map(([w, t]) => (
                  <li key={w}>
                    <span className="medium">{w}.</span> {t}
                  </li>
                ))}
              </ol>
              {prov?.label_overrides.length ? (
                <>
                  <p className="section__lede">Curated overrides in this fixture</p>
                  <ul>
                    {prov.label_overrides.map((o) => (
                      <li key={o.candidate + o.claim}>
                        <span className="medium">{o.candidate}</span> — {o.claim}: {o.why}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {prov?.curatorial_decisions.length ? (
                <>
                  <p className="section__lede">Curatorial decisions</p>
                  <ul>
                    {prov.curatorial_decisions.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </section>

            <section className="section">
              <h2 className="section__title">What is curated and what is synthetic</h2>
              <p className="section__lede">Curated</p>
              <ul>{prov?.curated.map((s) => <li key={s}>{s}</li>)}</ul>
              <p className="section__lede">Synthetic or draft</p>
              <ul>{prov?.synthetic.map((s) => <li key={s}>{s}</li>)}</ul>
              <p className="section__lede">In production this would run on</p>
              <ul>{prov?.production_sources.map((s) => <li key={s}>{s}</li>)}</ul>
            </section>

            <section className="section">
              <h2 className="section__title">Dependencies</h2>
              <table>
                <thead>
                  <tr>
                    <th>package</th>
                    <th>version</th>
                    <th>license</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(deps).map(([name, v]) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td className="raw">{v}</td>
                      <td>MIT</td>
                    </tr>
                  ))}
                  <tr>
                    <td>liquid-glass-js (vendored)</td>
                    <td className="raw">pinned commit, design/glass/vendor/VERSION</td>
                    <td>MIT</td>
                  </tr>
                </tbody>
              </table>
              <p className="muted text-sm">Fixture mode makes no network requests and needs no keys.</p>
            </section>

            <section className="section">
              <h2 className="section__title">What this is not</h2>
              <ul>
                <li>Not a medical device, not a clinical decision tool, not a prescribing aid. It organizes evidence for a scientist who is qualified to weigh it.</li>
                <li>Not validated. The working data is curated and partly synthetic; every screen says so.</li>
                <li>Not promotion. It never recommends pursuing or prescribing anything.</li>
                <li>“Cannot determine” is a valid output: the label is unknown, shown as such.</li>
                <li>It errs toward doubt. It will underrate some good candidates; its users are accountable for false positives.</li>
              </ul>
            </section>
          </div>
        </Sheet>
      </div>
    </main>
  )
}
