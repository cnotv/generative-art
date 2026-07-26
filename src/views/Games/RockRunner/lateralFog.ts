import * as THREE from 'three'
import type { LateralFogUniforms } from './types'

/**
 * Creates the uniforms every lateral-fog material shares.
 *
 * Three's own fog is measured from the camera, so it can only hide what is
 * ahead. The world here is a narrow strip: its long sides end abruptly a few
 * dozen units to the left and right, well inside any useful camera-distance
 * fog. Fading by distance from the track centreline instead dissolves those
 * edges, whatever the camera is doing.
 *
 * @param color - Colour to fade into, normally the sky
 * @param near - Distance from the centreline where the fade begins
 * @param far - Distance where the fade is complete
 * @returns Uniforms to share across every material that fades sideways
 */
export const createLateralFogUniforms = (
  color: number,
  near: number,
  far: number
): LateralFogUniforms => ({
  lateralFogColor: { value: new THREE.Color(color) },
  lateralFogNear: { value: near },
  lateralFogFar: { value: far }
})

const DECLARATIONS = /* glsl */ `
attribute float lateralOffset;
varying float vLateralOffset;
`

const VERTEX_ASSIGN = /* glsl */ `
vLateralOffset = abs(lateralOffset);
`

const FRAGMENT_DECLARATIONS = /* glsl */ `
uniform vec3 lateralFogColor;
uniform float lateralFogNear;
uniform float lateralFogFar;
varying float vLateralOffset;
`

const FRAGMENT_MIX = /* glsl */ `
float lateralFogFactor = smoothstep(lateralFogNear, lateralFogFar, vLateralOffset);
gl_FragColor.rgb = mix(gl_FragColor.rgb, lateralFogColor, lateralFogFactor);
`

/**
 * Patches a material so it fades sideways into the fog colour.
 *
 * The distance is read from a `lateralOffset` attribute the caller bakes in,
 * which is exact: the geometry already knows how far every vertex sits from the
 * centreline, so nothing has to be reconstructed per frame.
 *
 * @param material - Material to patch, mutated in place
 * @param uniforms - Shared uniforms from createLateralFogUniforms
 * @returns The same material, for chaining
 */
export const applyLateralFog = <MaterialType extends THREE.Material>(
  material: MaterialType,
  uniforms: LateralFogUniforms
): MaterialType => {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.lateralFogColor = uniforms.lateralFogColor
    shader.uniforms.lateralFogNear = uniforms.lateralFogNear
    shader.uniforms.lateralFogFar = uniforms.lateralFogFar
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${DECLARATIONS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERTEX_ASSIGN}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_DECLARATIONS}`)
      .replace('#include <dithering_fragment>', `${FRAGMENT_MIX}\n#include <dithering_fragment>`)
  }
  // Materials compiled before the patch keep their old program otherwise.
  material.needsUpdate = true
  return material
}

/**
 * Distance from the centreline for every vertex a sweep emits, in the same
 * order as the positions.
 *
 * The swept positions are already in world space, so they cannot be read back
 * for this; the offset has to come from the cross-section, which is exactly
 * what the profile's x already is.
 *
 * @param stationCount - How many stations the sweep has
 * @param crossSection - Outline being swept
 * @returns One absolute offset per emitted vertex
 */
export const sweepLateralOffsets = (
  stationCount: number,
  crossSection: [number, number][]
): number[] =>
  Array.from({ length: stationCount }).flatMap(() =>
    crossSection.flatMap((current, pointIndex) => {
      const nextPoint = crossSection[(pointIndex + 1) % crossSection.length]
      return [current, nextPoint].map(([x]) => Math.abs(x))
    })
  )
