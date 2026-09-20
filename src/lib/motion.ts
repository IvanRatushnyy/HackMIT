/* elute — shared motion vocabulary for the Motion library (motion/react).
 * Durations and curves match the tokens in design/tokens/space.css. Every animated surface asks
 * `useReducedMotion` from motion/react and passes `reduce` to these helpers, which then collapse to nothing. */

import type { TargetAndTransition, Transition, Variants } from 'motion/react'

export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1]
export const EASE_IN_OUT: [number, number, number, number] = [0.65, 0, 0.35, 1]

export const FAST = 0.12
export const BASE = 0.24
export const SLOW = 0.4
export const ARRIVE = 0.64

/** A block arriving: soft and slightly large, settling to size. */
export function arrive(reduce: boolean | null, delay = 0): { initial: false | TargetAndTransition; animate: TargetAndTransition; transition: Transition } {
  if (reduce) return { initial: false, animate: {}, transition: { duration: 0 } }
  return {
    initial: { opacity: 0, scale: 1.02, filter: 'blur(6px)' },
    animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
    transition: { duration: ARRIVE, ease: EASE_OUT, delay },
  }
}

/** Rows fading in, staggered by 40ms, as children of a parent with `variants={stagger}`. */
export const stagger: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.04 } },
}
export const row: Variants = {
  hidden: { opacity: 0, y: 4 },
  shown: { opacity: 1, y: 0, transition: { duration: BASE, ease: EASE_OUT } },
}

/** An item that enters and leaves a list (AnimatePresence). */
export const presence = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: SLOW, ease: EASE_OUT } },
  exit: { opacity: 0, y: -4, transition: { duration: BASE, ease: EASE_IN_OUT } },
}
