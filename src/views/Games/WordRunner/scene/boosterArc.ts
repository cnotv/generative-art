import * as THREE from 'three'
import { replaceGeometry } from '@/utils/threeObjectUpdaters'
import { BALL, BOOSTER_ARC } from '../config'
import type { BoosterArcFrame } from '../types'

// A one-ring arc is two triangles per segment, indexed segment by segment from its start.
const INDICES_PER_SEGMENT = 6

/** The indices of an arc's first segments, for drawing only that much of it. */
export const arcDrawCount = (charge: number, segments: number): number =>
  Math.round(Math.min(1, Math.max(0, charge)) * segments) * INDICES_PER_SEGMENT

/**
 * An arc beside the ball, `gap` clear of its surface, centred on the ball's right. Its segments
 * run counter-clockwise from the bottom, so drawing only the first few fills it from below.
 */
const arcGeometry = (gap: number): THREE.RingGeometry =>
  new THREE.RingGeometry(
    BALL.radius + gap,
    BALL.radius + gap + BOOSTER_ARC.thickness,
    BOOSTER_ARC.segments,
    1,
    -BOOSTER_ARC.sweep / 2,
    BOOSTER_ARC.sweep
  )

// Drawn over everything, so the course never hides the meter, and see-through.
const arcMaterial = (): THREE.MeshBasicMaterial =>
  new THREE.MeshBasicMaterial({
    color: BOOSTER_ARC.chargingColor,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide
  })

/**
 * The booster's recharge as a see-through arc hugging the player's ball, turned to face the
 * camera: a faint track the whole length, and a fill that rises up it as the booster recharges
 * and turns gold once it is ready.
 */
export const createBoosterArc = (scene: THREE.Scene, gap: number) => {
  const group = new THREE.Group()
  group.name = 'booster-arc'
  // Mirrored, so the arc sits on the ball's left, beside the booster's own control.
  group.scale.x = -1
  group.visible = false
  const track = new THREE.Mesh(arcGeometry(gap), arcMaterial())
  const fill = new THREE.Mesh(arcGeometry(gap), arcMaterial())
  track.name = 'booster-arc-track'
  fill.name = 'booster-arc-fill'
  track.renderOrder = BOOSTER_ARC.renderOrder
  fill.renderOrder = BOOSTER_ARC.renderOrder + 1
  group.add(track, fill)
  scene.add(group)
  const parts = [track, fill]
  const materials = parts.map((part) => part.material)

  /** Moves the arc closer to or further from the ball. Called on a setting change, not a frame. */
  const setGap = (nextGap: number): void =>
    parts.forEach((part) => replaceGeometry(part, arcGeometry(nextGap)))

  const draw = ({ ball, camera, charge, opacity, visible }: BoosterArcFrame): void => {
    group.visible = visible && opacity > 0
    if (!group.visible) return
    group.position.copy(ball.position)
    group.quaternion.copy(camera.quaternion)
    fill.geometry.setDrawRange(0, arcDrawCount(charge, BOOSTER_ARC.segments))
    fill.material.color.setHex(charge >= 1 ? BOOSTER_ARC.readyColor : BOOSTER_ARC.chargingColor)
    fill.material.opacity = opacity
    track.material.opacity = opacity * BOOSTER_ARC.trackOpacityShare
  }

  const dispose = (): void => {
    scene.remove(group)
    parts.forEach((part) => part.geometry.dispose())
    materials.forEach((material) => material.dispose())
  }

  return { setGap, draw, dispose }
}
