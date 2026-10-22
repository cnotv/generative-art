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
