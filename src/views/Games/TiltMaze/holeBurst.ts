import * as THREE from 'three'
import type { CoordinateTuple } from '@webgamekit/animation'
import {
  VICTORY_RING_COUNT,
  VICTORY_RING_DURATION_SECONDS,
  VICTORY_RING_MAX_RADIUS,
  VICTORY_RING_STAGGER_SECONDS,
  VICTORY_RING_Y
} from './config'

const RING_SEGMENTS = 40

/**
 * `bloom` opens outward from the hole, `implode` collapses inward onto it — the same rings
 * read as celebration or as being swallowed purely from the direction they travel.
 */
export type BurstMode = 'bloom' | 'implode'

export interface VictoryBurst {
  /** Advance the effect; returns false once it has finished and should be disposed. */
  update: (deltaSeconds: number) => boolean
  dispose: () => void
}

/**
 * Rings marking the hole a round ended in.
 *
 * Every ring, geometry and material is built here rather than during playback, because the
 * update runs inside the animation loop where allocating would cost a frame each time. Playing
 * the effect is then only scale and opacity on meshes that already exist.
 * @param scene The Three.js scene
 * @param position Where the ball went through, in world space
 * @param color Ring colour
 * @param mode Whether the rings open outward or collapse inward
 * @returns The burst's per-frame update and its teardown
 */
export const createHoleBurst = (
  scene: THREE.Scene,
  position: CoordinateTuple,
  color: number,
  mode: BurstMode = 'bloom'
): VictoryBurst => {
  const rings = Array.from({ length: VICTORY_RING_COUNT }).map((_unused, index) => {
    const geometry = new THREE.RingGeometry(0.75, 1, RING_SEGMENTS)
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = 'tilt-maze-victory-ring'
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(position[0], VICTORY_RING_Y, position[2])
    mesh.visible = false
    scene.add(mesh)
    return { mesh, material, delay: index * VICTORY_RING_STAGGER_SECONDS }
  })

  const lifetime =
    VICTORY_RING_DURATION_SECONDS + (VICTORY_RING_COUNT - 1) * VICTORY_RING_STAGGER_SECONDS
  const state = { elapsed: 0 }

  const update = (deltaSeconds: number): boolean => {
    state.elapsed += deltaSeconds
    rings.forEach(({ mesh, material, delay }) => {
      const progress = (state.elapsed - delay) / VICTORY_RING_DURATION_SECONDS
      if (progress < 0 || progress > 1) {
        mesh.visible = false
        return
      }
      mesh.visible = true
      const travelled = mode === 'bloom' ? progress : 1 - progress
      const scale = 1 + travelled * VICTORY_RING_MAX_RADIUS
      mesh.scale.set(scale, scale, 1)
      material.opacity = mode === 'bloom' ? 1 - progress : progress
    })

    return state.elapsed < lifetime
  }

  const dispose = (): void => {
    rings.forEach(({ mesh, material }) => {
      mesh.removeFromParent()
      mesh.geometry.dispose()
      material.dispose()
    })
  }

  return { update, dispose }
}
