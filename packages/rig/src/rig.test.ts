import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { rigFindSkinnedMesh, rigFindUnskinnedMeshes } from './rig'

const buildSkinnedMesh = (): THREE.SkinnedMesh => {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3))
  const bone = new THREE.Bone()
  const skeleton = new THREE.Skeleton([bone])
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial())
  mesh.add(bone)
  mesh.bind(skeleton)
  return mesh
}

describe('rigFindSkinnedMesh', () => {
  it('finds a skinned mesh nested under other objects', () => {
    const root = new THREE.Object3D()
    const group = new THREE.Object3D()
    const skinnedMesh = buildSkinnedMesh()
    group.add(skinnedMesh)
    root.add(group)

    expect(rigFindSkinnedMesh(root)).toBe(skinnedMesh)
  })

  it('returns null when the model has no skinned mesh', () => {
    const root = new THREE.Object3D()
    root.add(new THREE.Mesh(new THREE.BoxGeometry()))
    expect(rigFindSkinnedMesh(root)).toBeNull()
  })
})

describe('rigFindUnskinnedMeshes', () => {
  it('collects plain meshes but skips skinned ones', () => {
    const root = new THREE.Object3D()
    const plainMesh = new THREE.Mesh(new THREE.BoxGeometry())
    root.add(plainMesh, buildSkinnedMesh())

    expect(rigFindUnskinnedMeshes(root)).toEqual([plainMesh])
  })

  it('returns an empty array for a model with no meshes at all', () => {
    const root = new THREE.Object3D()
    root.add(new THREE.Object3D())
    expect(rigFindUnskinnedMeshes(root)).toEqual([])
  })
})
