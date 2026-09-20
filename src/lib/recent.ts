/* elute — the Entry page's recent list. Visited queries, newest first, in localStorage. */

export type Recent = { slug: string; at: string }
const KEY = 'elute:recent'

export function loadRecent(): Recent[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Recent[]) : []
  } catch {
    return []
  }
}

export function touchRecent(slug: string) {
  try {
    const list = loadRecent().filter((r) => r.slug !== slug)
    list.unshift({ slug, at: new Date().toISOString() })
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 8)))
  } catch {
    /* storage unavailable */
  }
}

export function whenWord(iso: string, now = new Date()): string {
  const d = new Date(iso)
  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toLowerCase()
}
