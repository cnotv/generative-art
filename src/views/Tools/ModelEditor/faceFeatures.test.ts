import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { applyFaceFeatures, createFaceSettings, featuresInFace, measureFace } from './faceFeatures'

/**
 * A round head two units tall, from its chin at the head bone up to the crown bone, facing +Z
 * like the Mixamo characters. A plain mesh hung below the head bone, the way separate eyes and
 * heads often are, so every one of its vertices counts as head.
 */
const createRoundHead = () => {
  const model = new THREE.Group()
  const head = Object.assign(new THREE.Bone(), { name: 'mixamorigHead' })
  const crown = Object.assign(new THREE.Bone(), { name: 'mixamorigHeadTop_End' })
  crown.position.set(0, 2, 0)
  const face = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48).translate(0, 1, 0))
  head.add(crown, face)
  model.add(head)
  model.updateMatrixWorld(true)
  return { model, bones: [head, crown], face }
}

const positionOf = (mesh: THREE.Mesh, index: number): THREE.Vector3 =>
  new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, index)

/** The vertex nearest a point: used to find the spot a feature snapped onto. */
const nearestVertex = (mesh: THREE.Mesh, point: THREE.Vector3): number =>
  Array.from({ length: mesh.geometry.attributes.position.count }, (_, index) => index).reduce(
    (best, index) =>
      positionOf(mesh, index).distanceTo(point) < positionOf(mesh, best).distanceTo(point)
        ? index
        : best
  )

// Where the table places the nose and the left eye on a head two units tall, just outside the
// skin on each ray, so the nearest vertex is the one the feature snapped onto.
const NOSE_RAY_OUTSIDE = new THREE.Vector3(0, 0.72, 1)
const EYE_RAY_OUTSIDE = new THREE.Vector3(0.3, 1, 0.96)

describe('measureFace', () => {
  it('finds a point for every feature on a round head', () => {
    const { model, bones } = createRoundHead()

    const rig = measureFace(model, bones)

    expect(featuresInFace(rig)).toEqual(['eyes', 'nose', 'mouth', 'jaw', 'ears', 'cheeks'])
  })

  it('finds no face on a model without a head bone', () => {
    const { model } = createRoundHead()
    const neck = Object.assign(new THREE.Bone(), { name: 'mixamorigNeck' })

    const rig = measureFace(model, [neck])

    expect(rig).toEqual([])
  })
})

describe('applyFaceFeatures', () => {
  it('leaves the face exactly as authored while every feature is at rest', () => {
    const { model, bones, face } = createRoundHead()
    const before = [...face.geometry.attributes.position.array]
    const rig = measureFace(model, bones)

    applyFaceFeatures(rig, createFaceSettings())

    expect([...face.geometry.attributes.position.array]).toEqual(before)
  })

  it.each([
    { edit: 'depth', axis: 'z' as const },
    { edit: 'height', axis: 'y' as const }
  ])('moves the nose by its $edit times the face height', ({ edit, axis }) => {
    const { model, bones, face } = createRoundHead()
    const noseTip = nearestVertex(face, NOSE_RAY_OUTSIDE)
    const before = positionOf(face, noseTip)
    const rig = measureFace(model, bones)
    const settings = createFaceSettings()
    settings.nose = { ...settings.nose, [edit]: 0.05 }

    applyFaceFeatures(rig, settings)

    expect(positionOf(face, noseTip)[axis] - before[axis]).toBeCloseTo(0.1)
  })

  it('spreads the skin around an eye when the eye is enlarged', () => {
    const { model, bones, face } = createRoundHead()
    const eyePoint = positionOf(face, nearestVertex(face, EYE_RAY_OUTSIDE))
    const besideEye = nearestVertex(face, eyePoint.clone().add(new THREE.Vector3(0, 0.08, 0)))
    const distanceBefore = positionOf(face, besideEye).distanceTo(eyePoint)
    const rig = measureFace(model, bones)
    const settings = createFaceSettings()
    settings.eyes = { ...settings.eyes, size: 2 }

    applyFaceFeatures(rig, settings)

    expect(positionOf(face, besideEye).distanceTo(eyePoint)).toBeCloseTo(distanceBefore * 2)
  })
})
