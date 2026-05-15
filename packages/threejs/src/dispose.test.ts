import { describe, it, expect, vi } from 'vitest'
import * as THREE from 'three'
import { disposeObject, disposeScene } from './dispose'

const makeDisposableMesh = () => {
  const geometry = new THREE.BoxGeometry(1, 1, 1)
  const texture = new THREE.Texture()
  const material = new THREE.MeshStandardMaterial({ map: texture })

  vi.spyOn(geometry, 'dispose')
  vi.spyOn(texture, 'dispose')
  vi.spyOn(material, 'dispose')

  const mesh = new THREE.Mesh(geometry, material)
  return { mesh, geometry, texture, material }
}

describe('disposeObject', () => {
  it('disposes geometry of a single mesh', () => {
    const { mesh, geometry } = makeDisposableMesh()
    disposeObject(mesh)
    expect(geometry.dispose).toHaveBeenCalledOnce()
  })

  it('disposes material of a single mesh', () => {
    const { mesh, material } = makeDisposableMesh()
    disposeObject(mesh)
    expect(material.dispose).toHaveBeenCalledOnce()
  })

  it('disposes textures on the material', () => {
    const { mesh, texture } = makeDisposableMesh()
    disposeObject(mesh)
    expect(texture.dispose).toHaveBeenCalledOnce()
  })

  it('recursively disposes all meshes in a Group', () => {
    const group = new THREE.Group()
    const childA = makeDisposableMesh()
    const childB = makeDisposableMesh()
    group.add(childA.mesh, childB.mesh)

    disposeObject(group)

    expect(childA.geometry.dispose).toHaveBeenCalledOnce()
    expect(childA.material.dispose).toHaveBeenCalledOnce()
    expect(childB.geometry.dispose).toHaveBeenCalledOnce()
    expect(childB.material.dispose).toHaveBeenCalledOnce()
  })

  it('handles deeply nested objects', () => {
    const outer = new THREE.Group()
    const inner = new THREE.Group()
    const { mesh, geometry, material } = makeDisposableMesh()
    inner.add(mesh)
    outer.add(inner)

    disposeObject(outer)

    expect(geometry.dispose).toHaveBeenCalledOnce()
    expect(material.dispose).toHaveBeenCalledOnce()
  })

  it('disposes each material in a multi-material mesh', () => {
    const geometry = new THREE.BoxGeometry()
    vi.spyOn(geometry, 'dispose')
    const matA = new THREE.MeshBasicMaterial()
    const matB = new THREE.MeshBasicMaterial()
    vi.spyOn(matA, 'dispose')
    vi.spyOn(matB, 'dispose')

    const mesh = new THREE.Mesh(geometry, [matA, matB])
    disposeObject(mesh)

    expect(matA.dispose).toHaveBeenCalledOnce()
    expect(matB.dispose).toHaveBeenCalledOnce()
  })

  it('does not throw when geometry is missing', () => {
    const mesh = new THREE.Mesh()
    // @ts-expect-error — intentionally removing geometry
    mesh.geometry = undefined
    expect(() => disposeObject(mesh)).not.toThrow()
  })

  it('does not throw when material is missing', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry())
    // @ts-expect-error — intentionally removing material
    mesh.material = undefined
    expect(() => disposeObject(mesh)).not.toThrow()
  })

  it('skips non-mesh children (lights, cameras)', () => {
    const group = new THREE.Group()
    group.add(new THREE.AmbientLight())
    group.add(new THREE.PerspectiveCamera())
    expect(() => disposeObject(group)).not.toThrow()
  })

  it('disposes all map texture types on a material', () => {
    const geometry = new THREE.BoxGeometry()
    const normalMap = new THREE.Texture()
    const emissiveMap = new THREE.Texture()
    vi.spyOn(normalMap, 'dispose')
    vi.spyOn(emissiveMap, 'dispose')

    const material = new THREE.MeshStandardMaterial({ normalMap, emissiveMap })
    const mesh = new THREE.Mesh(geometry, material)

    disposeObject(mesh)

    expect(normalMap.dispose).toHaveBeenCalledOnce()
    expect(emissiveMap.dispose).toHaveBeenCalledOnce()
  })
})

describe('disposeScene', () => {
  it('calls renderer.dispose()', () => {
    const renderer = { dispose: vi.fn() } as unknown as THREE.WebGLRenderer
    disposeScene(renderer)
    expect(renderer.dispose).toHaveBeenCalledOnce()
  })

  it('disposes scene objects before the renderer', () => {
    const callOrder: string[] = []
    const { mesh, geometry } = makeDisposableMesh()
    vi.spyOn(geometry, 'dispose').mockImplementation(() => {
      callOrder.push('geometry')
    })
    const renderer = {
      dispose: vi.fn().mockImplementation(() => {
        callOrder.push('renderer')
      })
    } as unknown as THREE.WebGLRenderer

    disposeScene(renderer, mesh)

    expect(callOrder).toEqual(['geometry', 'renderer'])
  })
})
