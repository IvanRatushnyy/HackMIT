/* elute — liquid-glass-js preset
 *
 * The library reads window.glassControls when each instance initialises,
 * with `||` fallbacks, so a value of 0 silently becomes the library default.
 * Use 0.001 instead of 0. Set this object before the first `new Container()`.
 *
 * These values give the "quiet instrument" feel: soft blur, a light tint so ink stays readable,
 * a rim a few pixels wide, almost no ripple. The refraction intensities are in texture units
 * (a fraction of the page width), so 0.01 at the very edge pulls in what sits about 15px outside
 * the shape and fades within a few pixels; the earlier 0.04 read as a second layer along the edge
 * when tried over a box on the flat page. Retune over the chain if a control ever floats there.
 */
window.glassControls = {
  blurRadius: 6,        // 1–15   background blur
  tintOpacity: 0.35,    // 0–1    white gradient tint; keep ≥ 0.3 for text contrast over the shard
  edgeIntensity: 0.004, // 0–0.1  refraction at the edge
  rimIntensity: 0.012,  // 0–0.2  rim light
  baseIntensity: 0.004, // 0–0.05 centre distortion, nearly none
  edgeDistance: 0.15,   // 0.05–0.5
  rimDistance: 0.8,     // 0.1–2
  baseDistance: 0.1,    // 0.05–0.3
  cornerBoost: 0.004,   // 0–0.1
  rippleEffect: 0.006   // 0–0.5  surface texture, kept very low
}
