/* Ambient types for the vendored liquid-glass-js globals.
 * Add this file to the app's tsconfig "include" (or reference it from a .d.ts). */

type GlassShape = 'rounded' | 'circle' | 'pill'

interface GlassContainerOptions {
  borderRadius?: number
  type?: GlassShape
  tintOpacity?: number
}

interface GlassButtonOptions extends GlassContainerOptions {
  text?: string
  size?: number
  onClick?: (text: string) => void
  warp?: boolean
}

declare class Container {
  static instances: Container[]
  static pageSnapshot: HTMLCanvasElement | null
  static isCapturing: boolean
  element: HTMLDivElement
  canvas: HTMLCanvasElement
  children: Container[]
  parent: Container | null
  constructor(options?: GlassContainerOptions)
  addChild<T extends Container>(child: T): T
  removeChild(child: Container): void
  updateSizeFromDOM(): void
  capturePageSnapshot(): void
  render?(): void
}

declare class Button extends Container {
  text: string
  constructor(options?: GlassButtonOptions)
}

interface Window {
  html2canvas: typeof import('html2canvas').default
  glassControls?: {
    blurRadius?: number
    tintOpacity?: number
    edgeIntensity?: number
    rimIntensity?: number
    baseIntensity?: number
    edgeDistance?: number
    rimDistance?: number
    baseDistance?: number
    cornerBoost?: number
    rippleEffect?: number
  }
}
