/* elute — the one field. Accepts a drug, a condition, or a pair; resolves through the
 * entity index so an open field never dead-ends. Enter on an unmatched string does not navigate.
 * `useTypeahead` is the behaviour; `SearchField` is the compact field in the header, and the
 * ask box on Entry (components/Ask.tsx) is the same typeahead in a bigger surface. */

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Entity } from '../data/types'
import { source } from '../data/source'

const COVERED = 'Not in the curated set. Fixture mode covers Parkinson’s disease, metformin, and nilotinib for Parkinson’s.'

function matches(entities: Entity[], text: string): Entity[] {
  const q = text.trim().toLowerCase().replace(/[’']/g, "'")
  if (!q) return []
  const norm = (x: string) => x.toLowerCase().replace(/[’']/g, "'")
  const exact = entities.filter((e) => norm(e.name) === q || e.aliases.some((a) => norm(a) === q))
  const partial = entities.filter((e) => !exact.includes(e) && (norm(e.name).includes(q) || e.aliases.some((a) => norm(a).includes(q) || q.includes(norm(a)))))
  // Exact name or alias matches rank first, so "nilotinib for parkinson's disease" submits the pair, not the condition.
  return [...exact, ...partial].slice(0, 6)
}

export type Typeahead = ReturnType<typeof useTypeahead>

/** The entity index, the hits for the text, keyboard selection, and the note for an unmatched submit.
 * With `menu: false` nothing is shown while typing; Enter still submits the best match. */
export function useTypeahead({ menu = true }: { menu?: boolean } = {}) {
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

  const submit = () => {
    if (hits.length) go(hits[Math.min(active, hits.length - 1)])
    else if (text.trim()) setNote(COVERED)
  }

  const onChange = (value: string) => {
    setText(value)
    setOpen(true)
    setActive(0)
    setNote(null)
  }

  /* Arrows walk the hits when there are any (otherwise a textarea keeps them for its caret);
   * Enter submits, Shift+Enter is left to the field. */
  const onKey = (ev: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!menu && (ev.key === 'ArrowDown' || ev.key === 'ArrowUp')) return
    if (ev.key === 'ArrowDown' && hits.length) {
      ev.preventDefault()
      setOpen(true)
      setActive((a) => Math.min(a + 1, hits.length - 1))
    } else if (ev.key === 'ArrowUp' && hits.length) {
      ev.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault()
      submit()
    } else if (ev.key === 'Escape') {
      setOpen(false)
    }
  }

  const expanded = menu && open && hits.length > 0
  return { text, hits, active, note, listId, wrap, expanded, onChange, onKey, submit, go, setActive, focus: () => setOpen(true) }
}

export function TypeaheadMenu({ t }: { t: Typeahead }) {
  if (!t.expanded) return null
  return (
    <ul className="typeahead__menu" role="listbox" id={t.listId}>
      {t.hits.map((e, i) => (
        <li key={e.slug} role="option" aria-selected={i === t.active}>
          <button type="button" className="typeahead__item" aria-selected={i === t.active} onMouseEnter={() => t.setActive(i)} onClick={() => t.go(e)}>
            <span>{e.name}</span>
            <span className="muted">{e.kind}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/** The compact field in the header. */
export function SearchField({ compact = false }: { compact?: boolean }) {
  const t = useTypeahead()
  return (
    <div className="typeahead" ref={t.wrap} style={compact ? { width: 384 } : undefined}>
      <input
        className="field"
        type="text"
        role="combobox"
        aria-expanded={t.expanded}
        aria-controls={t.listId}
        aria-autocomplete="list"
        aria-label="Drug, condition, or drug for condition"
        placeholder="drug, condition, or drug for condition"
        value={t.text}
        onChange={(e) => t.onChange(e.target.value)}
        onFocus={t.focus}
        onKeyDown={t.onKey}
      />
      <TypeaheadMenu t={t} />
      {t.note && !compact && <p className="typeahead__note annotation">{t.note}</p>}
    </div>
  )
}
