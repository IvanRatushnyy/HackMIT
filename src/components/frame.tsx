/* elute — page frame: the shard, the wordmark, the header, the flow under it, the kicker, and the startup
 * context. */

import { createContext, useContext, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import shardSvg from '../../design/shard/shard.svg?raw'
import { GROUND_PLANES, parseShard } from '../lib/shard'
import { Stages, type StageId } from './Stages'

export const SHARD = parseShard(shardSvg)

/** How an instance of the mark is showing: composing plane by plane, composed, decomposing, or not there. */
export type ShardPhase = 'hidden' | 'in' | 'shown' | 'out'

/** The mark. Planes fade in from the topmost down to the bottommost and out from the bottommost up,
 * one --shard-stagger apart; the ground pieces sit a further --shard-ground-gap apart from each other.
 * `offsetY` crops the viewBox to the dense middle for the header band. */
export function Shard({
  className,
  offsetY = 0,
  phase = 'in',
  fit = 'xMidYMid slice',
}: {
  className?: string
  offsetY?: number
  phase?: ShardPhase
  fit?: string
}) {
  const { width, height } = SHARD.viewBox
  return (
    <div className={`shard shard--${phase}${className ? ` ${className}` : ''}`} aria-hidden="true" style={{ '--shard-n': SHARD.planes.length } as React.CSSProperties}>
      <svg viewBox={`0 ${offsetY} ${width} ${height}`} preserveAspectRatio={fit} xmlns="http://www.w3.org/2000/svg">
        {SHARD.planes.map((p, k) => {
          // How many ground gaps precede this plane: composing, the gaps come before the last ground pieces;
          // decomposing, after the first ones.
          const gapIn = Math.max(0, GROUND_PLANES - 1 - k)
          const gapOut = Math.min(k, GROUND_PLANES - 1)
          return <path key={k} d={p.d} fill={p.fill} style={{ '--k': k, '--gap-in': gapIn, '--gap-out': gapOut } as React.CSSProperties} />
        })}
      </svg>
    </div>
  )
}

/** True once the startup screen has lifted, or was skipped. The header band composes then, and the first
 * page's blocks arrive once the band has. */
export const StartupDone = createContext(true)

let bandComposed = false
/** The header band hides behind the startup screen, composes once when it lifts, and mounts composed on later pages. */
function useBandPhase(): ShardPhase {
  const ready = useContext(StartupDone)
  const [animate] = useState(() => !bandComposed)
  useEffect(() => {
    if (ready) bandComposed = true
  }, [ready])
  return !ready ? 'hidden' : animate ? 'in' : 'shown'
}

export function Wordmark() {
  return (
    <Link to="/" className="wordmark" aria-label="elute, home">
      elute
    </Link>
  )
}

/** The same header on every page: the wordmark (the way home; there is no search up here) centred in its
 * white block, then the shard band from the block's edge. Under it, centred, the four stages with the
 * current one in ink; they fade in after the band has composed, and at once on later pages. Each stage is
 * the way back to that part of the flow — `query`/`candidate`/`asof` are whatever this page already knows,
 * so a stage the page can't address (no candidate picked yet, say) stays plain, not a link. */
export function Header({ stage = 'ask', query, candidate, asof }: { stage?: StageId; query?: string; candidate?: string; asof?: string }) {
  const phase = useBandPhase()
  const suffix = asof ? `?asof=${asof}` : ''
  const hrefs: Partial<Record<StageId, string>> = { ask: '/' }
  if (query) hrefs.research = `/q/${query}`
  if (query && candidate) {
    hrefs.appraisal = `/q/${query}/${candidate}${suffix}`
    hrefs.share = `/q/${query}/${candidate}/export${suffix}`
  }
  return (
    <>
      <header className="header">
        <div className="header__block">
          <Wordmark />
        </div>
        <Shard className="header__shard" offsetY={280} phase={phase} />
      </header>
      <nav className={`flow flow--${phase}`} aria-label="Stages">
        <Stages current={stage} hrefs={hrefs} />
      </nav>
    </>
  )
}

export function Kicker({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={`kicker${className ? ` ${className}` : ''}`}>{children}</p>
}
