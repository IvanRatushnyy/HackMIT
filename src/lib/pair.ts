/* elute — a free-text ask as a drug–condition pair, for live mode (backend Phase 1 appraises pairs only).
 * The slug mirrors the backend adapter's slugify so the URL, the POST body and the returned candidate agree;
 * the names as typed are kept for the session so a reload still posts "Parkinson's disease", not "parkinsons disease". */

/** Same rule as backend `adapt.slugify`: lowercase, apostrophes dropped, runs of anything else → one hyphen. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const SEPARATOR = /\s+(?:for|in|→|->|\+|,|\/|—|–|:)\s+|\s*(?:→|->|\+|,|\/|—|–|:)\s*/

/** "nilotinib for Parkinson's disease", "nilotinib + Parkinson's", "nilotinib, PD" → the pair as typed; one term → undefined. */
export function parsePair(text: string): { drug: string; disease: string } | undefined {
  const parts = text
    .trim()
    .split(SEPARATOR)
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length !== 2) return undefined
  return { drug: parts[0], disease: parts[1] }
}

export const pairSlug = (drug: string, disease: string) => `${slugify(drug)}--${slugify(disease)}`

const KEY = (slug: string) => `elute:pair:${slug}`

export function rememberPair(slug: string, drug: string, disease: string): void {
  try {
    sessionStorage.setItem(KEY(slug), JSON.stringify({ drug, disease }))
  } catch {
    /* storage unavailable: the slug alone still resolves */
  }
}

export function recallPair(slug: string): { drug: string; disease: string } | undefined {
  try {
    const raw = sessionStorage.getItem(KEY(slug))
    return raw ? (JSON.parse(raw) as { drug: string; disease: string }) : undefined
  } catch {
    return undefined
  }
}
