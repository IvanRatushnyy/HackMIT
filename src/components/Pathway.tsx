/* elute — Pathway: the hypothesis drawn as biology, with the curated context around it.
 *
 * The drawing (when the record has one) puts the drug in the blood, the barrier it must cross, the
 * molecules it acts on in the brain, and the outcome in the patient. Every action that belongs to the
 * hypothesis points at a chain claim, so its line weight and label come from the evidence rules and
 * selecting it opens that claim's evidence. Actions without a claim are background biology, drawn in
 * grey. Records without a drawing get the chain as a linear graph.
 *
 * Beside it: Reactome's own diagram of a pathway the target is actually filed under, muted, the target
 * flagged. Under it: the fine print — where the target sits, whether it is tractable, the route, and what
 * the drug has to cross. Open Targets and Reactome are fetched live; the drawing needs no network. */

import { useEffect, useMemo, useRef, useState } from 'react'
import cytoscape from 'cytoscape'
import type { ActionKind, CandidateDetail, Cutoff, Label } from '../data/types'
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
import { ClaimEvidence } from './detail'
import { EvidenceLabel } from './evidence'
import { Kicker } from './frame'

type Status = 'loading' | 'live' | 'offline' | 'none'
type Plate = { kind: 'reactome'; i: number } | { kind: 'string' } | { kind: 'none' }

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/** Cytoscape cannot parse oklch(); the browser can. Paint one pixel and read it back as rgb(). */
const colorCache = new Map<string, string>()
function cssColor(name: string): string {
  const raw = cssVar(name)
  const hit = colorCache.get(raw)
  if (hit) return hit
  let out = raw
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const c = canvas.getContext('2d', { willReadFrequently: true })
  if (c) {
    c.fillStyle = raw
    c.fillRect(0, 0, 1, 1)
    const [r, g, b] = c.getImageData(0, 0, 1, 1).data
    out = `rgb(${r}, ${g}, ${b})`
  }
  colorCache.set(raw, out)
  return out
}

const EDGE: Record<Label, { width: number; style: 'solid' | 'dashed' | 'dotted'; dash: number[] }> = {
  established: { width: 3, style: 'solid', dash: [1, 0] },
  contested: { width: 2, style: 'dashed', dash: [8, 6] },
  'single-source': { width: 2, style: 'dashed', dash: [3, 5] },
  unknown: { width: 1.5, style: 'dotted', dash: [1, 4] },
  refuted: { width: 2, style: 'solid', dash: [1, 0] },
}

/** The glyph at the head of an action: a bar for inhibition, a circle for phosphorylation, a diamond for transport. */
const ARROW: Record<ActionKind, 'tee' | 'circle' | 'diamond' | 'triangle'> = {
  inhibits: 'tee',
  prevents: 'tee',
  phosphorylates: 'circle',
  crosses: 'diamond',
  activates: 'triangle',
  promotes: 'triangle',
  improves: 'triangle',
  causes: 'triangle',
}

export function Pathway({ candidate, cutoff, sourcesHref }: { candidate: CandidateDetail; cutoff: Cutoff; sourcesHref: string }) {
  const [ctx, setCtx] = useState<DrugContext | undefined>()
  const [status, setStatus] = useState<Status>(candidate.chembl_id ? 'loading' : 'none')
  const [plate, setPlate] = useState<Plate>({ kind: 'none' })
  const [selected, setSelected] = useState<string | null>(null)
  const graphRef = useRef<HTMLDivElement>(null)

  const claims = candidate.chain.claims
  const drawing = candidate.drawing
  const labels = useMemo(() => {
    const m = new Map<string, LabelResult>()
    for (const k of claims) m.set(k.id, deriveLabel(k, candidate.sources, cutoff.date))
    return m
  }, [claims, candidate.sources, cutoff.date])
  const weak = resolveTimeline(candidate.weakest_link, cutoff.date)
  const targets = ctx ? primaryTargets(ctx) : []
  const target = targets[0]
  const pathways: OTPathway[] = target ? orderPathways(target.pathways) : []
  const genes = chainGenes(claims)
  const srcById = new Map(candidate.sources.map((s) => [s.id, s]))
  const current = selected ? claims.find((k) => k.id === selected) : undefined
  const currentLabel = current ? labels.get(current.id) : undefined

  useEffect(() => {
    setSelected(null)
  }, [cutoff.id, candidate.slug])

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

  // Draw. Every colour and face is read from the design tokens so the graph cannot drift from the page.
  useEffect(() => {
    const el = graphRef.current
    if (!el) return
    const ink = cssColor('--color-ink'),
      muted = cssColor('--color-ink-muted'),
      faint = cssColor('--color-ink-faint'),
      line = cssColor('--color-line'),
      lineStrong = cssColor('--color-line-strong'),
      surface = cssColor('--color-surface'),
      sunken = cssColor('--color-surface-sunken'),
      selectedBg = cssColor('--color-surface-selected'),
      display = cssVar('--font-display'),
      text = cssVar('--font-text')
    const tone: Record<Label, string> = {
      established: cssColor('--evidence-established'),
      contested: cssColor('--evidence-contested'),
      'single-source': cssColor('--evidence-single-source'),
      unknown: cssColor('--evidence-unknown'),
      refuted: cssColor('--evidence-refuted'),
    }

    const W = el.clientWidth || 960
    const H = el.clientHeight || 340
    const elements: cytoscape.ElementDefinition[] = []

    if (drawing) {
      const PADX = 72,
        TOP = 84,
        BOTTOM = H - 44
      for (const c of drawing.compartments) elements.push({ data: { id: `comp-${c.id}`, label: c.label }, classes: 'comp' })
      for (const m of drawing.molecules)
        elements.push({
          data: { id: m.id, label: m.label, parent: `comp-${m.compartment}` },
          classes: `mol mol--${m.kind}`,
          position: { x: PADX + m.at[0] * (W - PADX * 2), y: TOP + m.at[1] * (BOTTOM - TOP) },
        })
      for (const a of drawing.actions) {
        const r = a.claim ? labels.get(a.claim) : undefined
        const spec = r ? EDGE[r.label] : { width: 1.5, style: 'solid' as const, dash: [1, 0] }
        const isWeak = !!a.claim && weak?.claim === a.claim
        const cls = ['act', r ? 'hyp' : 'bg', a.arc ? 'arc' : '', selected && a.claim === selected ? 'on' : '', selected && a.claim !== selected ? 'off' : '']
          .filter(Boolean)
          .join(' ')
        elements.push({
          data: {
            id: a.id,
            source: a.from,
            target: a.to,
            claim: a.claim ?? '',
            label: r ? `${a.word}\n${r.label}${isWeak ? ' · weakest link' : ''}` : a.word,
            color: r ? tone[r.label] : lineStrong,
            width: spec.width,
            style: spec.style,
            dash: spec.dash,
            arrow: ARROW[a.kind],
            arc: a.arc ?? 0,
          },
          classes: cls,
        })
      }
    } else {
      // No drawing: the chain as a line of nodes, the target's curated pathways beneath it.
      const PAD = 56
      const STEP = (W - PAD * 2) / claims.length
      const ROW = target ? 96 : H / 2
      elements.push({ data: { id: 'drug', label: candidate.chain.drug }, classes: 'mol mol--drug', position: { x: PAD, y: ROW } })
      claims.forEach((k, i) => {
        const r = labels.get(k.id)!
        const cur = edgeCuration(k, i, ctx ? targets : undefined)
        const spec = EDGE[r.label]
        elements.push({ data: { id: k.id, label: k.node }, classes: 'mol mol--protein', position: { x: PAD + (i + 1) * STEP, y: ROW } })
        elements.push({
          data: {
            id: `e-${k.id}`,
            source: i === 0 ? 'drug' : claims[i - 1].id,
            target: k.id,
            claim: k.id,
            label: `${r.label}${weak?.claim === k.id ? ' · weakest link' : ''}\n${cur.kind === 'mechanism' ? 'ChEMBL mechanism' : 'not curated'}`,
            color: tone[r.label],
            width: spec.width,
            style: spec.style,
            dash: spec.dash,
            arrow: 'triangle',
            arc: 0,
          },
          classes: ['act', 'hyp', selected === k.id ? 'on' : '', selected && selected !== k.id ? 'off' : ''].filter(Boolean).join(' '),
        })
      })
      if (target) {
        const anchor = claims.find((k) => (k.genes ?? []).includes(target.approvedSymbol))
        const shown = pathways.slice(0, 4)
        if (anchor && shown.length) {
          const ax = PAD + (claims.indexOf(anchor) + 1) * STEP
          const CW = Math.min(150, (W - PAD) / shown.length)
          shown.forEach((p, j) => {
            const id = `p-${p.pathwayId}`
            const x = Math.min(W - CW / 2 - 8, Math.max(CW / 2 + 8, ax + (j - (shown.length - 1) / 2) * CW))
            elements.push({ data: { id, label: p.pathway.length > 40 ? p.pathway.slice(0, 38) + '…' : p.pathway }, classes: 'context', position: { x, y: ROW + 128 } })
            elements.push({ data: { id: `ce-${id}`, source: anchor.id, target: id }, classes: 'context-edge' })
          })
        }
      }
    }

    const cy = cytoscape({
      container: el,
      elements,
      layout: { name: 'preset', fit: false },
      zoom: 1,
      pan: { x: 0, y: 0 },
      userZoomingEnabled: false,
      userPanningEnabled: false,
      boxSelectionEnabled: false,
      autoungrabify: true,
      autounselectify: true,
      style: [
        {
          selector: 'node.mol',
          style: {
            shape: 'round-rectangle',
            width: 'label',
            height: 34,
            'padding-left': '12px',
            'padding-right': '12px',
            'background-color': surface,
            'border-width': 1,
            'border-color': ink,
            label: 'data(label)',
            'font-family': display,
            'font-size': 14,
            color: ink,
            'text-valign': 'center',
            'text-halign': 'center',
            'text-wrap': 'wrap',
            'text-max-width': '120px',
          },
        },
        { selector: 'node.mol--drug', style: { shape: 'rectangle', 'border-width': 2 } },
        { selector: 'node.mol--process', style: { 'border-style': 'dashed', 'font-family': text, 'font-size': 12, color: muted } },
        {
          selector: 'node.mol--cell',
          style: { shape: 'rectangle', 'background-color': sunken, 'border-color': lineStrong, 'font-family': text, 'font-size': 12, height: 'label', 'padding-top': '8px', 'padding-bottom': '8px' },
        },
        { selector: 'node.mol--outcome', style: { shape: 'rectangle', 'background-color': sunken, 'font-size': 13, height: 'label', 'padding-top': '8px', 'padding-bottom': '8px' } },
        {
          selector: 'node.comp',
          style: {
            shape: 'rectangle',
            'background-color': sunken,
            'background-opacity': 0.5,
            'border-width': 1,
            'border-color': line,
            padding: '22px',
            label: 'data(label)',
            'font-family': text,
            'font-size': 10,
            'text-transform': 'uppercase',
            color: faint,
            'text-valign': 'top',
            'text-halign': 'center',
            'text-margin-y': -6,
          },
        },
        {
          selector: 'node.context',
          style: {
            shape: 'round-rectangle',
            'background-color': sunken,
            'border-width': 1,
            'border-color': line,
            color: muted,
            label: 'data(label)',
            'font-family': text,
            'font-size': 10,
            'text-wrap': 'wrap',
            'text-max-width': '120px',
            'text-valign': 'center',
            'text-halign': 'center',
            width: 128,
            height: 'label',
            'padding-top': '6px',
            'padding-bottom': '6px',
          },
        },
        {
          selector: 'edge.act',
          style: {
            'curve-style': 'straight',
            width: 'data(width)',
            'line-color': 'data(color)',
            'line-style': (e: cytoscape.EdgeSingular) => e.data('style'),
            'line-dash-pattern': ((e: cytoscape.EdgeSingular) => e.data('dash')) as unknown as number[],
            'target-arrow-shape': (e: cytoscape.EdgeSingular) => e.data('arrow'),
            'target-arrow-color': 'data(color)',
            'target-arrow-fill': 'filled',
            'arrow-scale': 0.9,
            label: 'data(label)',
            'font-family': text,
            'font-size': 10,
            color: muted,
            'text-wrap': 'wrap',
            'text-background-color': surface,
            'text-background-opacity': 1,
            'text-background-padding': '3px',
            'text-rotation': 'autorotate',
          },
        },
        { selector: 'edge.hyp', style: { color: ink } },
        { selector: 'edge.bg', style: { color: faint, 'font-size': 9 } },
        {
          selector: 'edge.arc',
          style: { 'curve-style': 'unbundled-bezier', 'control-point-distances': (e: cytoscape.EdgeSingular) => [e.data('arc')], 'control-point-weights': [0.5] as unknown as number, 'text-rotation': 'none' },
        },
        { selector: 'edge.on', style: { width: (e: cytoscape.EdgeSingular) => e.data('width') + 1.5, 'text-background-color': selectedBg } },
        { selector: 'edge.off', style: { opacity: 0.35 } },
        {
          selector: 'edge.context-edge',
          style: { 'curve-style': 'straight', width: 1, 'line-style': 'dotted', 'line-dash-pattern': [1, 3], 'line-color': lineStrong, 'target-arrow-shape': 'none', label: '' },
        },
      ],
    })
    cy.on('tap', 'edge.act', (evt) => {
      const claim = evt.target.data('claim') as string
      if (claim) setSelected((s) => (s === claim ? null : claim))
    })
    cy.on('tap', (evt) => {
      if (evt.target === cy) setSelected(null)
    })
    const onResize = () => cy.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      cy.destroy()
    }
  }, [drawing, claims, labels, ctx, targets, pathways, weak?.claim, candidate.slug, candidate.chain.drug, selected, target])

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
  const filed = target ? orderPathways(target.pathways) : []

  return (
    <section className="section" aria-labelledby="pathway">
      <div className="section__title">
        <h2 className="display-xs" id="pathway">
          pathway
        </h2>
        <span className="pathway__status">
          {status === 'live' && `live · open targets and reactome · ${fetched}`}
          {status === 'loading' && 'asking open targets…'}
          {status === 'offline' && 'open targets unreachable · hypothesis only'}
          {status === 'none' && 'hypothesis only'}
        </span>
      </div>

      <div
        ref={graphRef}
        className={`pathway__graph${drawing ? ' pathway__graph--drawing' : ''}`}
        role="img"
        aria-label={
          drawing
            ? `Pathway drawing: ${drawing.actions.map((a) => `${drawing.molecules.find((m) => m.id === a.from)?.label} ${a.word} ${drawing.molecules.find((m) => m.id === a.to)?.label}`).join('; ')}`
            : `Hypothesis chain: ${candidate.chain.drug} → ${claims.map((k) => k.node).join(' → ')}`
        }
      />

      {current && currentLabel && (
        <div className="panel claim-panel rise" key={current.id + cutoff.id}>
          <div className="claim-panel__col">
            <Kicker>claim</Kicker>
            <p className="claim-panel__text">{current.text}</p>
            <p>
              <EvidenceLabel label={currentLabel.label} qualifier={currentLabel.qualifier} />
            </p>
            <p className="cell__sub">{currentLabel.why}</p>
            {weak?.claim === current.id && (
              <p className="cell__sub critical">
                <span className="medium">weakest link</span> — {weak.why}
              </p>
            )}
          </div>
          <div className="claim-panel__col">
            <Kicker>evidence</Kicker>
            <ClaimEvidence r={currentLabel} sourcesHref={sourcesHref} />
          </div>
        </div>
      )}

      <div className="pathway__grid">
        <div className="pathway__left">
          <dl className="pathway__fine">
            <dt>target</dt>
            <dd>
              {symbol ?? claims[0]?.node}
              {target && ` · ${compartmentSummary(target).join(', ') || 'location not annotated'}`}
            </dd>
            {target && (
              <>
                <dt>tractable as</dt>
                <dd>{tractabilitySummary(target).map((x) => `${x.modality}: ${x.bucket}`).join(' · ')}</dd>
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
                    <span className="cell__sub">
                      {' '}
                      ·{' '}
                      {candidate.delivery.sources.map((id, i) => {
                        const s = srcById.get(id)
                        return s ? (
                          <span key={id}>
                            {i > 0 && ', '}
                            <a href={s.url} target="_blank" rel="noreferrer">
                              {s.first_author} {s.year}
                            </a>
                          </span>
                        ) : null
                      })}
                    </span>
                  )}
                </dd>
              </>
            )}
            {filed.length > 0 && (
              <>
                <dt>filed under</dt>
                <dd className="cell__sub">
                  {filed
                    .slice(0, 4)
                    .map((p) => p.pathway)
                    .join(' · ')}
                  {filed.length > 4 && ` · and ${filed.length - 4} more`}
                </dd>
              </>
            )}
          </dl>
        </div>

        <figure className="pathway__plate">
          {plateSrc ? (
            <img src={plateSrc} alt="" onError={onPlateError} />
          ) : (
            <p className="cell__sub">{status === 'loading' ? 'fetching the curated diagram…' : 'No curated diagram reachable.'}</p>
          )}
          <figcaption className="pathway__caption">
            {plate.kind === 'reactome' && pathways[plate.i] && (
              <>
                Where {symbol} is filed in curated biology · Reactome · {pathways[plate.i].pathway} ·{' '}
                <a href={reactomeBrowserUrl(pathways[plate.i].pathwayId, symbol)} target="_blank" rel="noreferrer">
                  open
                </a>
              </>
            )}
            {plate.kind === 'string' && <>STRING · interaction neighbourhood of {genes.join(', ')} · Reactome has no diagram for these pathways</>}
            {plate.kind === 'none' && status !== 'loading' && <>curated context unavailable</>}
          </figcaption>
        </figure>
      </div>
    </section>
  )
}

