import * as THREE from 'three'
import { attachRockStroke } from '@/views/Games/RockRunner/elements/rockStroke'
import {
  ROCK_RENDER_ORDER,
  ROCK_STROKE_WIDTH,
  ROCK_STROKE_WOBBLE
} from '@/views/Games/RockRunner/config'
import {
  GATE_BEAM_DEPTH,
  GATE_BEAM_HEIGHT,
  GATE_POST_HEIGHT,
  GATE_POST_RADIUS,
  GRAVEL,
  LANE_COUNT,
  LANE_WIDTH,
  POST_COLOR,
  RAMP,
  ROCK,
  SIGN_HEIGHT,
  SIGN_WIDTH,
  SIGN_Y
} from '../config'
import { laneOffset } from '../runner/runMotion'
import { createSignCanvas, drawSign } from './signTexture'
import type {
  Gate,
  GateFeatures,
  GateSign,
  GateSlot,
  RouteFeature,
  SignState,
  TrackSample
} from '../types'

const POST_SEGMENTS = 10
// Posts stand on the lane boundaries, half a lane either side of each lane's centre.
const HALF_LANE = 0.5

type SharedGeometry = {
  post: THREE.CylinderGeometry
  beam: THREE.BoxGeometry
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
  post: new THREE.CylinderGeometry(
    GATE_POST_RADIUS,
    GATE_POST_RADIUS,
    GATE_POST_HEIGHT,
    POST_SEGMENTS
  ).translate(0, GATE_POST_HEIGHT / 2, 0),
  beam: new THREE.BoxGeometry(
    LANE_COUNT * LANE_WIDTH + GATE_POST_RADIUS * 2,
    GATE_BEAM_HEIGHT,
    GATE_BEAM_DEPTH
  ),
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

const createFrame = (
  geometry: SharedGeometry,
  material: THREE.MeshLambertMaterial
): THREE.Mesh[] => {
  const posts = Array.from({ length: LANE_COUNT + 1 }, (_, edge) => {
    const post = new THREE.Mesh(geometry.post, material)
    post.position.x = laneOffset(edge - HALF_LANE, LANE_COUNT, LANE_WIDTH)
    return post
  })
  const beam = new THREE.Mesh(geometry.beam, material)
  beam.position.y = GATE_POST_HEIGHT
  return [...posts, beam]
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
  return { group, ramp, rocks, gravel }
}

const createSlot = (
  scene: THREE.Scene,
  geometry: SharedGeometry,
  materials: SharedMaterials,
  slotIndex: number
): GateSlot => {
  const group = new THREE.Group()
  group.name = `word-gate-${slotIndex}`
  const frameMaterial = new THREE.MeshLambertMaterial({ color: POST_COLOR, transparent: true })
  const signs = Array.from({ length: LANE_COUNT }, (_, lane) => createSign(geometry.sign, lane))
  group.add(...createFrame(geometry, frameMaterial), ...signs.map((sign) => sign.mesh))
  const features = createFeatures(geometry, materials)
  features.group.name = `route-feature-${slotIndex}`
  group.visible = false
  features.group.visible = false
  scene.add(group, features.group)
  return { group, signs, features, frameMaterial, gateKey: null }
}

/** Redraws a sign only when its word or state actually changed, since a redraw re-uploads it. */
export const setSignState = (sign: GateSign, word: string, state: SignState): void => {
  if (sign.word === word && sign.state === state) return
  sign.word = word
  sign.state = state
  drawSign(sign.canvas, word, state)
  sign.texture.needsUpdate = true
}

/**
 * Lays out what each lane leads to: a ramp on the right lane, rocks on every other one, or
 * gravel on the outside of a bend so only the inside line holds its speed.
 */
const showFeature = (features: GateFeatures, feature: RouteFeature, correctLane: number): void => {
  features.ramp.visible = feature === 'ramp'
  features.ramp.position.x = laneOffset(correctLane, LANE_COUNT, LANE_WIDTH)
  features.rocks.forEach((rock, lane) => {
    rock.visible = feature === 'rocks' && lane !== correctLane
  })
  features.gravel.forEach((patch, lane) => {
    patch.visible = feature === 'bend' && lane !== correctLane
  })
}

/** Dresses a pooled slot as one gate of the lap and the route feature that follows it. */
export const assignSlot = (
  slot: GateSlot,
  gate: Gate,
  feature: RouteFeature,
  gateKey: string
): void => {
  slot.gateKey = gateKey
  gate.options.forEach((word, lane) => setSignState(slot.signs[lane], word, 'idle'))
  showFeature(slot.features, feature, gate.correctLane)
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
  slot.frameMaterial.opacity = opacity
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
      slot.frameMaterial.dispose()
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
