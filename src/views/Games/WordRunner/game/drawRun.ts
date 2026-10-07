import * as THREE from 'three'
import { followCameraPlacement } from '@webgamekit/threejs'
import {
  BALL,
  CAMERA_FOLLOW_RATE,
  CAMERA_TARGET_HEIGHT,
  CHASE_CAMERA,
  FEATURE_OFFSET,
  GATE_BEHIND_DISTANCE,
  GATE_FADE_DISTANCE,
  GATE_POOL_SIZE,
  GATE_SPAWN_DISTANCE,
  LANE_COUNT,
  LANE_SWITCH_RATE,
  LANE_WIDTH,
  LATE_HINT_DISTANCE
} from '../config'
import { isHintShown, laneOffset, smoothingFactor } from '../runner/runMotion'
import { assignSlot, hideSlot, placeSlot, setSignState } from '../scene/gatePool'
import type {
  BallFrame,
  Gate,
  GateSlot,
  GateView,
  RaceFrame,
  RivalFrame,
  RunScene,
  TrackPath
} from '../types'

const CENTRE_LANE = Math.floor(LANE_COUNT / 2)
const UNTINTED = '#ffffff'

export const gateKey = (runSerial: number, gateIndex: number): string => `${runSerial}:${gateIndex}`

/** Gates fade in as they come over the horizon and out as they pass the camera. */
const fadeFor = (distanceAhead: number): number =>
  distanceAhead < 0
    ? Math.max(0, 1 + distanceAhead / GATE_BEHIND_DISTANCE)
    : Math.min(1, Math.max(0, (GATE_SPAWN_DISTANCE - distanceAhead) / GATE_FADE_DISTANCE))

/** The level's gate this pooled slot should show now, or -1 when none of its gates is in view. */
const visibleGateFor = (slotIndex: number, view: GateView): number =>
  view.distances.findIndex((gateDistance, gateIndex) => {
    const distanceAhead = gateDistance - view.distance
    return (
      gateIndex % GATE_POOL_SIZE === slotIndex &&
      distanceAhead >= -GATE_BEHIND_DISTANCE &&
      distanceAhead <= GATE_SPAWN_DISTANCE
    )
  })

/** Stands every gate in view on the track, with its route feature, and lights hints ahead. */
export const drawGates = (slots: GateSlot[], view: GateView): void =>
  slots.forEach((slot, slotIndex) => {
    const gateIndex = visibleGateFor(slotIndex, view)
    if (gateIndex < 0) {
      if (slot.gateKey) hideSlot(slot)
      return
    }
    const gate = view.gates[gateIndex]
    const key = gateKey(view.runSerial, gateIndex)
    if (slot.gateKey !== key) assignSlot(slot, gate, view.features[gateIndex], key)
    const gateDistance = view.distances[gateIndex]
    const distanceAhead = gateDistance - view.distance
    placeSlot(
      slot,
      view.path.sampleAt(gateDistance),
      view.path.sampleAt(gateDistance + FEATURE_OFFSET),
      fadeFor(distanceAhead)
    )
    if (distanceAhead <= 0) return
    const hinted = isHintShown(gate.hint, distanceAhead, LATE_HINT_DISTANCE)
    setSignState(
      slot.signs[gate.correctLane],
      gate.options[gate.correctLane],
      hinted ? 'hint' : 'idle'
    )
  })

/** Colours the lane just run through, and shows where the right word was if it was not that one. */
export const markPassedGate = (
  slots: GateSlot[],
  key: string,
  gate: Gate,
  chosenLane: number
): void => {
  const slot = slots.find((candidate) => candidate.gateKey === key)
  if (!slot) return
  const correct = chosenLane === gate.correctLane
  setSignState(slot.signs[chosenLane], gate.options[chosenLane], correct ? 'right' : 'wrong')
  if (!correct) {
    setSignState(slot.signs[gate.correctLane], gate.options[gate.correctLane], 'reveal')
  }
}

/**
 * Rolls one ball along the track at its lane's offset, sliding between lanes rather than
 * jumping, and turning about its own axis by exactly the distance it has covered.
 */
const createBallDrawer = (ball: THREE.Mesh) => {
  let lateral = laneOffset(CENTRE_LANE, LANE_COUNT, LANE_WIDTH)
  return (path: TrackPath, frame: BallFrame, deltaSeconds: number, snap: boolean): number => {
    const sample = path.sampleAt(frame.distance)
    const laneX = laneOffset(frame.lane, LANE_COUNT, LANE_WIDTH)
    lateral = snap
      ? laneX
      : lateral + (laneX - lateral) * smoothingFactor(LANE_SWITCH_RATE, deltaSeconds)
    ball.position.copy(sample.position).addScaledVector(sample.right, lateral)
    ball.position.y += BALL.radius + frame.hop
    ball.rotation.y = sample.yaw
    ball.rotation.x = frame.distance / BALL.radius
    return lateral
  }
}

/**
 * One see-through rival ball: drawn and tinted in its player's colour while it has a rival to
 * show, hidden while it has none. The bot keeps its rock's own colours.
 */
const createGhostDrawer = (ghost: THREE.Mesh) => {
  const drawBall = createBallDrawer(ghost)
  let tint: string | null = null
  return (path: TrackPath, rival: RivalFrame | undefined, deltaSeconds: number, snap: boolean) => {
    ghost.visible = rival !== undefined
    if (!rival) return
    if (rival.color !== tint && ghost.material instanceof THREE.MeshLambertMaterial) {
      ghost.material.color.set(rival.color ?? UNTINTED)
      tint = rival.color
    }
    drawBall(path, rival, deltaSeconds, snap)
  }
}

/**
 * Draws every ball and keeps a chase camera behind the player's. The camera aims at the deck
 * rather than the ball, so a hop off a ramp lifts the ball in frame instead of jolting the view.
 */
export const createRaceDrawer = (scene: RunScene) => {
  const cameraTarget = new THREE.Vector3()
  const drawPlayer = createBallDrawer(scene.player)
  const drawGhosts = scene.ghosts.map(createGhostDrawer)
  return (frame: RaceFrame): void => {
    const { camera } = scene
    const lateral = drawPlayer(frame.path, frame.player, frame.deltaSeconds, frame.snapCamera)
    drawGhosts.forEach((drawGhost, index) =>
      drawGhost(frame.path, frame.rivals[index], frame.deltaSeconds, frame.snapCamera)
    )

    const sample = frame.path.sampleAt(frame.player.distance)
    cameraTarget
      .copy(sample.position)
      .addScaledVector(sample.right, lateral + frame.shake)
      .setY(sample.position.y + CAMERA_TARGET_HEIGHT)
    const placement = followCameraPlacement('third', cameraTarget, sample.forward, CHASE_CAMERA)
    if (frame.snapCamera) camera.position.copy(placement.position)
    else {
      camera.position.lerp(
        placement.position,
        smoothingFactor(CAMERA_FOLLOW_RATE, frame.deltaSeconds)
      )
    }
    camera.lookAt(placement.lookAt)
  }
}

/** One frame of the race: the gates in view, then the balls and the camera behind the player. */
export const drawRaceFrame = (
  slots: GateSlot[],
  drawRace: (frame: RaceFrame) => void,
  view: GateView,
  frame: RaceFrame
): void => {
  drawGates(slots, view)
  drawRace(frame)
}
