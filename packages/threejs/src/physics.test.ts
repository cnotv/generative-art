import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { syncMeshWithBody, syncMeshesWithBodies, hasPhysicsBody } from './physics'
import type { ComplexModel } from './types'

const makeMesh = (body?: unknown): ComplexModel => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial())
  return Object.assign(mesh, { userData: body ? { body } : {} }) as unknown as ComplexModel
}

/**
 * Deliberately violates the type: userData is not optional on ComplexModel, but a plain mesh
 * that never went through getCube reaches these functions in real scenes anyway.
 */
const makeMeshWithoutUserData = (): ComplexModel => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial())
  return Object.assign(mesh, { userData: undefined }) as unknown as ComplexModel
}

const stubBody = (x: number, y: number, z: number) => ({
  translation: () => ({ x, y, z }),
  rotation: () => ({ x: 0, y: 0, z: 0, w: 1 })
})

describe('syncMeshWithBody', () => {
  it('moves the mesh to where the body is', () => {
    const mesh = makeMesh(stubBody(3, 7, -2))

    syncMeshWithBody(mesh)

    expect([mesh.position.x, mesh.position.y, mesh.position.z]).toEqual([3, 7, -2])
  })

  it('copies the body rotation onto the mesh', () => {
    const halfTurn = { x: 0, y: 1, z: 0, w: 0 }
    const mesh = makeMesh({ translation: () => ({ x: 0, y: 0, z: 0 }), rotation: () => halfTurn })

    syncMeshWithBody(mesh)

    expect(mesh.quaternion.y).toBe(1)
    expect(mesh.quaternion.w).toBe(0)
  })

  it('applies a vertical offset for meshes whose origin is not their centre', () => {
    const mesh = makeMesh(stubBody(0, 5, 0))

    syncMeshWithBody(mesh, -1)

    expect(mesh.position.y).toBe(4)
  })

  it.each([
    { scenario: 'a mesh with no body', mesh: () => makeMesh() },
    { scenario: 'a mesh with no userData at all', mesh: makeMeshWithoutUserData }
  ])('leaves $scenario untouched rather than throwing', ({ mesh }) => {
    const target = mesh()
    target.position.set(1, 2, 3)

    expect(() => syncMeshWithBody(target)).not.toThrow()
    expect([target.position.x, target.position.y, target.position.z]).toEqual([1, 2, 3])
  })
})

describe('syncMeshesWithBodies', () => {
  it('syncs every mesh in the list', () => {
    const meshes = [makeMesh(stubBody(1, 0, 0)), makeMesh(stubBody(2, 0, 0))]

    syncMeshesWithBodies(meshes)

    expect(meshes.map((mesh) => mesh.position.x)).toEqual([1, 2])
  })

  it('skips the ones without bodies instead of failing the whole frame', () => {
    const withBody = makeMesh(stubBody(9, 0, 0))
    const withoutBody = makeMesh()

    syncMeshesWithBodies([withoutBody, withBody])

    expect(withBody.position.x).toBe(9)
  })
})

describe('hasPhysicsBody', () => {
  it.each([
    { scenario: 'a mesh with a body', mesh: () => makeMesh(stubBody(0, 0, 0)), expected: true },
    { scenario: 'a mesh without one', mesh: () => makeMesh(), expected: false }
  ])('is $expected for $scenario', ({ mesh, expected }) => {
    expect(hasPhysicsBody(mesh())).toBe(expected)
  })
})
