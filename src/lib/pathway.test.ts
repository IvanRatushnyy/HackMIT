import { describe, expect, it } from 'vitest'
import { nilotinib } from '../fixtures/nilotinib'
import {
  chainGenes,
  compartmentSummary,
  edgeCuration,
  orderPathways,
  pathwaysMentioning,
  primaryTargets,
  reactomeDiagramUrl,
  stringNetworkUrl,
  tractabilitySummary,
  type DrugContext,
  type OTTarget,
} from './pathway'

const abl1: OTTarget = {
  id: 'ENSG00000097007',
  approvedSymbol: 'ABL1',
  pathways: [
    { pathwayId: 'R-HSA-428890', pathway: 'Role of ABL in ROBO-SLIT signaling', topLevelTerm: 'Developmental Biology' },
    { pathwayId: 'R-HSA-5693565', pathway: 'Recruitment and ATM-mediated phosphorylation of repair and signaling proteins at DNA double strand breaks', topLevelTerm: 'DNA Repair' },
    { pathwayId: 'R-HSA-9860927', pathway: 'Turbulent flow shear stress activates signaling by PIEZO1 and integrins in endothelial cells', topLevelTerm: 'Cellular responses to stimuli' },
  ],
  tractability: [
    { label: 'Approved Drug', modality: 'SM', value: true },
    { label: 'Druggable Family', modality: 'SM', value: true },
    { label: 'GO CC med conf', modality: 'AB', value: true },
    { label: 'Approved Drug', modality: 'AB', value: false },
    { label: 'Literature', modality: 'PR', value: true },
  ],
  subcellularLocations: [
    { location: 'Cytoplasm, cytoskeleton', source: 'uniprot' },
    { location: 'Nucleus', source: 'uniprot' },
    { location: 'Nucleoplasm', source: 'HPA_main' },
    { location: 'Mitochondrion', source: 'uniprot' },
    { location: 'Nucleus membrane; Lipid-anchor', source: 'uniprot' },
  ],
}
const bcr: OTTarget = { ...abl1, id: 'ENSG00000186716', approvedSymbol: 'BCR', pathways: [] }
const ctx: DrugContext = {
  name: 'NILOTINIB',
  fetched_at: '2026-09-19T00:00:00Z',
  mechanisms: [
    { mechanismOfAction: 'Tyrosine-protein kinase ABL inhibitor', actionType: 'INHIBITOR', targets: [abl1] },
    { mechanismOfAction: 'Bcr/Abl fusion protein inhibitor', actionType: 'INHIBITOR', targets: [abl1, bcr] },
  ],
}

describe('pathway layer', () => {
  it('lists distinct targets in first-appearance order', () => {
    expect(primaryTargets(ctx).map((t) => t.approvedSymbol)).toEqual(['ABL1', 'BCR'])
  })

  it('orders pathways by preferred top-level term, stable within a group', () => {
    const ids = orderPathways(abl1.pathways).map((p) => p.pathwayId)
    expect(ids[0]).toBe('R-HSA-9860927') // Cellular responses to stimuli is preferred
    expect(ids.slice(1)).toEqual(['R-HSA-428890', 'R-HSA-5693565'])
  })

  it('finds no curated pathway that mentions the Parkinson hypothesis', () => {
    expect(pathwaysMentioning(abl1.pathways, ['parkinson', 'synuclein', 'parkin'])).toEqual([])
  })

  it('marks only the drug → target link as curated by ChEMBL', () => {
    const claims = nilotinib.chain.claims
    expect(edgeCuration(claims[0], 0, [abl1]).kind).toBe('mechanism')
    expect(edgeCuration(claims[1], 1, [abl1])).toEqual({ kind: 'uncurated', text: 'not a curated pathway · 3 sources' })
    expect(edgeCuration(claims[0], 0, undefined).kind).toBe('uncurated') // offline: nothing is asserted as curated
  })

  it('collects the chain genes once each, in order', () => {
    expect(chainGenes(nilotinib.chain.claims)).toEqual(['ABL1', 'SNCA', 'PRKN'])
  })

  it('builds exporter and network URLs', () => {
    expect(reactomeDiagramUrl('R-HSA-428890', { flag: 'ABL1' })).toBe(
      'https://reactome.org/ContentService/exporter/diagram/R-HSA-428890.png?quality=5&diagramProfile=standard&flg=ABL1',
    )
    expect(stringNetworkUrl(['ABL1', 'SNCA'])).toContain('identifiers=ABL1%0DSNCA')
  })

  it('summarises tractability and compartment in Open Targets words', () => {
    expect(tractabilitySummary(abl1)).toEqual([
      { modality: 'small molecule', bucket: 'approved drug' },
      { modality: 'antibody', bucket: 'go cc med conf' },
      { modality: 'PROTAC', bucket: 'literature' },
    ])
    expect(compartmentSummary(abl1)).toEqual(['cytoplasm', 'nucleus', 'mitochondrion'])
  })
})

import { validateDrawing } from './pathway'

describe('pathway drawing', () => {
  it('nilotinib drawing resolves every reference and covers every claim', () => {
    expect(nilotinib.drawing).toBeDefined()
    expect(validateDrawing(nilotinib.drawing!, nilotinib.chain.claims)).toEqual([])
  })
  it('reports dangling references', () => {
    const bad = { compartments: [{ id: 'x', label: 'x' }], molecules: [{ id: 'm', label: 'm', kind: 'drug' as const, compartment: 'nope', at: [0.5, 1.5] as [number, number] }], actions: [{ id: 'a', from: 'm', to: 'zz', kind: 'inhibits' as const, word: 'w', claim: 'c9' }] }
    const p = validateDrawing(bad, nilotinib.chain.claims)
    expect(p).toContain('molecule m: unknown compartment nope')
    expect(p).toContain('molecule m: position outside the unit square')
    expect(p).toContain('action a: unknown molecule zz')
    expect(p).toContain('action a: unknown claim c9')
  })
})
