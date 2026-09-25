import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { getFog, getPixelRatio, getWater } from './getters'
import { SCENE_DEFAULTS } from './defaults'

describe('getPixelRatio', () => {
  it.each([
    [1, 1],
    [2, 2]
  ])('leaves a device pixel ratio of %f at %f', (device, expected) => {
    expect(getPixelRatio(device)).toBe(expected)
  })

  it.each([
    [3, 2],
    [4, 2]
  ])('caps a device pixel ratio of %f down to %f', (device, expected) => {
    expect(getPixelRatio(device)).toBe(expected)
  })

  it('respects a custom maximum', () => {
    expect(getPixelRatio(3, 1.5)).toBe(1.5)
  })
})

describe('getFog', () => {
  it('hangs linear fog by default', () => {
    const scene = new THREE.Scene()
    const fog = getFog(scene, { color: 0x112233, near: 10, far: 20 })
    expect(fog).toBeInstanceOf(THREE.Fog)
    expect(scene.fog).toBe(fog)
    expect((fog as THREE.Fog).near).toBe(10)
    expect((fog as THREE.Fog).far).toBe(20)
  })

  it('hangs exponential fog once a density is given, ignoring near and far', () => {
    const scene = new THREE.Scene()
    const fog = getFog(scene, { density: 0.01, near: 10, far: 20 })
    expect(fog).toBeInstanceOf(THREE.FogExp2)
    expect((fog as THREE.FogExp2).density).toBe(0.01)
  })

  it('falls back to SCENE_DEFAULTS for anything left out', () => {
    const fog = getFog(new THREE.Scene(), {}) as THREE.Fog
    expect(fog.color.getHex()).toBe(SCENE_DEFAULTS.fog.color)
    expect(fog.near).toBe(SCENE_DEFAULTS.fog.near)
    expect(fog.far).toBe(SCENE_DEFAULTS.fog.far)
  })
})

describe('getWater', () => {
  it('lays a named surface flat on the XZ plane at the position given', () => {
    const scene = new THREE.Scene()
    const { mesh } = getWater(scene, { position: [1, -2, 3] })
    expect(mesh.name).toBe('water')
    expect(scene.children).toContain(mesh)
    expect(mesh.rotation.x).toBeCloseTo(-Math.PI / 2)
    expect(mesh.position.toArray()).toEqual([1, -2, 3])
  })

  it('turns the surface about the world up axis, leaving it flat', () => {
    const { mesh } = getWater(new THREE.Scene(), { heading: Math.PI / 2 })
    const up = new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.quaternion)
    expect(up.y).toBeCloseTo(1)
  })

  it('carries the ripple settings into the shader and lets fog reach the surface', () => {
    const { mesh } = getWater(new THREE.Scene(), {
      rippleStrength: 0.5,
      rippleScale: 8,
      rippleSpeed: 2
    })
    const material = mesh.material as THREE.ShaderMaterial
    expect(material.fog).toBe(true)
    expect(material.uniforms.rippleStrength.value).toBe(0.5)
    expect(material.uniforms.rippleScale.value).toBe(8)
    expect(material.uniforms.rippleSpeed.value).toBe(2)
  })

  it('removes the surface from the scene when disposed', () => {
    const scene = new THREE.Scene()
    const { mesh, dispose } = getWater(scene, {})
    dispose()
    expect(scene.children).not.toContain(mesh)
  })
})
