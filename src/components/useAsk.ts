/* elute — the one field's behaviour. A drug, a condition, or a pair, resolved through the entity index so
 * an open field never dead-ends. Nothing is suggested while typing; Enter, the send button, or an example
 * chip submits the best match, exact name or alias first, and an unmatched string gets a note rather than
 * a navigation. `onLaunch` runs before the navigation and returns how long to wait for it (the ripple). */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Entity } from '../data/types'
import { source } from '../data/source'

const COVERED = 'Not in the curated set. Fixture mode covers Parkinson’s disease, metformin, and nilotinib for Parkinson’s.'

function bestMatch(entities: Entity[], text: string): Entity | undefined {
  const q = text.trim().toLowerCase().replace(/[’']/g, "'")
  if (!q) return undefined
  const norm = (x: string) => x.toLowerCase().replace(/[’']/g, "'")
  return (
    entities.find((e) => norm(e.name) === q || e.aliases.some((a) => norm(a) === q)) ??
    entities.find((e) => norm(e.name).includes(q) || e.aliases.some((a) => norm(a).includes(q) || q.includes(norm(a))))
  )
}

export function useAsk(onLaunch?: () => number) {
  const navigate = useNavigate()
  const [entities, setEntities] = useState<Entity[]>([])
  const [text, setText] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [launching, setLaunching] = useState(false)

  useEffect(() => {
    source.entities().then((i) => setEntities(i.entities))
  }, [])

  const hit = useMemo(() => bestMatch(entities, text), [entities, text])

  const go = (value: string) => {
    const match = bestMatch(entities, value)
    if (!match) {
      if (value.trim()) setNote(COVERED)
      return
    }
    setNote(null)
    setLaunching(true)
    const wait = onLaunch?.() ?? 0
    setTimeout(() => navigate(`/q/${match.slug}`), wait)
  }

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

  return { text, note, hit, launching, onChange, onKey, submit, go }
}
