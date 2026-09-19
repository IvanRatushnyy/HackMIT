/* elute — liquid-glass-js preset
 *
 * The library reads window.glassControls when each instance initialises,
 * with `||` fallbacks, so a value of 0 silently becomes the library default.
 * Use 0.001 instead of 0. Set this object before the first `new Container()`.
 *
 * These values are a starting point for the "quiet instrument" feel:
 * soft blur, a light tint so ink stays readable, almost no ripple.
 * Tune them in the browser over the real shard hero and chain before shipping.
 */
window.glassControls = {
  blurRadius: 6,        // 1–15   background blur
  tintOpacity: 0.35,    // 0–1    white gradient tint; keep ≥ 0.3 for text contrast
  edgeIntensity: 0.012, // 0–0.1  refraction at the edge
  rimIntensity: 0.04,   // 0–0.2  rim light
  baseIntensity: 0.004, // 0–0.05 centre distortion, nearly none
  edgeDistance: 0.15,   // 0.05–0.5
  rimDistance: 0.8,     // 0.1–2
  baseDistance: 0.1,    // 0.05–0.3
  cornerBoost: 0.01,    // 0–0.1
  rippleEffect: 0.02    // 0–0.5  surface texture, kept very low
}
