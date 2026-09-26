import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { instanceMatrixModel } from './core'

/** A model whose second mesh sits well above and beside the root, as a canopy does. */
const buildTwoPartModel = (): THREE.Group => {
  const model = new THREE.Group()
  model.name = 'tree'
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial())
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial())
  canopy.position.set(0, 10, 2)
  model.add(trunk, canopy)
  return model
}

const copyPositionOf = (instanced: THREE.InstancedMesh, index: number): number[] => {
  const matrix = new THREE.Matrix4()
  instanced.getMatrixAt(index, matrix)
  return new THREE.Vector3().setFromMatrixPosition(matrix).toArray()
}

describe('instanceMatrixModel', () => {
  it('makes one instanced mesh per mesh in the model, whatever the number of copies', () => {
    const parent = new THREE.Group()
    const instanced = instanceMatrixModel(buildTwoPartModel(), parent, [
      { position: [0, 0, 0] },
      { position: [50, 0, 0] },
      { position: [100, 0, 0] }
    ])
    expect(instanced).toHaveLength(2)
    expect(parent.children).toEqual(instanced)
    expect(instanced[0].count).toBe(3)
  })

  it('keeps each part where the model put it rather than stacking them on the copy', () => {
    const [trunk, canopy] = instanceMatrixModel(buildTwoPartModel(), new THREE.Group(), [
      { position: [50, 0, 0] }
    ])
    expect(copyPositionOf(trunk, 0)).toEqual([50, 0, 0])
    expect(copyPositionOf(canopy, 0)).toEqual([50, 10, 2])
  })

  it('scales a part offset with the copy, so a bigger copy is not a bigger trunk under the same canopy', () => {
    const [, canopy] = instanceMatrixModel(buildTwoPartModel(), new THREE.Group(), [
      { position: [0, 0, 0], scale: [3, 3, 3] }
    ])
    expect(copyPositionOf(canopy, 0)).toEqual([0, 30, 6])
  })

  it('turns a part offset with the copy', () => {
    const [, canopy] = instanceMatrixModel(buildTwoPartModel(), new THREE.Group(), [
      { position: [0, 0, 0], rotation: [0, Math.PI / 2, 0] }
    ])
    const [x, y, z] = copyPositionOf(canopy, 0)
    expect(x).toBeCloseTo(2)
    expect(y).toBeCloseTo(10)
    expect(z).toBeCloseTo(0)
  })

  it('takes its shadow flags from the model root', () => {
    const model = buildTwoPartModel()
    model.castShadow = true
    model.receiveShadow = true
    const instanced = instanceMatrixModel(model, new THREE.Group(), [{ position: [0, 0, 0] }])
    expect(instanced.map((mesh) => mesh.castShadow)).toEqual([true, true])
    expect(instanced.map((mesh) => mesh.receiveShadow)).toEqual([true, true])
  })
})
