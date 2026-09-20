/* Runs the frontend's own publishability validator over a CandidateDetail JSON produced by the backend adapter.
 * Usage: npx vite-node scripts/validate-detail.ts <path-to-json>   → prints the problems, exits 1 if any. */
import { readFileSync } from 'node:fs'
import { deriveLabel, validateCandidate } from '../src/lib/evidence'
import type { CandidateDetail } from '../src/data/types'

const path = process.argv[2]
const doc = JSON.parse(readFileSync(path, 'utf8')) as { candidate: CandidateDetail } | CandidateDetail
const c = 'candidate' in doc ? doc.candidate : doc
const problems = validateCandidate(c)
const labels: Record<string, Record<string, string>> = {}
for (const cutoff of c.cutoffs) {
  labels[cutoff.date] = {}
  for (const k of c.chain.claims) labels[cutoff.date][k.id] = deriveLabel(k, c.sources, cutoff.date).label
}
console.log(JSON.stringify({ problems, labels }))
process.exit(problems.length ? 1 : 0)
