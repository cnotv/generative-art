import * as THREE from 'three'

const BLADE_SEGMENTS = 4
const BLADE_HEIGHT = 1.1
const BLADE_BASE_WIDTH = 0.06

/**
 * A single blade, standing along local +Y with its base pinned at the origin: a strip of
 * `BLADE_SEGMENTS` quads tapering to a point, so wind can bend the upper rows while the base
 * stays planted. `windWeight` grows toward the tip (quadratically, so the bend eases in rather
 * than kinking at the base) for the wind shader below to scale its sway by.
 */
const createGrassBladeGeometry = (): THREE.BufferGeometry => {
  const rowFractions = Array.from({ length: BLADE_SEGMENTS + 1 }, (_, row) => row / BLADE_SEGMENTS)
  const positions = rowFractions.flatMap((fraction) => {
    const y = fraction * BLADE_HEIGHT
    const halfWidth = (BLADE_BASE_WIDTH / 2) * (1 - fraction)
    return [-halfWidth, y, 0, halfWidth, y, 0]
  })
  const windWeights = rowFractions.flatMap((fraction) => [fraction * fraction, fraction * fraction])
  const indices = Array.from({ length: BLADE_SEGMENTS }, (_, row) => {
    const base = row * 2
    return [base, base + 1, base + 2, base + 1, base + 3, base + 2]
  }).flat()

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('windWeight', new THREE.Float32BufferAttribute(windWeights, 1))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/**
 * A standard PBR material with a wind sway and a per-instance cut state spliced into its
 * vertex stage via `onBeforeCompile`, so grass still shades and lights exactly like any other
 * `MeshStandardMaterial` and only its vertex positions are touched.
 */
const createGrassMaterial = (): THREE.MeshStandardMaterial => {
  const material = new THREE.MeshStandardMaterial({
    color: 0x6fae5c,
    roughness: 0.85,
    side: THREE.DoubleSide
  })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 }
    material.userData.shader = shader
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float windWeight;
        attribute float instancePhase;
        attribute float instanceCut;
        uniform float uTime;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float windTime = uTime + instancePhase;
        // Two very different periods layered together read as a soft, irregular gust rather
        // than a metronomic sway.
        float gust = sin(windTime * 0.6) * 0.5 + sin(windTime * 0.23 + instancePhase) * 0.3;
        float sway = gust * windWeight * 0.35;
        transformed.x += sway;
        transformed.z += sway * 0.4;
        transformed.y *= 1.0 - instanceCut;`
      )
  }
  return material
}

export interface GrassFieldBounds {
  halfWidth: number
  y: { min: number; max: number }
  depthRange: [number, number]
}

export interface GrassFieldSystem {
  update: (timeSeconds: number) => void
  /** Marks every blade within `radius` of `point` as cut. Returns whether anything changed,
   * so the caller need not track that itself. */
  cutNear: (point: THREE.Vector3, radius: number) => boolean
  dispose: () => void
}

export const createGrassField = (
  scene: THREE.Scene,
  bladeCount: number,
  bounds: GrassFieldBounds
): GrassFieldSystem => {
  const geometry = createGrassBladeGeometry()
  const material = createGrassMaterial()
  const mesh = new THREE.InstancedMesh(geometry, material, bladeCount)
  mesh.frustumCulled = false
  scene.add(mesh)

  const indices = Array.from({ length: bladeCount }, (_, index) => index)
  const bladeX = Float32Array.from(indices, () => (Math.random() * 2 - 1) * bounds.halfWidth)
  const bladeY = Float32Array.from(
    indices,
    () => bounds.y.min + Math.random() * (bounds.y.max - bounds.y.min)
  )
  const bladeZ = Float32Array.from(
    indices,
    () => bounds.depthRange[0] + Math.random() * (bounds.depthRange[1] - bounds.depthRange[0])
  )
  const phaseAttribute = new THREE.InstancedBufferAttribute(
    Float32Array.from(indices, () => Math.random() * Math.PI * 2),
    1
  )
  const cutAttribute = new THREE.InstancedBufferAttribute(new Float32Array(bladeCount), 1)
  geometry.setAttribute('instancePhase', phaseAttribute)
  geometry.setAttribute('instanceCut', cutAttribute)

  const transformMatrix = new THREE.Matrix4()
  const position = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()
  const scale = new THREE.Vector3()
  const euler = new THREE.Euler()
  indices.forEach((index) => {
    position.set(bladeX[index], bladeY[index], bladeZ[index])
    euler.set(0, Math.random() * Math.PI * 2, 0)
    quaternion.setFromEuler(euler)
    const bladeScale = 0.7 + Math.random() * 0.6
    scale.set(bladeScale, bladeScale, bladeScale)
    transformMatrix.compose(position, quaternion, scale)
    mesh.setMatrixAt(index, transformMatrix)
  })
  mesh.instanceMatrix.needsUpdate = true

  const update = (timeSeconds: number): void => {
    const shader = material.userData.shader as
      | { uniforms: { uTime: { value: number } } }
      | undefined
    if (shader) shader.uniforms.uTime.value = timeSeconds
  }

  const cutNear = (point: THREE.Vector3, radius: number): boolean => {
    const radiusSquared = radius * radius
    let changed = false
    indices.forEach((index) => {
      if (cutAttribute.getX(index) === 1) return
      const dx = bladeX[index] - point.x
      const dy = bladeY[index] - point.y
      const dz = bladeZ[index] - point.z
      if (dx * dx + dy * dy + dz * dz > radiusSquared) return
      cutAttribute.setX(index, 1)
      changed = true
    })
    if (changed) cutAttribute.needsUpdate = true
    return changed
  }

  const dispose = (): void => {
    scene.remove(mesh)
    geometry.dispose()
    material.dispose()
  }

  return { update, cutNear, dispose }
}
