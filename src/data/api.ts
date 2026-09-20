/* elute — ApiSource: the DataSource seam over the backend (docs/BACKEND_PLAN.md v4.4 §15).
 * A pair query is one appraisal: query() creates it and returns a ten-row scaffold carrying the backend's time
 * estimate; run() yields every event of the /events stream (question, progress, settled) and fills the rows in
 * place; results() and candidate() read /detail. When the backend cannot be reached and this browser remembers a
 * finished run of the slug, that run is served instead (src/lib/runlog.ts). Switched on by VITE_ELUTE_API. */

import type { CandidateDetail, CandidateSlug, EntityIndex, LedgerEvent, LedgerNote, LedgerRow, Provenance, QueryRecord, QuerySlug, ResultsPage, RunEstimate } from './types'
import type { DataSource } from './source'
import { entities, provenance } from '../fixtures'
import { recallPair } from '../lib/pair'
import { loadRunLog } from '../lib/runlog'

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

type Detail = { candidate: CandidateDetail; query: QueryRecord }
type Run = { id: string; status: string; record: QueryRecord; done: boolean; remembered?: Detail; notes: Record<string, LedgerNote[]> }

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

function scaffold(slug: QuerySlug, drug: string, condition: string, id: string, estimate?: RunEstimate): QueryRecord {
  return {
    slug,
    kind: 'pair',
    heading: `${drug} for ${condition}`,
    resolved: 'resolving via Open Targets…',
    ledger: {
      kind: 'recorded',
      estimate,
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

type Created = { id: string; status: string; estimate?: RunEstimate }

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
   *  the slug (its id is kept in sessionStorage); a run this browser remembers is served when the backend has
   *  forgotten it or cannot be reached; only a slug with neither posts a new one. */
  private async create(slug: QuerySlug): Promise<QueryRecord | undefined> {
    const [drugSlug, ...rest] = slug.split('--')
    if (!rest.length) return undefined // Phase 1: pair queries only
    // The names as typed on Entry when this session has them; otherwise the slug, de-hyphenated
    const { drug, disease } = recallPair(slug) ?? { drug: deslug(drugSlug), disease: deslug(rest.join('--')) }
    let created = await this.adopt(slug)
    if (!created) {
      const log = loadRunLog(slug)
      if (log?.candidate) {
        const run: Run = { id: log.id ?? '', status: 'remembered', record: log.record, done: true, remembered: { candidate: log.candidate, query: log.record }, notes: {} }
        this.runs.set(slug, run)
        return run.record
      }
      created = await this.json<Created>('/appraisals', { method: 'POST', body: JSON.stringify({ drug, disease }) })
      if (!created) return undefined
      rememberRun(slug, created.id)
    }
    const run: Run = { id: created.id, status: created.status, record: scaffold(slug, drug, disease, created.id, created.estimate), done: created.status !== 'running', notes: {} }
    this.runs.set(slug, run)
    if (run.done) await this.hydrate(run)
    return run.record
  }

  /** The run this session already started for the slug, if the server still has it and it did not fail. */
  private async adopt(slug: QuerySlug): Promise<Created | undefined> {
    const id = recallRun(slug)
    if (!id) return undefined
    const r = await this.json<Created>(`/appraisals/${id}`).catch(() => undefined)
    if (!r || r.status === 'failed') {
      forgetRun(slug)
      return undefined
    }
    return r
  }

  private async detail(run: Run): Promise<Detail | undefined> {
    if (run.remembered) return run.remembered
    try {
      const d = await this.json<Detail>(`/appraisals/${run.id}/detail`)
      if (d) return d
    } catch (e) {
      console.warn('[elute] detail unavailable, using what this browser remembers', e)
    }
    const log = loadRunLog(run.record.slug)
    return log?.candidate ? { candidate: log.candidate, query: log.record } : undefined
  }

  /** After completion, replace the scaffold's rows with the server's full ledger (records, timings, reasoning),
   *  keeping what each step said while it ran. */
  private async hydrate(run: Run): Promise<void> {
    const d = await this.detail(run)
    if (!d) return
    run.record.ledger.kind = d.query.ledger.kind
    run.record.ledger.recorded_total_ms = d.query.ledger.recorded_total_ms
    d.query.ledger.rows.forEach((row, i) => (run.record.ledger.rows[i] = { ...row, notes: run.notes[row.id] ?? run.record.ledger.rows[i]?.notes ?? [] }))
    run.record.resolved = d.query.resolved
    run.record.heading = d.query.heading
  }

  hasRun(slug: QuerySlug): boolean {
    return this.runs.get(slug)?.done ?? false
  }

  forget(slug: QuerySlug): void {
    this.runs.delete(slug)
    forgetRun(slug)
  }

  async *run(slug: QuerySlug): AsyncIterable<LedgerEvent> {
    const run = this.runs.get(slug)
    if (!run) return
    if (run.done) {
      for (const [i, row] of run.record.ledger.rows.entries()) yield { phase: 'settled', step: row.id, row, done: i === 9 }
      return
    }
    const queue: LedgerEvent[] = []
    let notify: (() => void) | null = null
    let finished = false
    const es = new EventSource(`${this.base}/appraisals/${run.id}/events`)
    es.addEventListener('ledger', (ev) => {
      const data = JSON.parse((ev as MessageEvent).data) as {
        step: string
        phase: 'question' | 'progress' | 'settled'
        row?: LedgerRow
        note?: string
        at_ms?: number
        done: boolean
        entry?: { question?: string; reasoning?: LedgerRow['reasoning'] }
      }
      if (data.phase === 'progress') {
        if (data.note) (run.notes[data.step] ??= []).push({ at_ms: data.at_ms ?? 0, note: data.note })
        queue.push({ phase: 'progress', step: data.step, note: data.note, at_ms: data.at_ms, done: false })
      } else if (data.phase === 'question') {
        queue.push({ phase: 'question', step: data.step, reasoning: data.entry?.reasoning, at_ms: data.at_ms, done: false })
      } else if (data.phase === 'settled' && data.row) {
        const i = STEPS.findIndex(([id]) => id === data.step)
        const row: LedgerRow = { ...data.row, notes: run.notes[data.step] ?? [] }
        if (i >= 0) run.record.ledger.rows[i] = row
        queue.push({ phase: 'settled', step: data.step, row, at_ms: data.at_ms, done: data.done })
        if (data.done) finished = true
      } else return
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
    const d = await this.detail(run)
    if (!d) return undefined
    const today = d.candidate.cutoffs[d.candidate.cutoffs.length - 1].date
    return { query: run.record, today, candidates: [d.candidate] }
  }

  async candidate(query: QuerySlug, candidate: CandidateSlug): Promise<CandidateDetail | undefined> {
    const run = this.runs.get(query) ?? (await this.query(query), this.runs.get(query))
    if (!run) return undefined
    const d = await this.detail(run)
    if (!d) return undefined
    return d.candidate.drug_slug === candidate || d.candidate.slug === candidate ? d.candidate : undefined
  }

  async provenance(): Promise<Provenance> {
    return provenance
  }
}
