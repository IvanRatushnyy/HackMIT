/* elute — paste-a-paper: the papers the fixture can read.
 * A pasted PMID, DOI, registry id, or abstract is matched here; the extraction is shown
 * before anything runs so a wrong read is caught in two seconds (PRD §2, §7 step 1). */

export type PaperExtraction = {
  title: string
  citation: string
  design: string
  blinded: 'yes' | 'no' | 'n/a'
  placebo: 'yes' | 'no' | 'n/a'
  n?: number
  outcome: string
  condition: string
  drug: string
  source: string // the ledger step that would classify it
}

export type Paper = {
  id: string
  match: { doi?: string; pmid?: string; nct?: string; all?: string[] } // all: every keyword must appear
  extraction: PaperExtraction
  appraise: { slug: string; word: string }
}

export const papers: Paper[] = [
  {
    id: 'pagan-2016',
    match: { doi: '10.3233/jpd-160867', all: ['nilotinib', 'parkinson'] },
    extraction: {
      title: 'Nilotinib effects in Parkinson’s disease and dementia with Lewy bodies',
      citation: 'Pagan F et al., J Parkinsons Dis 2016',
      design: 'open-label pilot',
      blinded: 'no',
      placebo: 'no',
      n: 12,
      outcome: 'motor and cognitive scores improved; CSF dopamine metabolite rose',
      condition: 'Parkinson’s disease',
      drug: 'nilotinib',
      source: 'L6 · literature, study design classified',
    },
    appraise: { slug: 'nilotinib--parkinsons-disease', word: 'nilotinib for Parkinson’s disease' },
  },
  {
    id: 'simuni-2021',
    match: { nct: 'nct02954978', all: ['nilo-pd'] },
    extraction: {
      title: 'Efficacy of nilotinib in patients with moderately advanced Parkinson disease (NILO-PD)',
      citation: 'Simuni T et al., JAMA Neurol 2021',
      design: 'randomised, double-blind, placebo-controlled phase 2',
      blinded: 'yes',
      placebo: 'yes',
      n: 76,
      outcome: 'no robust clinical effect; no change in dopamine biomarkers; CSF exposure a fraction of a percent of serum',
      condition: 'Parkinson’s disease',
      drug: 'nilotinib',
      source: 'L5 · registered trials, blinding and n extracted',
    },
    appraise: { slug: 'nilotinib--parkinsons-disease', word: 'nilotinib for Parkinson’s disease' },
  },
  {
    id: 'vijiaratnam-2025',
    match: { pmid: '39919773', all: ['exenatide', 'parkinson'] },
    extraction: {
      title: 'Exenatide once a week versus placebo as a potential disease-modifying treatment for Parkinson’s disease (Exenatide-PD3)',
      citation: 'Vijiaratnam N et al., Lancet 2025',
      design: 'randomised, double-blind, placebo-controlled phase 3',
      blinded: 'yes',
      placebo: 'yes',
      n: 194,
      outcome: 'no difference in the primary motor outcome at 96 weeks',
      condition: 'Parkinson’s disease',
      drug: 'exenatide',
      source: 'L5 · registered trials, blinding and n extracted',
    },
    appraise: { slug: 'parkinsons-disease', word: 'Parkinson’s disease candidates' },
  },
]

/** Match pasted text against the fixture's papers: identifier first, then keywords. */
export function readPaper(text: string): Paper | undefined {
  const t = text.trim().toLowerCase()
  if (!t) return undefined
  for (const p of papers) {
    if (p.match.doi && t.includes(p.match.doi)) return p
    if (p.match.pmid && new RegExp(`\\b${p.match.pmid}\\b`).test(t)) return p
    if (p.match.nct && t.includes(p.match.nct)) return p
  }
  for (const p of papers) {
    if (p.match.all && p.match.all.every((k) => t.includes(k))) return p
  }
  return undefined
}
