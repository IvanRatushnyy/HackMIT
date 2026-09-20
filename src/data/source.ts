/* elute — the data source seam (spec §6).
 * Screens talk to this interface only. FixtureSource replays bundled JSON;
 * an ApiSource would implement the same shape over HTTP/SSE. */

import type {
  CandidateDetail,
  CandidateSlug,
  EntityIndex,
  Ledger,
  LedgerEvent,
  Provenance,
  QueryRecord,
  QuerySlug,
  ResultsPage,
} from './types'
import { candidates, entities, provenance, queries, TODAY } from '../fixtures'
import { orderCandidates, validateCandidate } from '../lib/evidence'

export interface DataSource {
  mode: 'fixture' | 'live'
  entities(): Promise<EntityIndex>
  query(slug: QuerySlug): Promise<QueryRecord | undefined>
  run(slug: QuerySlug): AsyncIterable<LedgerEvent>
  hasRun(slug: QuerySlug): boolean
  results(slug: QuerySlug): Promise<ResultsPage | undefined>
  candidate(query: QuerySlug, candidate: CandidateSlug): Promise<CandidateDetail | undefined>
  provenance(): Promise<Provenance>
}

const REPLAY_TOTAL_MS = 12_000

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Playback duration per row. Scripted: even spacing. Recorded: elapsed_ms scaled by one constant. */
export function rowDurations(ledger: Ledger): number[] {
  const rows = ledger.rows
  const recorded = ledger.kind === 'recorded' && rows.every((r) => r.elapsed_ms !== undefined)
  const total = recorded ? rows.reduce((s, r) => s + (r.elapsed_ms ?? 0), 0) : rows.length
  return rows.map((r) => Math.max(200, (recorded ? (r.elapsed_ms ?? 0) / total : 1 / total) * REPLAY_TOTAL_MS))
}

export class FixtureSource implements DataSource {
  mode = 'fixture' as const
  private completed = new Set<QuerySlug>()
  private publishable: CandidateDetail[]

  constructor() {
    // Publishability gate (spec §7.5): an incomplete candidate is absent, never thin.
    this.publishable = candidates.filter((c) => {
      const problems = validateCandidate(c)
      if (problems.length) console.warn(`[elute] ${c.slug} is not publishable:\n  ${problems.join('\n  ')}`)
      return problems.length === 0
    })
  }

  async entities(): Promise<EntityIndex> {
    return { entities }
  }

  async query(slug: QuerySlug): Promise<QueryRecord | undefined> {
    return queries.find((q) => q.slug === slug)
  }

  hasRun(slug: QuerySlug): boolean {
    return this.completed.has(slug)
  }

  async *run(slug: QuerySlug): AsyncIterable<LedgerEvent> {
    const q = queries.find((x) => x.slug === slug)
    if (!q) return
    const rows = q.ledger.rows
    const durations = rowDurations(q.ledger)
    for (let i = 0; i < rows.length; i++) {
      await sleep(durations[i])
      yield { row: rows[i], done: i === rows.length - 1 }
    }
    this.completed.add(slug)
  }

  async results(slug: QuerySlug): Promise<ResultsPage | undefined> {
    const q = queries.find((x) => x.slug === slug)
    if (!q) return undefined
    const list = q.candidates
      .map((s) => this.publishable.find((c) => c.slug === s))
      .filter((c): c is CandidateDetail => !!c)
    return { query: q, today: TODAY, candidates: orderCandidates(list) }
  }

  /** `candidate` is the other side's slug: the drug for a condition query, the condition for a drug query. */
  async candidate(query: QuerySlug, candidate: CandidateSlug): Promise<CandidateDetail | undefined> {
    const q = queries.find((x) => x.slug === query)
    if (!q) return undefined
    return this.publishable.find(
      (c) =>
        q.candidates.includes(c.slug) &&
        ((q.kind === 'condition' && c.drug_slug === candidate) ||
          (q.kind === 'drug' && c.condition_slug === candidate) ||
          (q.kind === 'pair' && c.drug_slug === candidate)),
    )
  }

  async provenance(): Promise<Provenance> {
    return provenance
  }
}

const apiBase = (import.meta.env.VITE_ELUTE_API as string | undefined)?.replace(/\/$/, '')

/** VITE_ELUTE_API=http://localhost:8000/api switches the seam to the backend; unset, the bundle stays fixture-only. */
export const source: DataSource = apiBase ? new (await import('./api')).ApiSource(apiBase) : new FixtureSource()
