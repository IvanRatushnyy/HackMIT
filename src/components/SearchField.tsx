/* elute — the one field. Accepts a drug, a condition, or a pair; resolves through the
 * entity index so an open field never dead-ends. Enter on an unmatched string does not navigate. */

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Entity } from '../data/types'
import { source } from '../data/source'

const COVERED = 'Not in the curated set. Fixture mode covers Parkinson’s disease, metformin, and nilotinib for Parkinson’s.'

function matches(entities: Entity[], text: string): Entity[] {
  const q = text.trim().toLowerCase()
  if (!q) return []
  return entities
    .filter((e) => e.name.toLowerCase().includes(q) || e.aliases.some((a) => a.includes(q) || q.includes(a)))
    .slice(0, 6)
}

export function SearchField({ compact = false, autoFocus = false }: { compact?: boolean; autoFocus?: boolean }) {
  const navigate = useNavigate()
  const [entities, setEntities] = useState<Entity[]>([])
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [note, setNote] = useState<string | null>(null)
  const listId = useId()
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    source.entities().then((i) => setEntities(i.entities))
  }, [])

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const hits = useMemo(() => matches(entities, text), [entities, text])

  const go = (e: Entity) => {
    setOpen(false)
    setNote(null)
    setText('')
    navigate(`/q/${e.slug}`)
  }

  const onKey = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    if (ev.key === 'ArrowDown') {
      ev.preventDefault()
      setOpen(true)
      setActive((a) => Math.min(a + 1, Math.max(hits.length - 1, 0)))
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (ev.key === 'Enter') {
      ev.preventDefault()
      if (hits.length) go(hits[Math.min(active, hits.length - 1)])
      else if (text.trim()) setNote(COVERED)
    } else if (ev.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="typeahead" ref={wrap}>
      <input
        className={`field${compact ? ' field--compact' : ''}`}
        type="text"
        role="combobox"
        aria-expanded={open && hits.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label="A drug, a condition, or a drug and a condition"
        placeholder="a drug, a condition, or a drug and a condition"
        autoFocus={autoFocus}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setOpen(true)
          setActive(0)
          setNote(null)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
      />
      {open && hits.length > 0 && (
        <ul className="typeahead__menu" role="listbox" id={listId}>
          {hits.map((e, i) => (
            <li key={e.slug} role="option" aria-selected={i === active}>
              <button
                type="button"
                className="typeahead__item"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(e)}
              >
                <span>{e.name}</span>
                <span className="muted">{e.kind}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {note && !compact && <p className="typeahead__note annotation">{note}</p>}
    </div>
  )
}
