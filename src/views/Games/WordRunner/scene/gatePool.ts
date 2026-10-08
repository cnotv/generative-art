import * as THREE from 'three'
import { attachRockStroke } from '@/views/Games/RockRunner/elements/rockStroke'
import {
  ROCK_RENDER_ORDER,
  ROCK_STROKE_WIDTH,
  ROCK_STROKE_WOBBLE
} from '@/views/Games/RockRunner/config'
import {
  GRAVEL,
  LANE_COUNT,
  LANE_WIDTH,
  PIECE_POP,
  RAMP,
  ROCK,
  SIGN_HEIGHT,
  SIGN_WIDTH,
  SIGN_Y
} from '../config'
import { laneOffset, popScale } from '../runner/runMotion'
import { createSignCanvas, drawSign } from './signTexture'
import type {
  Gate,
  GateFeatures,
  GateSign,
  GateSlot,
  RoutePiece,
  SignState,
  TrackSample
} from '../types'

type SharedGeometry = {
  sign: THREE.PlaneGeometry
  ramp: THREE.BoxGeometry
  rock: THREE.IcosahedronGeometry
  gravel: THREE.PlaneGeometry
}

type SharedMaterials = {
  ramp: THREE.MeshLambertMaterial
  rock: THREE.MeshLambertMaterial
  gravel: THREE.MeshLambertMaterial
}

const createSharedGeometry = (): SharedGeometry => ({
  sign: new THREE.PlaneGeometry(SIGN_WIDTH, SIGN_HEIGHT),
  ramp: new THREE.BoxGeometry(RAMP.width, RAMP.thickness, RAMP.length),
  rock: new THREE.IcosahedronGeometry(ROCK.radius, ROCK.detail),
  gravel: new THREE.PlaneGeometry(GRAVEL.width, GRAVEL.length).rotateX(-Math.PI / 2)
})

const createSharedMaterials = (): SharedMaterials => ({
  ramp: new THREE.MeshLambertMaterial({ color: RAMP.color }),
  // Transparent so it sorts with its hand-drawn outline, the way Rock Runner's own rock does.
  rock: new THREE.MeshLambertMaterial({ color: ROCK.color, transparent: true }),
  gravel: new THREE.MeshLambertMaterial({ color: GRAVEL.color })
})

const createSign = (geometry: THREE.PlaneGeometry, lane: number): GateSign => {
  const canvas = createSignCanvas()
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = `word-sign-${lane}`
  mesh.position.set(laneOffset(lane, LANE_COUNT, LANE_WIDTH), SIGN_Y, 0)
  return { mesh, material, canvas, texture, word: '', state: 'idle' }
}

const createRock = (geometry: SharedGeometry, materials: SharedMaterials): THREE.Mesh => {
  const rock = new THREE.Mesh(geometry.rock, materials.rock)
  rock.position.y = ROCK.radius * ROCK.lift
  rock.renderOrder = ROCK_RENDER_ORDER
  rock.castShadow = true
  attachRockStroke(rock, ROCK_STROKE_WIDTH, ROCK_STROKE_WOBBLE)
  return rock
}

/** One of each route piece per lane, shown or hidden as each gate's feature needs. */
const createFeatures = (geometry: SharedGeometry, materials: SharedMaterials): GateFeatures => {
  const group = new THREE.Group()
  const ramp = new THREE.Mesh(geometry.ramp, materials.ramp)
  // Tilted so its far end is the high one, rising in the direction of travel.
  ramp.rotation.x = Math.atan2(RAMP.rise, RAMP.length)
  ramp.position.y = RAMP.rise / 2
  ramp.castShadow = true
  const rocks = Array.from({ length: LANE_COUNT }, () => createRock(geometry, materials))
  const gravel = Array.from({ length: LANE_COUNT }, (_, lane) => {
    const patch = new THREE.Mesh(geometry.gravel, materials.gravel)
    patch.position.set(laneOffset(lane, LANE_COUNT, LANE_WIDTH), GRAVEL.lift, 0)
    return patch
  })
  rocks.forEach((rock, lane) => {
    rock.position.x = laneOffset(lane, LANE_COUNT, LANE_WIDTH)
  })
  group.add(ramp, ...rocks, ...gravel)
  return { group, ramp, rocks, gravel, popSeconds: PIECE_POP.seconds }
}

const createSlot = (
  scene: THREE.Scene,
  geometry: SharedGeometry,
  materials: SharedMaterials,
  slotIndex: number
): GateSlot => {
  const group = new THREE.Group()
  group.name = `word-gate-${slotIndex}`
  // The gate is its words alone, floating across the lanes for the ball to roll through.
  const signs = Array.from({ length: LANE_COUNT }, (_, lane) => createSign(geometry.sign, lane))
  group.add(...signs.map((sign) => sign.mesh))
  const features = createFeatures(geometry, materials)
  features.group.name = `route-feature-${slotIndex}`
  group.visible = false
  features.group.visible = false
  scene.add(group, features.group)
  return { group, signs, features, gateKey: null }
}

/** Redraws a sign only when its word or state actually changed, since a redraw re-uploads it. */
export const setSignState = (sign: GateSign, word: string, state: SignState): void => {
  if (sign.word === word && sign.state === state) return
  sign.word = word
  sign.state = state
  drawSign(sign.canvas, word, state)
  sign.texture.needsUpdate = true
}

const hideFeatures = (features: GateFeatures): void => {
  features.ramp.visible = false
  features.rocks.forEach((rock) => {
    rock.visible = false
  })
  features.gravel.forEach((patch) => {
    patch.visible = false
  })
}

/**
 * Brings up the piece of route in the lane just taken: the ramp, a rock or gravel. Nothing on
 * the course gives a word away before it is picked.
 */
export const revealPiece = (features: GateFeatures, piece: RoutePiece, lane: number): void => {
  features.popSeconds = 0
  if (piece === 'ramp') {
    features.ramp.position.x = laneOffset(lane, LANE_COUNT, LANE_WIDTH)
    features.ramp.visible = true
  }
  if (piece === 'rock') features.rocks[lane].visible = true
  if (piece === 'gravel') features.gravel[lane].visible = true
}

/** Springs a just-revealed piece up out of the deck, and leaves it alone once it has settled. */
export const springPieces = (features: GateFeatures, deltaSeconds: number): void => {
  if (features.popSeconds >= PIECE_POP.seconds) return
  features.popSeconds += deltaSeconds
  const scale = popScale(features.popSeconds, PIECE_POP.seconds, PIECE_POP.spring)
  features.ramp.scale.setScalar(scale)
  features.rocks.forEach((rock) => rock.scale.setScalar(scale))
  features.gravel.forEach((patch) => patch.scale.setScalar(scale))
}

/** Dresses a pooled slot as one gate of the text, its route still hidden. */
export const assignSlot = (slot: GateSlot, gate: Gate, gateKey: string): void => {
  slot.gateKey = gateKey
  gate.options.forEach((word, lane) => setSignState(slot.signs[lane], word, 'idle'))
  hideFeatures(slot.features)
}

const placeOnTrack = (object: THREE.Object3D, sample: TrackSample): void => {
  object.position.copy(sample.position)
  object.rotation.y = sample.yaw
}

/** Stands a slot's gate and its feature on the track, fading the gate in by the given opacity. */
export const placeSlot = (
  slot: GateSlot,
  gateSample: TrackSample,
  featureSample: TrackSample,
  opacity: number
): void => {
  slot.group.visible = opacity > 0
  slot.features.group.visible = opacity > 0
  placeOnTrack(slot.group, gateSample)
  placeOnTrack(slot.features.group, featureSample)
  slot.signs.forEach((sign) => {
    sign.material.opacity = opacity
  })
}

export const hideSlot = (slot: GateSlot): void => {
  slot.group.visible = false
  slot.features.group.visible = false
  slot.gateKey = null
}

/** Every gate slot the track can show at once, built up front so nothing is created mid-run. */
export const createGatePool = (
  scene: THREE.Scene,
  poolSize: number
): { slots: GateSlot[]; dispose: () => void } => {
  const geometry = createSharedGeometry()
  const materials = createSharedMaterials()
  const slots = Array.from({ length: poolSize }, (_, slotIndex) =>
    createSlot(scene, geometry, materials, slotIndex)
  )
  const dispose = (): void => {
    slots.forEach((slot) => {
      scene.remove(slot.group, slot.features.group)
      // Each rock's hand-drawn outline is its own mesh, built by attachRockStroke.
      slot.features.rocks.forEach((rock) =>
        rock.children.forEach((outline) => {
          if (!(outline instanceof THREE.Mesh)) return
          outline.geometry.dispose()
          if (outline.material instanceof THREE.Material) outline.material.dispose()
        })
      )
      slot.signs.forEach((sign) => {
        sign.texture.dispose()
        sign.material.dispose()
      })
    })
    Object.values(geometry).forEach((shared) => shared.dispose())
    Object.values(materials).forEach((shared) => shared.dispose())
  }
  return { slots, dispose }
}
