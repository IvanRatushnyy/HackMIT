/* elute — the one field's behaviour. A drug, a condition, or a pair, resolved through the entity index so
 * an open field never dead-ends. Nothing is suggested while typing; Enter or the send button submits the
 * best match, exact name or alias first, and an unmatched string gets a note rather than a navigation. */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Entity } from '../data/types'
import { source } from '../data/source'

const COVERED = 'Not in the curated set. Fixture mode covers Parkinson’s disease, metformin, and nilotinib for Parkinson’s.'

function bestMatch(entities: Entity[], text: string): Entity | undefined {
  const q = text.trim().toLowerCase().replace(/[’']/g, "'")
  if (!q) return undefined
  const norm = (x: string) => x.toLowerCase().replace(/[’']/g, "'")
  // An exact name or alias first, so "nilotinib for parkinson's disease" submits the pair, not the condition.
  return (
    entities.find((e) => norm(e.name) === q || e.aliases.some((a) => norm(a) === q)) ??
    entities.find((e) => norm(e.name).includes(q) || e.aliases.some((a) => norm(a).includes(q) || q.includes(norm(a))))
  )
}

export function useAsk() {
  const navigate = useNavigate()
  const [entities, setEntities] = useState<Entity[]>([])
  const [text, setText] = useState('')
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    source.entities().then((i) => setEntities(i.entities))
  }, [])

  const hit = useMemo(() => bestMatch(entities, text), [entities, text])

  const submit = () => {
    if (hit) {
      setNote(null)
      setText('')
      navigate(`/q/${hit.slug}`)
    } else if (text.trim()) setNote(COVERED)
  }

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

  return { text, note, onChange, onKey, submit }
}
