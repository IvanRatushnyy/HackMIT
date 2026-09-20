/* elute — the ground under every page: a slow mesh gradient in the brand's tints, drifting the way a
 * mixture drifts down a column. Fixed behind the page; every reading surface is glass over it. Still under
 * reduced motion, and a plain paper ground if WebGL is unavailable. */

import { MeshGradient } from '@paper-design/shaders-react'
import { useReducedMotion } from 'motion/react'

/* Paper-heavy, then the four colours as tints: slate, raspberry, dust, and a deeper slate for depth. */
const COLORS = ['#fbfcfe', '#b9cbda', '#e8c6d4', '#dcdde3', '#f6f7fa', '#9db3c4', '#f1e4ea']

export function Ground() {
  const reduce = useReducedMotion()
  return (
    <div className="ground" aria-hidden="true">
      <MeshGradient colors={COLORS} distortion={0.9} swirl={0.25} speed={reduce ? 0 : 0.12} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
