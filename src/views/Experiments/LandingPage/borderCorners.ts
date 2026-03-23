import * as THREE from 'three';

const CORNER_ARM_LENGTH = 1.2;

/**
 * Creates 4 L-shaped corner decorations at the edges of the given rect.
 * halfWidth/halfHeight are world-space half-extents of the viewport at the panel depth.
 */
export const createBorderCorners = (
  halfWidth: number,
  halfHeight: number,
): THREE.LineSegments => {
  const arm = CORNER_ARM_LENGTH;
  const x = halfWidth;
  const y = halfHeight;

  // Each corner: horizontal arm + vertical arm
  // prettier-ignore
  const positions = new Float32Array([
    // Top-left
    -x,       y,       0,  -x + arm, y,       0,
    -x,       y,       0,  -x,       y - arm, 0,
    // Top-right
     x,       y,       0,   x - arm, y,       0,
     x,       y,       0,   x,       y - arm, 0,
    // Bottom-left
    -x,      -y,       0,  -x + arm,-y,       0,
    -x,      -y,       0,  -x,      -y + arm, 0,
    // Bottom-right
     x,      -y,       0,   x - arm,-y,       0,
     x,      -y,       0,   x,      -y + arm, 0,
  ]);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.LineBasicMaterial({ color: 0xaaaaaa });
  return new THREE.LineSegments(geometry, material);
};
