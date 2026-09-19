import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import {
  generateAutoRig,
  isGltfModelUrl,
  resolveHierarchyBones,
  sortBoneNamesForDisplay
} from './rigModel'

describe('resolveHierarchyBones', () => {
  it('swaps a copy hung beneath a same-named bone for the bone that carries the hierarchy', () => {
    // Arrange: the Y Bot shape, a second skeleton's forearm at zero offset under the real one.
    const arm = Object.assign(new THREE.Bone(), { name: 'mixamorigLeftArm' })
    const forearm = Object.assign(new THREE.Bone(), { name: 'mixamorigLeftForeArm' })
    const forearmCopy = Object.assign(new THREE.Bone(), { name: 'mixamorigLeftForeArm' })
    arm.add(forearm)
    forearm.add(forearmCopy)

    // Act
    const resolved = resolveHierarchyBones([arm, forearmCopy])

    // Assert
    expect(resolved).toEqual([arm, forearm])
    expect(resolved[1]).toBe(forearm)
  })
})

describe('isGltfModelUrl', () => {
  it.each([
    ['/character2.fbx', false],
    ['/goomba.glb', true],
    ['/tree.gltf', true],
    // A bare blob URL carries no extension at all, so it falls back to FBX.
    ['blob:http://localhost:5327/00000000-0000-0000-0000-000000000000', false],
    // The real filename tagged on as a fragment, per `loadModelFile`'s own doc comment.
    ['blob:http://localhost:5327/00000000-0000-0000-0000-000000000000#goomba.glb', true],
    ['blob:http://localhost:5327/00000000-0000-0000-0000-000000000000#character2.fbx', false]
  ])('%s resolves to gltf: %s', (url, expected) => {
    expect(isGltfModelUrl(url)).toBe(expected)
  })
})

describe('sortBoneNamesForDisplay', () => {
  it('puts the core skeleton first, in a sensible posing order, however the source scrambled it', () => {
    // The exact scramble a real uploaded model's own skeleton.bones array came back in.
    const scrambled = [
      'mixamorigNeck',
      'mixamorigSpine2',
      'mixamorigSpine1',
      'mixamorigLeftShoulder',
      'mixamorigSpine',
      'mixamorigHips'
    ]
    expect(sortBoneNamesForDisplay(scrambled)).toEqual([
      'mixamorigHips',
      'mixamorigSpine',
      'mixamorigSpine1',
      'mixamorigSpine2',
      'mixamorigNeck',
      'mixamorigLeftShoulder'
    ])
  })

  it('sorts anything outside the canonical skeleton alphabetically after all of it', () => {
    const names = ['mixamorigLeftHandThumb2', 'mixamorigHips', 'mixamorigLeftHandThumb1']
    expect(sortBoneNamesForDisplay(names)).toEqual([
      'mixamorigHips',
      'mixamorigLeftHandThumb1',
      'mixamorigLeftHandThumb2'
    ])
  })

  it('does not mutate the array it was given', () => {
    const names = ['mixamorigNeck', 'mixamorigHips']
    sortBoneNamesForDisplay(names)
    expect(names).toEqual(['mixamorigNeck', 'mixamorigHips'])
  })
})

describe('generateAutoRig', () => {
  const worldPositionsOf = (mesh: THREE.Mesh): THREE.Vector3[] =>
    Array.from({ length: mesh.geometry.attributes.position.count }, (_, index) =>
      mesh.getVertexPosition(index, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld)
    )

  /** A leg-shaped box nested under an offset, scaled hip node, the way part-built models hang. */
  const createNestedModel = (legScale: [number, number, number]) => {
    const model = new THREE.Group()
    const hip = new THREE.Group()
    hip.position.set(0, 1, 0)
    hip.scale.setScalar(2)
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.2, 1, 4, 1))
    leg.position.set(0.1, -0.2, 0)
    leg.scale.set(...legScale)
    hip.add(leg)
    model.add(hip)
    model.updateMatrixWorld(true)
    return { model, leg }
  }

  it('keeps every vertex where it was, however the mesh was nested and scaled', () => {
    const { model, leg } = createNestedModel([1, 1, 1])
    const before = worldPositionsOf(leg)

    const [skinned] = generateAutoRig(model) ?? []
    model.updateMatrixWorld(true)

    worldPositionsOf(skinned).forEach((position, index) => {
      expect(position.distanceTo(before[index])).toBeLessThan(1e-5)
    })
  })

  it('hangs the skinned replacement straight off the model in place of the original', () => {
    const { model, leg } = createNestedModel([1, 1, 1])

    const [skinned] = generateAutoRig(model) ?? []

    expect(skinned.parent).toBe(model)
    expect(leg.parent).toBeNull()
  })

  it('turns a mirrored mesh right side out once its mirror is baked in', () => {
    const { model, leg } = createNestedModel([-1, 1, 1])
    const outwardBefore = new THREE.Vector3(-1, 0, 0)

    const [skinned] = generateAutoRig(model) ?? []

    const [a, b, c] = [0, 1, 2].map((corner) =>
      new THREE.Vector3().fromBufferAttribute(
        skinned.geometry.attributes.position,
        skinned.geometry.index!.getX(corner)
      )
    )
    const windingNormal = b.clone().sub(a).cross(c.clone().sub(a)).normalize()
    expect(leg.geometry).not.toBe(skinned.geometry)
    expect(windingNormal.dot(outwardBefore)).toBeCloseTo(1)
  })
})
