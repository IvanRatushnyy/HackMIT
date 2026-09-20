/* elute — the one field's behaviour. An appraisal is one drug for one condition (the backend's Phase 1
 * contract), so the field takes a pair. Nothing is suggested while typing; Enter, the send button, or a recorded
 * example submits, and a string that isn't a pair gets a note rather than a navigation. `onLaunch` runs before the
 * navigation and returns how long to wait for it (the ripple). Live: a typed pair goes to the backend as typed, and a
 * lone name only when the index already knows it as a pair. Fixture: the pair has to be one the curated set holds,
 * by name, alias, or the slug the typed pair makes — or one a recorded run exists for (public/demo). The hard-coded
 * example, typed as written (SCRIPTED_ASK), runs the fixture's scripted sequence in either mode. Every ask forgets
 * the previous run of that slug first, so the research stage always runs again from the start. */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Entity } from '../data/types'
import { source } from '../data/source'
import { pairSlug, parsePair, rememberPair } from '../lib/pair'

const COVERED = 'Not in the curated set. Fixture mode covers one pair: nilotinib for Parkinson’s disease.'
const PAIR_ONLY = 'An appraisal is one drug for one condition — write it as “nilotinib for Parkinson’s disease”.'

/** The hard-coded example. Typed as written (either apostrophe, any case), it runs the fixture's scripted sequence
 * for the curated pair whatever source the session sits on, so a demo never waits on the backend. */
export const SCRIPTED_ASK = 'nilotinib for Parkinson’s'
const SCRIPTED_SLUG = 'nilotinib--parkinsons-disease'
const plainAsk = (s: string) => s.trim().toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ')
export const isScriptedAsk = (text: string): boolean => plainAsk(text) === plainAsk(SCRIPTED_ASK)

/** A recorded live run the bundle can replay: what was asked, as it was typed (public/demo/index.json). */
export type Recorded = { slug: string; drug: string; disease: string; text: string; recorded_at: string; elapsed_ms: number; llm: string }

export async function loadRecordedIndex(): Promise<Recorded[]> {
  try {
    const r = await fetch('/demo/index.json', { headers: { accept: 'application/json' } })
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) return []
    const doc = (await r.json()) as { version: number; recordings: Recorded[] }
    return Array.isArray(doc?.recordings) ? doc.recordings.filter((x) => typeof x?.slug === 'string' && typeof x?.text === 'string') : []
  } catch {
    return []
  }
}

function bestMatch(entities: Entity[], text: string): Entity | undefined {
  const q = text.trim().toLowerCase().replace(/[’']/g, "'")
  if (!q) return undefined
  const norm = (x: string) => x.toLowerCase().replace(/[’']/g, "'")
  return (
    entities.find((e) => norm(e.name) === q || e.aliases.some((a) => norm(a) === q)) ??
    entities.find((e) => norm(e.name).includes(q) || e.aliases.some((a) => norm(a).includes(q) || q.includes(norm(a))))
  )
}

/** Where a value leads, or the note to show instead. */
function resolve(entities: Entity[], recorded: Recorded[], value: string): { slug: string; replay: boolean; scripted?: boolean } | { note: string } | undefined {
  if (!value.trim()) return undefined
  if (isScriptedAsk(value)) return { slug: SCRIPTED_SLUG, replay: false, scripted: true }
  const match = bestMatch(entities, value)
  const pair = parsePair(value)
  const typedSlug = pair ? pairSlug(pair.drug, pair.disease) : undefined
  const recording = recorded.find((r) => r.slug === typedSlug || r.text.toLowerCase() === value.trim().toLowerCase())
  if (source.mode === 'live') {
    const slug = pair ? pairSlug(pair.drug, pair.disease) : match?.kind === 'pair' ? match.slug : undefined
    if (!slug) return { note: PAIR_ONLY }
    if (pair) rememberPair(slug, pair.drug, pair.disease)
    return { slug, replay: false } // typed: always a live run; the example chip is the way to the replay
  }
  if (recording) {
    rememberPair(recording.slug, recording.drug, recording.disease)
    return { slug: recording.slug, replay: true }
  }
  if (match?.kind === 'pair') return { slug: match.slug, replay: false }
  if (!pair) return { note: PAIR_ONLY }
  const known = entities.find((e) => e.kind === 'pair' && e.slug === pairSlug(pair.drug, pair.disease))
  return known ? { slug: known.slug, replay: false } : { note: COVERED }
}

export function useAsk(onLaunch?: () => number) {
  const navigate = useNavigate()
  const [entities, setEntities] = useState<Entity[]>([])
  const [recorded, setRecorded] = useState<Recorded[]>([])
  const [text, setText] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [launching, setLaunching] = useState(false)

  useEffect(() => {
    source.entities().then((i) => setEntities(i.entities))
    loadRecordedIndex().then(setRecorded)
  }, [])

  const hit = useMemo(() => bestMatch(entities, text), [entities, text])

  const launch = (slug: string, replay: boolean, scripted = false) => {
    setNote(null)
    setLaunching(true)
    source.forget(slug, { replay, scripted })
    const wait = onLaunch?.() ?? 0
    setTimeout(() => navigate(`/q/${slug}`), wait)
  }

  const go = (value: string) => {
    const r = resolve(entities, recorded, value)
    if (!r) return
    if ('note' in r) {
      setNote(r.note)
      return
    }
    launch(r.slug, r.replay, r.scripted)
  }

  /** A recorded run, replayed at demo pace; the field shows the words as they were asked. */
  const replay = (rec: Recorded) => {
    setText(rec.text)
    rememberPair(rec.slug, rec.drug, rec.disease)
    launch(rec.slug, true)
  }

  /** The hard-coded example: the fixture's scripted sequence and the curated nilotinib record, no backend needed. */
  const example = () => {
    setText(SCRIPTED_ASK)
    launch(SCRIPTED_SLUG, false, true)
  }

  /** What Entry offers under "try:": the hard-coded example always, recorded runs beside it worded as they were
   * asked; a recording asked in the example's own words stands in for it. */
  const examples = useMemo<{ key: string; text: string; title: string; pick: () => void }[]>(() => {
    const recs = recorded.map((rec) => ({ key: rec.slug, text: rec.text, title: `a run recorded ${rec.recorded_at ? rec.recorded_at.slice(0, 10) : 'earlier'}, replayed at demo pace`, pick: () => replay(rec) }))
    if (recorded.some((rec) => isScriptedAsk(rec.text))) return recs
    return [{ key: 'example', text: SCRIPTED_ASK, title: 'the curated example: a scripted sequence with real source names, not a live run', pick: example }, ...recs]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorded])

  const submit = () => go(text)

  const onChange = (value: string) => {
    setText(value)
    setNote(null)
  }

  /* Enter submits; Shift+Enter is left to the field */
  const onKey = (ev: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault()
      submit()
    }
  }

  return { text, note, hit, launching, recorded, examples, onChange, onKey, submit, go, replay, example }
}
