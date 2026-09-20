/* elute — the landing illustration: a capsule coming apart into molecules, drawn as ink outline with flat
 * grey wash, over a speckle halo. Hand-authored SVG in the style of a monochrome editorial drawing. */

const INK = '#474747'
const WASH = '#6f6f6f'
const WASH_LIGHT = '#c9c7c1'
const PAPER = '#e6e4df'

function Ring({ x, y, r, rot = 0 }: { x: number; y: number; r: number; rot?: number }) {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i + Math.PI / 6
    return [x + r * Math.cos(a), y + r * Math.sin(a)] as const
  })
  const d = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ') + ' Z'
  // Inner double-bond marks on alternating edges
  const inner = [0, 2, 4].map((i) => {
    const [ax, ay] = pts[i]
    const [bx, by] = pts[(i + 1) % 6]
    const k = 0.78
    return `M${(x + (ax - x) * k).toFixed(1)} ${(y + (ay - y) * k).toFixed(1)} L${(x + (bx - x) * k).toFixed(1)} ${(y + (by - y) * k).toFixed(1)}`
  })
  return (
    <g transform={`rotate(${rot} ${x} ${y})`}>
      <path d={d} transform="translate(6 5)" fill={WASH} opacity="0.85" />
      <path d={d} transform="translate(-2 9)" fill={WASH_LIGHT} />
      <path d={d} fill={PAPER} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={INK} strokeWidth="1.5" opacity="0.35" transform="translate(-4 3)" />
      {inner.map((p) => (
        <path key={p} d={p} fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      ))}
    </g>
  )
}

export function Molecule({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 640 720" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <filter id="mol-grain" x="0" y="0" width="1" height="1">
          <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="2" seed="7" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.3  0 0 0 0 0.3  0 0 0 0 0.3  0 0 0 14 -8.6" />
        </filter>
        <radialGradient id="mol-fade" cx="50%" cy="58%" r="46%">
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id="mol-halo">
          <rect width="640" height="720" fill="url(#mol-fade)" />
        </mask>
      </defs>

      {/* Speckle halo behind the subject */}
      <rect width="640" height="720" filter="url(#mol-grain)" mask="url(#mol-halo)" opacity="0.8" />

      {/* Bonds from the capsule out to the rings */}
      <g fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M262 318 L214 286 L196 240" />
        <path d="M232 268 L214 286" opacity="0.5" />
        <path d="M372 250 L420 226 L438 182" />
        <path d="M418 200 L438 182" opacity="0.5" />
        <path d="M132 176 L122 168" />
        <path d="M536 108 L560 80" />
      </g>

      {/* Rings */}
      <Ring x={158} y={198} r={42} rot={8} />
      <Ring x={484} y={140} r={34} rot={-12} />
      <Ring x={118} y={150} r={20} rot={20} />
      <Ring x={578} y={56} r={18} rot={-30} />

      {/* Free atoms */}
      <g fill={INK}>
        <circle cx="300" cy="120" r="5" />
        <circle cx="352" cy="92" r="3.5" opacity="0.7" />
        <circle cx="60" cy="300" r="4" opacity="0.6" />
        <circle cx="596" cy="250" r="3.5" opacity="0.6" />
      </g>

      {/* The capsule */}
      <g transform="translate(316 470) rotate(-28)">
        <path d="M -56 -96 a 60 60 0 0 1 120 0 v 100 h -120 z" transform="translate(5 5)" fill={WASH} />
        <path d="M -60 0 h 120 v 100 a 60 60 0 0 1 -120 0 z" transform="translate(-2 8)" fill={WASH_LIGHT} />
        <path d="M -60 -100 a 60 60 0 0 1 120 0 v 200 a 60 60 0 0 1 -120 0 z" fill="none" stroke={INK} strokeWidth="1.6" opacity="0.35" transform="translate(-6 4)" />
        <path d="M -60 -100 a 60 60 0 0 1 120 0 v 200 a 60 60 0 0 1 -120 0 z" fill="none" stroke={INK} strokeWidth="3.2" strokeLinejoin="round" />
        <rect x="-40" y="-126" width="14" height="88" rx="7" fill={PAPER} />
        <path d="M -60 0 h 120" stroke={INK} strokeWidth="2.8" />
        <path d="M -58 8 q 60 10 118 -2" fill="none" stroke={INK} strokeWidth="1.4" opacity="0.4" />
        <path d="M 12 40 q 30 10 34 46" fill="none" stroke={PAPER} strokeWidth="6" strokeLinecap="round" opacity="0.9" />
      </g>

      {/* Ground shadow */}
      <ellipse cx="316" cy="672" rx="150" ry="14" fill={INK} opacity="0.18" />
    </svg>
  )
}
