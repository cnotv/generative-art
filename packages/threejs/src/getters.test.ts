import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { getFog, getGroundHeight, getPixelRatio, getWater } from './getters'
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

describe('getGroundHeight', () => {
  const relief = { amplitude: 4, frequency: 0.01, octaves: 3, seed: 5 }

  it('gives the same height for the same spot every time', () => {
    expect(getGroundHeight(12, -30, relief)).toBe(getGroundHeight(12, -30, relief))
  })

  it('stays within the summed reach of its layers, which is more than the first layer alone', () => {
    const reach = Math.max(
      ...Array.from({ length: 200 }, (_, step) =>
        Math.abs(getGroundHeight(step * 7, step * 3, relief))
      )
    )
    // Three layers at half the amplitude each time: 4 * (1 + 0.5 + 0.25).
    expect(reach).toBeLessThanOrEqual(7)
    expect(reach).toBeGreaterThan(4)
  })

  it('drops the full depth of a channel across its floor', () => {
    const channel = { centerX: 40, width: 20, depth: 6, banks: 10 }
    const floor = getGroundHeight(40, 0, { ...relief, channel })
    expect(floor).toBeCloseTo(getGroundHeight(40, 0, relief) - 6)
  })

  it('leaves the ground alone beyond the channel banks', () => {
    const channel = { centerX: 40, width: 20, depth: 6, banks: 10 }
    expect(getGroundHeight(200, 0, { ...relief, channel })).toBe(getGroundHeight(200, 0, relief))
  })

  it('climbs out of a channel without a step, and never overshoots the surface', () => {
    const channel = { centerX: 0, width: 0, depth: 6, banks: 20 }
    const flat = { amplitude: 0, frequency: 0.01, octaves: 1, seed: 5, channel }
    const profile = Array.from({ length: 21 }, (_, step) => getGroundHeight(step, 0, flat))
    expect(profile[0]).toBeCloseTo(-6)
    expect(profile[20]).toBeCloseTo(0)
    profile.forEach((height, index) => {
      expect(height).toBeLessThanOrEqual(0)
      if (index > 0) expect(height).toBeGreaterThanOrEqual(profile[index - 1])
    })
  })
})
