/* elute — ApiSource: the DataSource seam over the backend (docs/BACKEND_PLAN.md v4.4 §15).
 * A pair query is one appraisal: query() creates it and returns a ten-row scaffold; run() fills the rows in place from
 * the /events stream; results() and candidate() read /detail. Switched on by VITE_ELUTE_API. */

import type { CandidateDetail, CandidateSlug, EntityIndex, LedgerEvent, LedgerRow, Provenance, QueryRecord, QuerySlug, ResultsPage } from './types'
import type { DataSource } from './source'
import { entities, provenance } from '../fixtures'
import { recallPair } from '../lib/pair'

const STEPS: [string, string][] = [
  ['L1', 'Resolve the query'],
  ['L2', 'Target and disease biology'],
  ['L3', 'Registered trials, blinding and n extracted'],
  ['L4', 'Literature, study design classified'],
  ['L5', 'Normalize to evidence'],
  ['L6', 'Historical visibility audit'],
  ['L7', 'Claims and mechanism'],
  ['L8', 'Statuses, weakest link, stance'],
  ['L9', 'Case for, case against, opinion'],
  ['L10', 'Next question'],
]

type Run = { id: string; status: string; record: QueryRecord; done: boolean; asOf?: string }

const RUN_KEY = (slug: string) => `elute:run:${slug}`
const rememberRun = (slug: string, id: string) => {
  try {
    sessionStorage.setItem(RUN_KEY(slug), id)
  } catch {
    /* storage unavailable: the in-memory map still dedupes within the page */
  }
}
const recallRun = (slug: string): string | undefined => {
  try {
    return sessionStorage.getItem(RUN_KEY(slug)) ?? undefined
  } catch {
    return undefined
  }
}
const forgetRun = (slug: string) => {
  try {
    sessionStorage.removeItem(RUN_KEY(slug))
  } catch {
    /* nothing to forget */
  }
}

function deslug(s: string): string {
  return s.replace(/-/g, ' ')
}

function scaffold(slug: QuerySlug, drug: string, condition: string, id: string): QueryRecord {
  return {
    slug,
    kind: 'pair',
    heading: `${drug} for ${condition}`,
    resolved: 'resolving via Open Targets…',
    ledger: {
      kind: 'recorded',
      rows: STEPS.map(([rid, step]) => ({
        id: rid,
        step,
        source: 'queued',
        unit: 'records',
        execution: { tool: '', query: '', run_at: '', verified: { by: 'automated' } },
        records: [],
      })),
    },
    candidates: [slug],
    pair: { candidate: slug.split('--')[0], condition: slug.split('--').slice(1).join('--') },
    // @ts-expect-error extra field carried for the Sources page's run identifier
    appraisal_id: id,
  }
}

export class ApiSource implements DataSource {
  mode = 'live' as const
  private runs = new Map<QuerySlug, Run>()
  private creating = new Map<QuerySlug, Promise<QueryRecord | undefined>>() // one POST per slug even when two screens ask at once

  constructor(private base: string) {}

  private async json<T>(path: string, init?: RequestInit): Promise<T | undefined> {
    const r = await fetch(`${this.base}${path}`, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } })
    if (r.status === 404) return undefined
    if (!r.ok) throw new Error(`${path}: ${r.status}`)
    return (await r.json()) as T
  }

  async entities(): Promise<EntityIndex> {
    return { entities }
  }

  async query(slug: QuerySlug): Promise<QueryRecord | undefined> {
    const existing = this.runs.get(slug)
    if (existing) return existing.record
    const pending = this.creating.get(slug)
    if (pending) return pending
    const p = this.create(slug).finally(() => this.creating.delete(slug))
    this.creating.set(slug, p)
    return p
  }

  /** One appraisal per ask: a remount, the Detail page or a reload adopts the run this session already started for
   *  the slug (its id is kept in sessionStorage); only a slug with no live run posts a new one. */
  private async create(slug: QuerySlug): Promise<QueryRecord | undefined> {
    const [drugSlug, ...rest] = slug.split('--')
    if (!rest.length) return undefined // Phase 1: pair queries only
    // The names as typed on Entry when this session has them; otherwise the slug, de-hyphenated
    const { drug, disease } = recallPair(slug) ?? { drug: deslug(drugSlug), disease: deslug(rest.join('--')) }
    let created = await this.adopt(slug)
    if (!created) {
      created = await this.json<{ id: string; status: string }>('/appraisals', { method: 'POST', body: JSON.stringify({ drug, disease }) })
      if (!created) return undefined
      rememberRun(slug, created.id)
    }
    const run: Run = { id: created.id, status: created.status, record: scaffold(slug, drug, disease, created.id), done: created.status !== 'running' }
    this.runs.set(slug, run)
    if (run.done) await this.hydrate(run)
    return run.record
  }

  /** The run this session already started for the slug, if the server still has it and it did not fail. */
  private async adopt(slug: QuerySlug): Promise<{ id: string; status: string } | undefined> {
    const id = recallRun(slug)
    if (!id) return undefined
    const r = await this.json<{ id: string; status: string }>(`/appraisals/${id}`).catch(() => undefined)
    if (!r || r.status === 'failed') {
      forgetRun(slug)
      return undefined
    }
    return r
  }

  /** After completion, replace the scaffold's rows with the server's full ledger (records, timings, reasoning). */
  private async hydrate(run: Run): Promise<void> {
    const d = await this.json<{ candidate: CandidateDetail; query: QueryRecord }>(`/appraisals/${run.id}/detail`)
    if (!d) return
    run.record.ledger.kind = d.query.ledger.kind
    run.record.ledger.recorded_total_ms = d.query.ledger.recorded_total_ms
    d.query.ledger.rows.forEach((row, i) => (run.record.ledger.rows[i] = row))
    run.record.resolved = d.query.resolved
    run.record.heading = d.query.heading
  }

  hasRun(slug: QuerySlug): boolean {
    return this.runs.get(slug)?.done ?? false
  }

  async *run(slug: QuerySlug): AsyncIterable<LedgerEvent> {
    const run = this.runs.get(slug)
    if (!run) return
    if (run.done) {
      for (const [i, row] of run.record.ledger.rows.entries()) yield { row, done: i === 9 }
      return
    }
    const queue: LedgerEvent[] = []
    let notify: (() => void) | null = null
    let finished = false
    const es = new EventSource(`${this.base}/appraisals/${run.id}/events`)
    es.addEventListener('ledger', (ev) => {
      const data = JSON.parse((ev as MessageEvent).data) as { step: string; phase: string; row?: LedgerRow; done: boolean }
      if (data.phase !== 'settled' || !data.row) return
      const i = STEPS.findIndex(([id]) => id === data.step)
      if (i >= 0) run.record.ledger.rows[i] = data.row
      queue.push({ row: data.row, done: data.done })
      if (data.done) finished = true
      notify?.()
    })
    es.addEventListener('error', () => {
      finished = true
      notify?.()
    })
    try {
      while (!finished || queue.length) {
        if (!queue.length) await new Promise<void>((r) => (notify = r))
        while (queue.length) yield queue.shift()!
      }
    } finally {
      es.close()
      run.done = true
      await this.hydrate(run)
    }
  }

  async results(slug: QuerySlug): Promise<ResultsPage | undefined> {
    const run = this.runs.get(slug)
    if (!run) return undefined
    const d = await this.json<{ candidate: CandidateDetail; query: QueryRecord }>(`/appraisals/${run.id}/detail`)
    if (!d) return undefined
    const today = d.candidate.cutoffs[d.candidate.cutoffs.length - 1].date
    return { query: run.record, today, candidates: [d.candidate] }
  }

  async candidate(query: QuerySlug, candidate: CandidateSlug): Promise<CandidateDetail | undefined> {
    const run = this.runs.get(query) ?? (await this.query(query), this.runs.get(query))
    if (!run) return undefined
    const d = await this.json<{ candidate: CandidateDetail; query: QueryRecord }>(`/appraisals/${run.id}/detail`)
    if (!d) return undefined
    return d.candidate.drug_slug === candidate || d.candidate.slug === candidate ? d.candidate : undefined
  }

  async provenance(): Promise<Provenance> {
    return provenance
  }
}
