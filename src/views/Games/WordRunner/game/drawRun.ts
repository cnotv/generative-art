import * as THREE from 'three'
import { updateAnimation } from '@webgamekit/animation'
import { followCameraPlacement } from '@webgamekit/threejs'
import {
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
  LATE_HINT_DISTANCE,
  RUNNER_ANIMATION,
  RUNNER_ANIMATION_SPEED,
  RUNNER_IDLE_ANIMATION
} from '../config'
import { isHintShown, laneOffset, smoothingFactor } from '../runner/runMotion'
import { assignSlot, hideSlot, placeSlot, setSignState } from '../scene/gatePool'
import type { Gate, GateSlot, GateView, RunnerFrame, RunScene } from '../types'

// The model faces backwards once loaded, so a heading of zero needs half a turn on top.
const RUNNER_FACING = Math.PI
const CENTRE_LANE = Math.floor(LANE_COUNT / 2)

export const gateKey = (lapSerial: number, gateIndex: number): string => `${lapSerial}:${gateIndex}`

/** Gates fade in as they come over the horizon and out as they pass the camera. */
const fadeFor = (distanceAhead: number): number =>
  distanceAhead < 0
    ? Math.max(0, 1 + distanceAhead / GATE_BEHIND_DISTANCE)
    : Math.min(1, Math.max(0, (GATE_SPAWN_DISTANCE - distanceAhead) / GATE_FADE_DISTANCE))

/** The lap's gate this pooled slot should show now, or -1 when none of its gates is in view. */
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
    const key = gateKey(view.lapSerial, gateIndex)
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
 * Carries the runner along the track at its lane's offset, and keeps a chase camera behind
 * it. The camera aims at the deck rather than the runner, so a hop off a ramp lifts the
 * runner in frame instead of jolting the whole view.
 */
export const createRunnerDrawer = (scene: RunScene) => {
  const cameraTarget = new THREE.Vector3()
  let lateral = laneOffset(CENTRE_LANE, LANE_COUNT, LANE_WIDTH)
  return (frame: RunnerFrame): void => {
    const { runner, camera, runnerFootLift } = scene
    const sample = frame.path.sampleAt(frame.distance)
    const laneX = laneOffset(frame.targetLane, LANE_COUNT, LANE_WIDTH)
    lateral += (laneX - lateral) * smoothingFactor(LANE_SWITCH_RATE, frame.deltaSeconds)
    runner.position.copy(sample.position).addScaledVector(sample.right, lateral)
    runner.position.y += runnerFootLift + frame.hop
    runner.rotation.y = sample.yaw + RUNNER_FACING
    updateAnimation({
      actionName: frame.isMoving ? RUNNER_ANIMATION : RUNNER_IDLE_ANIMATION,
      player: runner,
      delta: frame.deltaSeconds,
      speed: RUNNER_ANIMATION_SPEED
    })

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

/** One frame of the run: the gates in view, then the runner and the camera behind it. */
export const drawRunFrame = (
  slots: GateSlot[],
  drawRunner: (frame: RunnerFrame) => void,
  view: GateView,
  runner: Omit<RunnerFrame, 'path' | 'distance'>
): void => {
  drawGates(slots, view)
  drawRunner({ path: view.path, distance: view.distance, ...runner })
}
