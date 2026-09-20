/* elute — the shard mark, read from the exported SVG into planes the components can animate one by one. */

export type Plane = { d: string; fill: string }

/** The dust ground is the first planes of the export, in two pieces that compose and decompose with their own spacing. */
export const GROUND_PLANES = 2
export type ShardMark = { viewBox: { width: number; height: number }; planes: Plane[] }

/** Planes in document order: index 0 is the bottommost, the last one is the topmost. */
export function parseShard(svg: string): ShardMark {
  const vb = /viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(svg)
  const planes: Plane[] = []
  for (const m of svg.matchAll(/<path\b([^>]*?)\/?>/g)) {
    const d = /\bd="([^"]+)"/.exec(m[1])?.[1]
    const fill = /\bfill="([^"]+)"/.exec(m[1])?.[1]
    if (d && fill) planes.push({ d, fill })
  }
  return { viewBox: { width: Number(vb?.[1] ?? 0), height: Number(vb?.[2] ?? 0) }, planes }
}
