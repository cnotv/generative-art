/**
 * Half the width and height the hero's orthographic camera sees for a screen shape. It shows a
 * fixed height, except on a narrow screen such as an upright phone, where it widens to a minimum
 * width instead and grows taller to match, so the logo and its letters are never cut at the sides.
 * @param aspect Screen width over height.
 * @param height The height the camera shows on a wide screen.
 * @param minimumWidth The narrowest the view may be.
 * @returns Half the view's width and half its height, in scene units.
 */
export const getHeroFrustum = (
  aspect: number,
  height: number,
  minimumWidth: number
): { halfWidth: number; halfHeight: number } => {
  const halfHeight = Math.max(height, minimumWidth / aspect) / 2
  return { halfWidth: halfHeight * aspect, halfHeight }
}

const smoothstep = (from: number, to: number, value: number): number => {
  const share = Math.min(1, Math.max(0, (value - from) / (to - from)))
  return share * share * (3 - 2 * share)
}

/**
 * How the hero fades as the page scrolls past it: its lights dim first, then a cover in the next
 * section's colour closes over it, so the hero dissolves into the page below.
 * @param scrolled How far the page has scrolled, in pixels.
 * @param heroHeight The hero's height, in pixels.
 * @param dimming How much of the light is gone once the hero has scrolled away, from 0 to 1.
 * @returns The share of the lights still on, and how opaque the cover is.
 */
export const getHeroScrollFade = (
  scrolled: number,
  heroHeight: number,
  dimming: number
): { light: number; cover: number } => {
  const share = heroHeight > 0 ? scrolled / heroHeight : 0
  return {
    light: 1 - dimming * smoothstep(0, 0.7, share),
    cover: smoothstep(0.2, 0.95, share)
  }
}
