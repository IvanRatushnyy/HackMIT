/* elute — Pathway: the hypothesis drawn as biology, in SVG, with the curated context under it.
 *
 * The drawing puts the drug in the blood, the barrier it must cross, the molecules it acts on in the brain,
 * and the outcome in the patient. Every action that belongs to the hypothesis points at a chain claim, so
 * its stroke and its status word come from the evidence rules at the selected date, and selecting it opens
 * that claim's evidence beneath. Actions without a claim are background biology, drawn in grey and silent.
 * On arrival each action is revealed from its source outward, in the order the hypothesis makes its
 * argument. Records without a drawing get the chain as a line of labelled links with the same panel.
 *
 * Under the drawing: the fine print (target compartment, tractability, route, barrier, what the target is
 * filed under) and a thumbnail of Reactome's own diagram of a pathway the target is actually filed under.
 * Open Targets and Reactome are fetched live; the drawing needs no network. */

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { X } from '@phosphor-icons/react'
import type { ActionKind, CandidateDetail, Cutoff, Label, PathwayDrawing } from '../data/types'
import { deriveLabel, resolveTimeline, type LabelResult } from '../lib/evidence'
import {
  chainGenes,
  compartmentSummary,
  edgeCuration,
  fetchDrugContext,
  orderPathways,
  primaryTargets,
  reactomeBrowserUrl,
  reactomeDiagramUrl,
  stringNetworkUrl,
  tractabilitySummary,
  type DrugContext,
  type OTPathway,
} from '../lib/pathway'
import { EASE_OUT } from '../lib/motion'
import { ClaimEvidence } from './detail'
import { EvidenceLabel, plain } from './evidence'
import { Kicker } from './frame'

type Status = 'loading' | 'live' | 'offline' | 'none'
type Plate = { kind: 'reactome'; i: number } | { kind: 'string' } | { kind: 'none' }

/** Stroke by label: the evidence rules made visible. */
const STROKE: Record<Label, { width: number; dash?: string }> = {
  established: { width: 3 },
  contested: { width: 2, dash: '8 6' },
  'single-source': { width: 2, dash: '3 5' },
  unknown: { width: 1.5, dash: '1 4' },
  refuted: { width: 2 },
}
const TONE: Record<Label, string> = {
  established: 'var(--evidence-established)',
  contested: 'var(--evidence-contested)',
  'single-source': 'var(--evidence-single-source)',
  unknown: 'var(--evidence-unknown)',
  refuted: 'var(--evidence-refuted)',
}

// ---- Geometry -----------------------------------------------------------------------------

const W = 1104
const H = 400
const PADX = 80
const TOP = 84
const BOTTOM = H - 56

type Node = { id: string; x: number; y: number; w: number; h: number; lines: string[]; kind: PathwayDrawing['molecules'][number]['kind'] }

function splitLabel(label: string): string[] {
  if (label.length <= 16) return [label]
  const mid = label.length / 2
  let best = -1
  for (let i = 0; i < label.length; i++) if (label[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i
  return best < 0 ? [label] : [label.slice(0, best), label.slice(best + 1)]
}
const textWidth = (lines: string[], size: number) => Math.round(Math.max(...lines.map((l) => l.length)) * size * 0.55 + 32)

/** Where a line from a node's centre toward (tx, ty) leaves the node's rectangle, plus a 6px gap. */
function border(n: Node, tx: number, ty: number): [number, number] {
  const dx = tx - n.x
  const dy = ty - n.y
  const sx = Math.abs(dx) > 0.001 ? (n.w / 2 + 6) / Math.abs(dx) : Infinity
  const sy = Math.abs(dy) > 0.001 ? (n.h / 2 + 6) / Math.abs(dy) : Infinity
  const s = Math.min(sx, sy)
  return [n.x + dx * s, n.y + dy * s]
}

/** The glyph at the head of an action: a bar for inhibition, a circle for phosphorylation, a diamond for transport. */
function Head({ kind, x, y, ang, color }: { kind: ActionKind; x: number; y: number; ang: number; color: string }) {
  const s = 7
  const t = `translate(${x} ${y}) rotate(${(ang * 180) / Math.PI})`
  if (kind === 'inhibits' || kind === 'prevents') return <line x1={0} y1={-s} x2={0} y2={s} stroke={color} strokeWidth={2.5} transform={t} />
  if (kind === 'phosphorylates') return <circle cx={-s / 2} cy={0} r={s / 2 + 0.5} fill={color} transform={t} />
  if (kind === 'crosses') return <path d={`M0 0 L${-s} ${-s * 0.8} L${-s * 2} 0 L${-s} ${s * 0.8} Z`} fill={color} transform={t} />
  return <path d={`M0 0 L${-s * 1.5} ${-s * 0.7} L${-s * 1.5} ${s * 0.7} Z`} fill={color} transform={t} />
}

type Edge = {
  id: string
  claim?: string
  kind: ActionKind
  word: string
  d: string
  p0: [number, number]
  p1: [number, number]
  mx: number
  my: number
  vertical: boolean
  arc: boolean
  len: number
  ang: number
}

function layout(drawing: PathwayDrawing) {
  const nodes = new Map<string, Node>()
  for (const m of drawing.molecules) {
    const size = m.kind === 'process' || m.kind === 'cell' ? 14 : 16
    const lines = splitLabel(m.label)
    nodes.set(m.id, { id: m.id, x: PADX + m.at[0] * (W - PADX * 2), y: TOP + m.at[1] * (BOTTOM - TOP), w: textWidth(lines, size), h: lines.length > 1 ? 56 : 44, lines, kind: m.kind })
  }
  // Bands from the molecules they hold, tiled across the width with 8px gaps
  const bands = drawing.compartments.map((c) => {
    const own = [...nodes.values()].filter((n) => drawing.molecules.find((m) => m.id === n.id)?.compartment === c.id)
    return { id: c.id, label: c.label, x0: Math.min(...own.map((n) => n.x - n.w / 2)) - 24, x1: Math.max(...own.map((n) => n.x + n.w / 2)) + 24 }
  })
  for (let i = 0; i < bands.length; i++) {
    if (i === 0) bands[i].x0 = 16
    if (i === bands.length - 1) bands[i].x1 = W - 16
    if (i > 0) {
      const mid = (bands[i - 1].x1 + bands[i].x0) / 2
      bands[i - 1].x1 = mid - 4
      bands[i].x0 = mid + 4
    }
  }
  const edges: Edge[] = drawing.actions.map((a) => {
    const from = nodes.get(a.from)!
    const to = nodes.get(a.to)!
    if (a.arc) {
      const ax = from.x, ay = from.y - from.h / 2 - 4
      const bx = to.x, by = to.y - to.h / 2 - 4
      const cx = (ax + bx) / 2, cy = (ay + by) / 2 + a.arc
      return {
        id: a.id, claim: a.claim, kind: a.kind, word: a.word,
        d: `M${ax} ${ay} Q${cx} ${cy} ${bx} ${by}`, p0: [ax, ay], p1: [bx, by],
        mx: 0.25 * ax + 0.5 * cx + 0.25 * bx, my: 0.25 * ay + 0.5 * cy + 0.25 * by,
        vertical: false, arc: true, len: Math.hypot(bx - ax, by - ay) + Math.abs(a.arc), ang: Math.atan2(by - cy, bx - cx),
      }
    }
    const p0 = border(from, to.x, to.y)
    const p1 = border(to, from.x, from.y)
    return {
      id: a.id, claim: a.claim, kind: a.kind, word: a.word,
      d: `M${p0[0]} ${p0[1]} L${p1[0]} ${p1[1]}`, p0, p1,
      mx: (p0[0] + p1[0]) / 2, my: (p0[1] + p1[1]) / 2,
      vertical: Math.abs(p1[1] - p0[1]) > Math.abs(p1[0] - p0[0]), arc: false,
      len: Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), ang: Math.atan2(p1[1] - p0[1], p1[0] - p0[0]),
    }
  })
  return { nodes: [...nodes.values()], bands, edges }
}

/** A chain without an authored drawing: the drug and each node on a line, every link labelled. */
function chainDrawing(candidate: CandidateDetail): PathwayDrawing {
  const claims = candidate.chain.claims
  const n = claims.length + 1
  return {
    compartments: [{ id: 'chain', label: 'hypothesis' }],
    molecules: [
      { id: 'drug', label: candidate.chain.drug, kind: 'drug', compartment: 'chain', at: [0, 0.5] },
      ...claims.map((k, i) => ({ id: k.id, label: k.node, kind: (i === claims.length - 1 ? 'outcome' : 'protein') as PathwayDrawing['molecules'][number]['kind'], compartment: 'chain', at: [(i + 1) / (n - 1), 0.5] as [number, number] })),
    ],
    actions: claims.map((k, i) => ({ id: `e-${k.id}`, from: i === 0 ? 'drug' : claims[i - 1].id, to: k.id, kind: 'activates' as ActionKind, word: k.short, claim: k.id })),
  }
}

// ---- The drawing ------------------------------------------------------------------------------

function Drawing({
  drawing,
  labels,
  weak,
  selected,
  onSelect,
  curation,
  reduce,
  revealKey,
}: {
  drawing: PathwayDrawing
  labels: Map<string, LabelResult>
  weak?: string
  selected: string | null
  onSelect: (claim: string | null) => void
  curation: (claim: string) => string
  reduce: boolean | null
  revealKey: string
}) {
  const { nodes, bands, edges } = useMemo(() => layout(drawing), [drawing])
  const order = useMemo(() => nodes.map((n) => n.id), [nodes])
  const placed = edges.map((e) => {
    const r = e.claim ? labels.get(e.claim) : undefined
    const label = r?.label
    const spec = label ? STROKE[label] : { width: 1.5 }
    const color = label ? TONE[label] : 'var(--color-line-strong)'
    const on = !!selected && e.claim === selected
    const off = !!selected && e.claim !== selected
    // The status word sits clear of the boxes: beside a vertical edge, above a horizontal one (above the
    // node band, since short edges are narrower than the word), and off the up-facing side of a diagonal.
    const dx = e.p1[0] - e.p0[0]
    const dy = e.p1[1] - e.p0[1]
    const diagonal = !e.arc && !e.vertical && Math.abs(dy) > 12
    const nx = diagonal ? (dy > 0 ? dy : -dy) / Math.hypot(dx, dy) : 0
    const ny = diagonal ? (dy > 0 ? -dx : dx) / Math.hypot(dx, dy) : 0
    const wx = e.vertical ? e.mx + 12 : diagonal ? e.mx + nx * 18 : e.mx
    const wy = e.vertical ? e.my + 4 : e.arc ? e.my - 10 : diagonal ? e.my + ny * 18 + 4 : e.my - 34
    const anchor: 'start' | 'middle' | 'end' = e.vertical ? 'start' : diagonal ? (nx > 0 ? 'start' : 'end') : 'middle'
    return { e, r, label, spec, color, on, off, wx, wy, anchor }
  })
  return (
    <svg className="pw" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Pathway drawing: ${edges.map((e) => `${drawing.molecules.find((m) => m.id === drawing.actions.find((a) => a.id === e.id)?.from)?.label} ${e.word} ${drawing.molecules.find((m) => m.id === drawing.actions.find((a) => a.id === e.id)?.to)?.label}`).join('; ')}`} onClick={() => onSelect(null)} key={revealKey}>
      <defs>
        {edges.map((e, i) => (
          <clipPath id={`pw-clip-${e.id}`} key={e.id}>
            <motion.circle cx={e.p0[0]} cy={e.p0[1]} initial={{ r: reduce ? e.len * 1.6 : 0 }} animate={{ r: e.len * 1.6 }} transition={{ duration: 0.52, delay: reduce ? 0 : 1.1 + i * 0.22, ease: EASE_OUT }} />
          </clipPath>
        ))}
      </defs>
      {/* compartments as soft bands on the sunken surface */}
      {bands.map((b, i) => (
        <motion.g key={b.id} initial={{ opacity: reduce ? 1 : 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: i * 0.12, ease: EASE_OUT }}>
          <rect x={b.x0} y={16} width={b.x1 - b.x0} height={H - 32} rx={8} className="pw__band" />
          <text x={b.x0 + 20} y={44} className="pw__band-label">
            {plain(b.label)}
          </text>
        </motion.g>
      ))}
      {/* actions */}
      {placed.map(({ e, r, label, spec, color, on, off }) => (
        <g key={e.id} clipPath={`url(#pw-clip-${e.id})`} className={`pw__edge${r ? ' pw__edge--hyp' : ' pw__edge--bg'}${on ? ' is-on' : ''}${off ? ' is-off' : ''}`}>
          <path d={e.d} fill="none" stroke={color} strokeWidth={on ? spec.width + 1.5 : spec.width} strokeDasharray={spec.dash} strokeLinecap="round" />
          <Head kind={e.kind} x={e.p1[0]} y={e.p1[1]} ang={e.ang} color={color} />
          {e.claim && (
            <path
              d={e.d}
              fill="none"
              stroke="transparent"
              strokeWidth={24}
              className="pw__hit"
              role="button"
              tabIndex={0}
              aria-label={`${e.word}: ${label}${weak === e.claim ? ', weakest link' : ''}`}
              aria-pressed={on}
              onClick={(ev) => {
                ev.stopPropagation()
                onSelect(on ? null : e.claim!)
              }}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') {
                  ev.preventDefault()
                  onSelect(on ? null : e.claim!)
                }
              }}
            />
          )}
        </g>
      ))}
      {/* status words, in their own layer so the reveal clips never cut them */}
      {placed.map(({ e, label, on, off, wx, wy, anchor }, i) =>
        label ? (
          <motion.text key={e.id} x={wx} y={wy} textAnchor={anchor} className={`pw__status pw__status--${label}${off ? ' is-off' : ''}`} initial={{ opacity: reduce ? 1 : 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: reduce ? 0 : 1.6 + i * 0.22 }}>
            <tspan>{on ? `${e.word}, ${label}` : label}</tspan>
            {weak === e.claim && (
              <tspan x={wx} dy={14} className="pw__status--weak">
                weakest link
              </tspan>
            )}
            {on && (
              <tspan x={wx} dy={14} className="pw__status--prov">
                {curation(e.claim!)}
              </tspan>
            )}
          </motion.text>
        ) : null,
      )}
      {/* molecules */}
      {nodes.map((n) => {
        const i = order.indexOf(n.id)
        const rx = n.kind === 'drug' || n.kind === 'cell' || n.kind === 'outcome' ? 2 : 8
        return (
          <motion.g key={n.id} className={`pw__mol pw__mol--${n.kind}`} initial={reduce ? false : { opacity: 0, x: n.x, y: n.y + 6 }} animate={{ opacity: 1, x: n.x, y: n.y }} transition={{ duration: 0.42, delay: reduce ? 0 : 0.3 + i * 0.1, ease: EASE_OUT }}>
            <rect x={-n.w / 2} y={-n.h / 2} width={n.w} height={n.h} rx={rx} />
            <text x={0} y={n.lines.length > 1 ? -3 : 5} textAnchor="middle">
              {n.lines.map((ln, k) => (
                <tspan key={k} x={0} dy={k === 0 ? 0 : 17}>
                  {ln}
                </tspan>
              ))}
            </text>
          </motion.g>
        )
      })}
    </svg>
  )
}

// ---- The section ------------------------------------------------------------------------------

export function Pathway({ candidate, cutoff, sourcesHref }: { candidate: CandidateDetail; cutoff: Cutoff; sourcesHref: string }) {
  const reduce = useReducedMotion()
  const [ctx, setCtx] = useState<DrugContext | undefined>()
  const [status, setStatus] = useState<Status>(candidate.chembl_id ? 'loading' : 'none')
  const [plate, setPlate] = useState<Plate>({ kind: 'none' })
  const [plateOpen, setPlateOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  const claims = candidate.chain.claims
  const drawing = useMemo(() => candidate.drawing ?? chainDrawing(candidate), [candidate])
  const labels = useMemo(() => {
    const m = new Map<string, LabelResult>()
    for (const k of claims) m.set(k.id, deriveLabel(k, candidate.sources, cutoff.date))
    return m
  }, [claims, candidate.sources, cutoff.date])
  const weak = resolveTimeline(candidate.weakest_link, cutoff.date)
  const targets = ctx ? primaryTargets(ctx) : []
  const target = targets[0]
  const pathways: OTPathway[] = useMemo(() => (target ? orderPathways(target.pathways) : []), [target])
  const genes = chainGenes(claims)
  const srcById = new Map(candidate.sources.map((s) => [s.id, s]))
  const current = selected ? claims.find((k) => k.id === selected) : undefined
  const currentLabel = current ? labels.get(current.id) : undefined
  const curation = (claim: string) => {
    const i = claims.findIndex((k) => k.id === claim)
    return edgeCuration(claims[i], i, ctx ? targets : undefined).kind === 'mechanism' ? 'ChEMBL mechanism' : 'not curated'
  }

  useEffect(() => {
    setSelected(null)
  }, [candidate.slug])

  // Fetch once per drug; a failure leaves the drawing standing on its own.
  useEffect(() => {
    if (!candidate.chembl_id) return
    let cancelled = false
    setStatus('loading')
    fetchDrugContext(candidate.chembl_id)
      .then((c) => {
        if (cancelled) return
        setCtx(c)
        setStatus('live')
        const t = primaryTargets(c)[0]
        setPlate(t && t.pathways.length ? { kind: 'reactome', i: 0 } : { kind: 'string' })
      })
      .catch(() => {
        if (cancelled) return
        setStatus('offline')
        setPlate({ kind: 'none' })
      })
    return () => {
      cancelled = true
    }
  }, [candidate.chembl_id])

  const symbol = target?.approvedSymbol
  const fetched = ctx ? new Date(ctx.fetched_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
  const plateSrc =
    plate.kind === 'reactome' && pathways[plate.i]
      ? reactomeDiagramUrl(pathways[plate.i].pathwayId, { flag: symbol, quality: 6 })
      : plate.kind === 'string' && genes.length
        ? stringNetworkUrl(genes)
        : undefined
  const onPlateError = () => {
    if (plate.kind === 'reactome') setPlate(plate.i + 1 < pathways.length ? { kind: 'reactome', i: plate.i + 1 } : { kind: 'string' })
    else setPlate({ kind: 'none' })
  }

  return (
    <section className="section" aria-labelledby="pathway">
      <div className="section__head">
        <div>
          <h2 className="display-xs" id="pathway">
            <span className="section__n">2</span>the pathway
          </h2>
        </div>
        <span className="section__status">
          {status === 'live' && `live from Open Targets and Reactome, ${fetched}`}
          {status === 'loading' && 'asking Open Targets'}
          {status === 'offline' && 'Open Targets unreachable, hypothesis only'}
          {status === 'none' && 'hypothesis only'}
        </span>
      </div>

      <div className="panel pw__panel">
        <Drawing drawing={drawing} labels={labels} weak={weak?.claim} selected={selected} onSelect={setSelected} curation={curation} reduce={reduce} revealKey={candidate.slug} />
      </div>

      <AnimatePresence initial={false}>
        {current && currentLabel && (
          <motion.div key={current.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.32, ease: EASE_OUT }}>
            <div className="panel claim-panel">
              <div className="claim-panel__col">
                <Kicker>claim</Kicker>
                <p className="claim-panel__text">{current.text}</p>
                <p>
                  <EvidenceLabel label={currentLabel.label} qualifier={currentLabel.qualifier} />
                </p>
                <p className="claim-panel__why">{currentLabel.why}</p>
                {weak?.claim === current.id && (
                  <p className="claim-panel__weak">
                    <span className="medium">weakest link.</span> {weak.why}
                  </p>
                )}
              </div>
              <div className="claim-panel__col">
                <Kicker>evidence</Kicker>
                <ClaimEvidence r={currentLabel} sourcesHref={sourcesHref} />
              </div>
              <button type="button" className="claim-panel__close" aria-label="Close" onClick={() => setSelected(null)}>
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <details className="pw__more">
        <summary>about the target, the route and the curated context</summary>
      <div className="pw__fine">
        <dl className="fine">
          <dt>target</dt>
          <dd>
            {symbol ?? claims[0]?.node}
            {target && <span className="muted">, {compartmentSummary(target).join(', ') || 'location not annotated'}</span>}
          </dd>
          {target && (
            <>
              <dt>tractable as</dt>
              <dd>{tractabilitySummary(target).map((x) => `${x.modality}: ${x.bucket}`).join(', ')}</dd>
            </>
          )}
          {candidate.delivery && (
            <>
              <dt>route</dt>
              <dd>{candidate.delivery.route}</dd>
              <dt>reaches it through</dt>
              <dd>
                {candidate.delivery.barrier}
                {candidate.delivery.sources.length > 0 && (
                  <span className="muted">
                    {' '}
                    {candidate.delivery.sources.map((id, i) => {
                      const s = srcById.get(id)
                      return s ? (
                        <span key={id}>
                          {i > 0 ? ', ' : '('}
                          <a href={s.url} target="_blank" rel="noreferrer">
                            {s.first_author} {s.year}
                          </a>
                          {i === candidate.delivery!.sources.length - 1 ? ')' : ''}
                        </span>
                      ) : null
                    })}
                  </span>
                )}
              </dd>
            </>
          )}
          {pathways.length > 0 && (
            <>
              <dt>filed under</dt>
              <dd className="muted">
                {pathways
                  .slice(0, 4)
                  .map((p) => p.pathway)
                  .join(', ')}
                {pathways.length > 4 && `, and ${pathways.length - 4} more`}
              </dd>
            </>
          )}
        </dl>

        <figure className={`plate${plateOpen ? ' plate--open' : ''}`}>
          {plateSrc ? (
            <button type="button" className="plate__button" onClick={() => setPlateOpen((o) => !o)} aria-expanded={plateOpen} aria-label={plateOpen ? 'Shrink the diagram' : 'Enlarge the diagram'}>
              <img src={plateSrc} alt="" onError={onPlateError} />
            </button>
          ) : (
            <p className="muted text-sm">{status === 'loading' ? 'fetching the curated diagram' : 'no curated diagram reachable'}</p>
          )}
          <figcaption className="plate__caption">
            {plate.kind === 'reactome' && pathways[plate.i] && (
              <>
                {pathways[plate.i].pathway}, Reactome, {symbol} flagged.{' '}
                <a href={reactomeBrowserUrl(pathways[plate.i].pathwayId, symbol)} target="_blank" rel="noreferrer">
                  open
                </a>
              </>
            )}
            {plate.kind === 'string' && <>STRING neighbourhood of {genes.join(', ')}. Reactome has no diagram for these pathways.</>}
          </figcaption>
        </figure>
      </div>
      </details>
    </section>
  )
}
