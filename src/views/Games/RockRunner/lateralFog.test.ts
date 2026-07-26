import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { createLateralFogUniforms, applyLateralFog, sweepLateralOffsets } from './lateralFog'

const SECTION: [number, number][] = [
  [-8, -1],
  [-8, 0],
  [8, 0],
  [8, -1]
]

describe('createLateralFogUniforms', () => {
  it('holds the colour and both distances', () => {
    const uniforms = createLateralFogUniforms(0x112233, 10, 40)

    expect(uniforms.lateralFogColor.value.getHex()).toBe(0x112233)
    expect(uniforms.lateralFogNear.value).toBe(10)
    expect(uniforms.lateralFogFar.value).toBe(40)
  })
})

describe('sweepLateralOffsets', () => {
  it('emits one offset per vertex the sweep produces', () => {
    expect(sweepLateralOffsets(3, SECTION)).toHaveLength(3 * SECTION.length * 2)
  })

  // The swept positions are world space, so the offset has to come from the
  // cross-section rather than being read back off the geometry.
  it('reports absolute distance from the centreline, not signed profile x', () => {
    const offsets = sweepLateralOffsets(1, SECTION)

    expect(Math.min(...offsets)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...offsets)).toBe(8)
  })

  it('repeats identically for every station', () => {
    const perStation = SECTION.length * 2
    const offsets = sweepLateralOffsets(2, SECTION)

    expect(offsets.slice(0, perStation)).toEqual(offsets.slice(perStation))
  })
})

describe('applyLateralFog', () => {
  it('shares the caller uniforms with the compiled shader', () => {
    const uniforms = createLateralFogUniforms(0x445566, 5, 20)
    const material = applyLateralFog(new THREE.MeshStandardMaterial(), uniforms)
    const shader = {
      uniforms: {},
      vertexShader: '#include <common>\n#include <begin_vertex>',
      fragmentShader: '#include <common>\n#include <dithering_fragment>'
    }

    material.onBeforeCompile(shader as never, null as never)

    expect(shader.uniforms.lateralFogColor).toBe(uniforms.lateralFogColor)
    expect(shader.uniforms.lateralFogNear).toBe(uniforms.lateralFogNear)
  })

  it('injects the offset attribute and the colour mix', () => {
    const material = applyLateralFog(
      new THREE.MeshStandardMaterial(),
      createLateralFogUniforms(0, 5, 20)
    )
    const shader = {
      uniforms: {},
      vertexShader: '#include <common>\n#include <begin_vertex>',
      fragmentShader: '#include <common>\n#include <dithering_fragment>'
    }

    material.onBeforeCompile(shader as never, null as never)

    expect(shader.vertexShader).toContain('attribute float lateralOffset')
    expect(shader.fragmentShader).toContain('lateralFogColor')
    expect(shader.fragmentShader).toContain('smoothstep')
  })
})
