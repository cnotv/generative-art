import * as THREE from 'three'
import {
  GATE_BEAM_DEPTH,
  GATE_BEAM_HEIGHT,
  GATE_POST_HEIGHT,
  GATE_POST_RADIUS,
  LANDMARK_BALL,
  LANDMARK_COLORS,
  LANDMARK_CONE,
  LANDMARK_GEM,
  LANDMARK_RING,
  LANDMARK_SEGMENTS,
  LANDMARK_SIDE_OFFSET,
  LANDMARK_TOWER,
  LANE_COUNT,
  LANE_WIDTH,
  POST_COLOR,
  SIGN_HEIGHT,
  SIGN_WIDTH,
  SIGN_Y
} from '../config'
import { laneOffset } from '../runner/runMotion'
import { createSignCanvas, drawSign } from './signTexture'
import type { Gate, GateSign, GateSlot, SignState } from '../types'

const POST_SEGMENTS = 10
// Posts stand on the lane boundaries, half a lane either side of each lane's centre.
const HALF_LANE = 0.5

type SharedGeometry = {
  post: THREE.CylinderGeometry
  beam: THREE.BoxGeometry
  sign: THREE.PlaneGeometry
  landmarks: THREE.BufferGeometry[]
}

/**
 * The landmark shapes, one per kind of place: a tree, a tower, a ball on a plinth, a ring and
 * a gem. Each sits with its base on the ground.
 */
const createLandmarkGeometries = (): THREE.BufferGeometry[] => [
  new THREE.ConeGeometry(LANDMARK_CONE.radius, LANDMARK_CONE.height, LANDMARK_SEGMENTS).translate(
    0,
    LANDMARK_CONE.height / 2,
    0
  ),
  new THREE.BoxGeometry(
    LANDMARK_TOWER.width,
    LANDMARK_TOWER.height,
    LANDMARK_TOWER.width
  ).translate(0, LANDMARK_TOWER.height / 2, 0),
  new THREE.SphereGeometry(LANDMARK_BALL.radius, LANDMARK_SEGMENTS, LANDMARK_SEGMENTS).translate(
    0,
    LANDMARK_BALL.lift,
    0
  ),
  new THREE.TorusGeometry(
    LANDMARK_RING.radius,
    LANDMARK_RING.tube,
    LANDMARK_SEGMENTS / 2,
    LANDMARK_SEGMENTS
  ).translate(0, LANDMARK_RING.lift, 0),
  new THREE.OctahedronGeometry(LANDMARK_GEM.radius).translate(0, LANDMARK_GEM.lift, 0)
]

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
  landmarks: createLandmarkGeometries()
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

const createSlot = (scene: THREE.Scene, geometry: SharedGeometry, slotIndex: number): GateSlot => {
  const group = new THREE.Group()
  group.name = `word-gate-${slotIndex}`
  const frameMaterial = new THREE.MeshLambertMaterial({ color: POST_COLOR, transparent: true })
  const landmarkMaterial = new THREE.MeshLambertMaterial({ transparent: true })
  const signs = Array.from({ length: LANE_COUNT }, (_, lane) => createSign(geometry.sign, lane))
  const landmark = new THREE.Mesh(geometry.landmarks[0], landmarkMaterial)
  landmark.name = `landmark-${slotIndex}`
  group.add(...createFrame(geometry, frameMaterial), ...signs.map((sign) => sign.mesh), landmark)
  group.visible = false
  scene.add(group)
  return {
    group,
    signs,
    landmark,
    landmarkShapes: geometry.landmarks,
    landmarkMaterial,
    frameMaterial,
    gateKey: null
  }
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
 * Dresses a pooled slot as one gate of the lap. The landmark follows the word's position in
 * the phrase, not the gate's lanes, so it is the same place on every lap, shuffled or not.
 */
export const assignSlot = (slot: GateSlot, gate: Gate, gateKey: string): void => {
  slot.gateKey = gateKey
  gate.options.forEach((word, lane) => setSignState(slot.signs[lane], word, 'idle'))
  slot.landmark.geometry = slot.landmarkShapes[gate.position % slot.landmarkShapes.length]
  slot.landmark.position.x = (gate.position % 2 === 0 ? -1 : 1) * LANDMARK_SIDE_OFFSET
  slot.landmarkMaterial.color.setHex(LANDMARK_COLORS[gate.position % LANDMARK_COLORS.length])
}

/** Puts a slot at a point on the track and fades it in or out by the given opacity. */
export const placeSlot = (slot: GateSlot, z: number, opacity: number): void => {
  slot.group.visible = opacity > 0
  slot.group.position.z = z
  slot.frameMaterial.opacity = opacity
  slot.landmarkMaterial.opacity = opacity
  slot.signs.forEach((sign) => {
    sign.material.opacity = opacity
  })
}

export const hideSlot = (slot: GateSlot): void => {
  slot.group.visible = false
  slot.gateKey = null
}

/** Every gate slot the track can show at once, built up front so nothing is created mid-run. */
export const createGatePool = (
  scene: THREE.Scene,
  poolSize: number
): { slots: GateSlot[]; dispose: () => void } => {
  const geometry = createSharedGeometry()
  const slots = Array.from({ length: poolSize }, (_, slotIndex) =>
    createSlot(scene, geometry, slotIndex)
  )
  const dispose = (): void => {
    slots.forEach((slot) => {
      scene.remove(slot.group)
      slot.frameMaterial.dispose()
      slot.landmarkMaterial.dispose()
      slot.signs.forEach((sign) => {
        sign.texture.dispose()
        sign.material.dispose()
      })
    })
    ;[geometry.post, geometry.beam, geometry.sign, ...geometry.landmarks].forEach((shared) =>
      shared.dispose()
    )
  }
  return { slots, dispose }
}
