/* elute — the run log: what the research stage showed, kept in this browser so the stage can always be reopened.
 *
 * One entry per query slug in localStorage: the ledger as it settled (every row with its reasoning, timings and the
 * lines it said while running) and the candidate the appraisal opened. Written once a run completes, by whichever
 * source ran it; read when the Working page is revisited, and by the API source when the backend is unreachable.
 * A fresh ask from Entry clears it, so an appraisal is never silently replaced by an old one. */

import type { CandidateDetail, QueryRecord, QuerySlug } from '../data/types'

export type RunLogKind = 'live' | 'replay' | 'scripted'

export type RunLog = {
  slug: QuerySlug
  kind: RunLogKind
  saved_at: string // ISO
  started_at?: string
  elapsed_ms?: number // wall-clock of what the page showed (the replay's, not the recording's)
  id?: string // the backend's appraisal id, when there is one
  record: QueryRecord
  candidate?: CandidateDetail
}

const KEY = (slug: QuerySlug) => `elute:runlog:${slug}`
const RUN_ID_KEY = (slug: QuerySlug) => `elute:run:${slug}` // the API source's session run id (src/data/api.ts)
const REPLAY_KEY = (slug: QuerySlug) => `elute:replay:${slug}`
const SCRIPTED_KEY = (slug: QuerySlug) => `elute:scripted:${slug}`

export function saveRunLog(log: RunLog): void {
  try {
    localStorage.setItem(KEY(log.slug), JSON.stringify(log))
  } catch (e) {
    console.warn('[elute] run log not saved', e)
  }
}

export function loadRunLog(slug: QuerySlug): RunLog | undefined {
  try {
    const raw = localStorage.getItem(KEY(slug))
    if (!raw) return undefined
    const log = JSON.parse(raw) as RunLog
    return log && log.record && Array.isArray(log.record.ledger?.rows) ? log : undefined
  } catch {
    return undefined
  }
}

export function clearRunLog(slug: QuerySlug): void {
  try {
    localStorage.removeItem(KEY(slug))
  } catch {
    /* nothing to clear */
  }
}

/** The Entry chip asked for the recorded run to be replayed rather than a live run started. Session-scoped. */
export function markReplay(slug: QuerySlug, on: boolean): void {
  try {
    if (on) sessionStorage.setItem(REPLAY_KEY(slug), '1')
    else sessionStorage.removeItem(REPLAY_KEY(slug))
  } catch {
    /* storage unavailable: the live source is used */
  }
}

export function isReplayMarked(slug: QuerySlug): boolean {
  try {
    return sessionStorage.getItem(REPLAY_KEY(slug)) === '1'
  } catch {
    return false
  }
}

/** Entry was asked for the hard-coded example: the slug is served from the fixture's scripted sequence whatever
 * source the session sits on. Session-scoped, so a reload mid-run keeps to the script. */
export function markScripted(slug: QuerySlug, on: boolean): void {
  try {
    if (on) sessionStorage.setItem(SCRIPTED_KEY(slug), '1')
    else sessionStorage.removeItem(SCRIPTED_KEY(slug))
  } catch {
    /* storage unavailable: the session's own memory of the mark still holds for this page */
  }
}

export function isScriptedMarked(slug: QuerySlug): boolean {
  try {
    return sessionStorage.getItem(SCRIPTED_KEY(slug)) === '1'
  } catch {
    return false
  }
}

/** A new ask from Entry: forget the previous run of this slug in this browser so the stage runs again from the start. */
export function resetAsk(slug: QuerySlug, replay: boolean): void {
  clearRunLog(slug)
  markReplay(slug, replay)
  try {
    sessionStorage.removeItem(RUN_ID_KEY(slug))
  } catch {
    /* nothing to forget */
  }
}

/** "1 min 42 s", "38 s", "0.4 s" */
export function durationWord(ms: number): string {
  if (ms < 1000) return `${Math.max(0.1, ms / 1000).toFixed(1)} s`
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r ? `${m} min ${r} s` : `${m} min`
}

/** "0:42" for a running clock */
export function clockWord(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
