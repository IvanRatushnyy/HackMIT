/* elute — the session layer over the data seam: a recorded run replayed at demo pace, and the browser's memory of
 * every run so the research stage can be reopened without running again.
 *
 * A recording is what the backend writes to public/demo/<slug>.json when a live run completes (gitignored): the run's
 * events with their real offsets, the settled rows, and the adapted detail. When Entry's example chip asks for a
 * replay (live mode), or whenever a recording exists (fixture mode, where it replaces the scripted sequence), this
 * source plays the real events back compressed to about REPLAY_TARGET_MS, keeping every step's share of the time and
 * a floor per step so each one can be read. A slug asked for as the hard-coded example (`forget(slug, { scripted })`)
 * is served from the fixture's scripted sequence whatever the inner source is, so the demo never waits on the
 * backend. Everything else is delegated to the inner source. */

import type { CandidateDetail, CandidateSlug, EntityIndex, LedgerEvent, LedgerNote, LedgerRow, Provenance, QueryRecord, QuerySlug, ResultsPage, RunEstimate } from './types'
import type { DataSource } from './source'
import { validateCandidate } from '../lib/evidence'
import { clearRunLog, durationWord, isReplayMarked, isScriptedMarked, loadRunLog, markReplay, markScripted, saveRunLog, type RunLogKind } from '../lib/runlog'

export const REPLAY_TARGET_MS = 24_000
export const REPLAY_MIN_STEP_MS = 1_100
const STEPS = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10']

export type RecordedEvent = {
  seq: number
  step: string
  phase: 'question' | 'progress' | 'settled'
  at_ms: number
  done: boolean
  note?: string
  row?: LedgerRow
  reasoning?: LedgerRow['reasoning']
  question?: string
}

export type Recording = {
  version: number
  recorded_at: string
  run: { id: string; slug: string; drug: string; disease: string; as_of: string; status: string; elapsed_ms: number; llm: string; llm_client?: string; data_mode: string }
  estimate?: RunEstimate
  events: RecordedEvent[]
  detail: { candidate: CandidateDetail; query: QueryRecord }
}

/** The replay clock: each event's offset at demo pace, and each step's replay length. Pure, for the test. */
export function replaySchedule(events: RecordedEvent[], target = REPLAY_TARGET_MS, minStep = REPLAY_MIN_STEP_MS): { at: Map<number, number>; steps: Record<string, number>; total: number } {
  const settled = events.filter((e) => e.phase === 'settled')
  // real span of each step: from the previous step's settle (or 0) to its own settle
  const spans: { step: string; from: number; to: number }[] = []
  let prev = 0
  for (const e of settled) {
    spans.push({ step: e.step, from: prev, to: Math.max(prev, e.at_ms) })
    prev = Math.max(prev, e.at_ms)
  }
  const realTotal = Math.max(1, prev)
  const k = target / realTotal
  const steps: Record<string, number> = {}
  for (const s of spans) steps[s.step] = Math.max(minStep, (s.to - s.from) * k)
  // place every event inside its step's replay span, in proportion to where it fell in the real one
  const at = new Map<number, number>()
  let cursor = 0
  for (const s of spans) {
    const real = Math.max(1, s.to - s.from)
    const len = steps[s.step]
    for (const e of events) {
      if (e.step !== s.step) continue
      const frac = Math.min(1, Math.max(0, (e.at_ms - s.from) / real))
      at.set(e.seq, cursor + (e.phase === 'settled' ? len : frac * len))
    }
    cursor += len
  }
  return { at, steps, total: cursor }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** "a recorded run of 1 min 42 s real time, replayed 4× faster" — or, for a run the payload cache answered in no
 * time, stretched so each step can be read. */
export function replayBasis(realMs: number, replayMs: number): string {
  const ratio = realMs / Math.max(1, replayMs)
  const real = `a recorded run of ${durationWord(realMs)} real time`
  if (ratio >= 1.5) return `${real}, replayed ${Math.round(ratio)}× faster`
  if (ratio > 0.75) return `${real}, replayed at its own pace`
  return `${real}, stretched so each step can be read`
}

/** The recording's settled rows with everything each step said attached, so every page that reads the record (Sources,
 * a reload mid-replay) sees the run as it ended; only the Working page paces the reveal, by the events. */
function rowsWithNotes(rows: LedgerRow[], events: RecordedEvent[]): LedgerRow[] {
  const notes: Record<string, LedgerNote[]> = {}
  for (const e of events) if (e.phase === 'progress' && e.note) (notes[e.step] ??= []).push({ at_ms: e.at_ms, note: e.note })
  return rows.map((r) => ({ ...r, notes: notes[r.id] ?? [] }))
}

const recordings = new Map<QuerySlug, Promise<Recording | undefined>>()

/** public/demo/<slug>.json, fetched once per slug; absent (404) or unparsable → undefined. */
export function loadRecording(slug: QuerySlug): Promise<Recording | undefined> {
  let p = recordings.get(slug)
  if (!p) {
    p = fetch(`/demo/${slug}.json`, { headers: { accept: 'application/json' } })
      .then(async (r) => {
        if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) return undefined
        const doc = (await r.json()) as Recording
        if (!doc || doc.version !== 1 || !doc.detail?.candidate || !Array.isArray(doc.events)) return undefined
        const problems = validateCandidate(doc.detail.candidate)
        if (problems.length) {
          console.warn(`[elute] recording ${slug} is not publishable:\n  ${problems.join('\n  ')}`)
          return undefined
        }
        return doc
      })
      .catch(() => undefined)
    recordings.set(slug, p)
  }
  return p
}

type Replay = { recording: Recording; record: QueryRecord; done: boolean; notes: Record<string, LedgerNote[]> }

export class SessionSource implements DataSource {
  mode: 'fixture' | 'live'
  private replays = new Map<QuerySlug, Replay>()
  private remembered = new Map<QuerySlug, QueryRecord>() // records served from the run log this page load
  private scripted = new Set<QuerySlug>() // slugs asked for as the hard-coded example this page load

  /** `script` is where the hard-coded example is served from: the fixture, when `inner` is the backend. */
  constructor(private inner: DataSource, private script: DataSource = inner) {
    this.mode = inner.mode
  }

  private usesScript(slug: QuerySlug): boolean {
    return this.scripted.has(slug) || isScriptedMarked(slug)
  }

  /** The source a slug is served from: the fixture's script when asked for as the example, else the inner one. */
  private pick(slug: QuerySlug): DataSource {
    return this.usesScript(slug) ? this.script : this.inner
  }

  private wantsReplay(slug: QuerySlug): boolean {
    return !this.usesScript(slug) && (this.mode === 'fixture' || isReplayMarked(slug))
  }

  entities(): Promise<EntityIndex> {
    return this.inner.entities()
  }

  provenance(): Promise<Provenance> {
    return this.inner.provenance()
  }

  async query(slug: QuerySlug): Promise<QueryRecord | undefined> {
    const existing = this.replays.get(slug)
    if (existing) return existing.record
    const remembered = this.remembered.get(slug)
    if (remembered) return remembered
    // a finished run this browser remembers is shown as it settled, never run again
    const log = loadRunLog(slug)
    if (log) {
      this.remembered.set(slug, log.record)
      return log.record
    }
    if (this.wantsReplay(slug)) {
      const rec = await loadRecording(slug)
      if (rec) {
        const schedule = replaySchedule(rec.events)
        const q = rec.detail.query
        const record: QueryRecord = {
          ...q,
          slug, // the address as asked; the recording's own slug is the resolved pair
          ledger: {
            kind: 'recorded',
            recorded_total_ms: rec.run.elapsed_ms,
            estimate: { total_ms: schedule.total, steps: schedule.steps, basis: replayBasis(rec.run.elapsed_ms, schedule.total) },
            replay_of: { recorded_at: rec.recorded_at, elapsed_ms: rec.run.elapsed_ms, run_id: rec.run.id, llm: rec.run.llm, llm_client: rec.run.llm_client },
            rows: rowsWithNotes(q.ledger.rows, rec.events),
          },
        }
        this.replays.set(slug, { recording: rec, record, done: false, notes: {} })
        return record
      }
    }
    return this.pick(slug).query(slug)
  }

  hasRun(slug: QuerySlug): boolean {
    const replay = this.replays.get(slug)
    if (replay) return replay.done
    if (this.remembered.has(slug)) return true
    return this.pick(slug).hasRun(slug)
  }

  forget(slug: QuerySlug, opts?: { replay?: boolean; scripted?: boolean }): void {
    this.replays.delete(slug)
    this.remembered.delete(slug)
    clearRunLog(slug)
    markReplay(slug, !!opts?.replay)
    if (opts?.scripted) this.scripted.add(slug)
    else this.scripted.delete(slug)
    markScripted(slug, !!opts?.scripted)
    this.inner.forget(slug)
    if (this.script !== this.inner) this.script.forget(slug)
  }

  async *run(slug: QuerySlug): AsyncIterable<LedgerEvent> {
    const replay = this.replays.get(slug)
    if (!replay) {
      const src = this.pick(slug)
      const started = new Date().toISOString()
      const t0 = performance.now()
      for await (const ev of src.run(slug)) yield ev
      await this.remember(slug, src.mode === 'live' ? 'live' : 'scripted', started, performance.now() - t0)
      return
    }
    if (replay.done) {
      for (const [i, row] of replay.record.ledger.rows.entries()) yield { phase: 'settled', step: row.id, row, done: i === replay.record.ledger.rows.length - 1 }
      return
    }
    const { recording, record } = replay
    const { at } = replaySchedule(recording.events)
    const started = new Date().toISOString()
    const t0 = performance.now()
    let clock = 0
    for (const e of recording.events) {
      const when = at.get(e.seq) ?? clock
      if (when > clock) await sleep(when - clock)
      clock = Math.max(clock, when)
      if (e.phase === 'progress' && e.note) {
        ;(replay.notes[e.step] ??= []).push({ at_ms: e.at_ms, note: e.note })
        yield { phase: 'progress', step: e.step, note: e.note, at_ms: e.at_ms, done: false }
      } else if (e.phase === 'question') {
        yield { phase: 'question', step: e.step, reasoning: e.reasoning ?? undefined, at_ms: e.at_ms, done: false }
      } else if (e.phase === 'settled' && e.row) {
        const i = STEPS.indexOf(e.step)
        const row: LedgerRow = { ...(i >= 0 ? record.ledger.rows[i] : e.row), notes: replay.notes[e.step] ?? [] }
        yield { phase: 'settled', step: e.step, row, at_ms: e.at_ms, done: e.done }
      }
    }
    replay.done = true
    await this.remember(slug, 'replay', started, performance.now() - t0)
  }

  /** Once a run has settled, keep what the page showed: the ledger with its reasoning and the candidate it opened. */
  private async remember(slug: QuerySlug, kind: RunLogKind, started_at: string, elapsed_ms: number): Promise<void> {
    try {
      const record = await this.query(slug)
      if (!record) return
      const candidate = (await this.results(slug))?.candidates[0]
      const id = (record as QueryRecord & { appraisal_id?: string }).appraisal_id
      saveRunLog({ slug, kind, saved_at: new Date().toISOString(), started_at, elapsed_ms: Math.round(elapsed_ms), id, record, candidate })
    } catch (e) {
      console.warn('[elute] run not remembered', e)
    }
  }

  async results(slug: QuerySlug): Promise<ResultsPage | undefined> {
    const replay = this.replays.get(slug)
    if (replay) {
      const c = replay.recording.detail.candidate
      return { query: replay.record, today: c.cutoffs[c.cutoffs.length - 1].date, candidates: [c] }
    }
    const log = this.remembered.has(slug) ? loadRunLog(slug) : undefined
    if (log?.candidate) return { query: log.record, today: log.candidate.cutoffs[log.candidate.cutoffs.length - 1].date, candidates: [log.candidate] }
    return this.pick(slug).results(slug)
  }

  async candidate(query: QuerySlug, candidate: CandidateSlug): Promise<CandidateDetail | undefined> {
    const replay = this.replays.get(query) ?? (await this.query(query), this.replays.get(query))
    if (replay) {
      const c = replay.recording.detail.candidate
      return c.drug_slug === candidate || c.slug === candidate ? c : undefined
    }
    const log = this.remembered.has(query) ? loadRunLog(query) : undefined
    if (log?.candidate) return log.candidate.drug_slug === candidate || log.candidate.slug === candidate ? log.candidate : undefined
    return this.pick(query).candidate(query, candidate)
  }
}
