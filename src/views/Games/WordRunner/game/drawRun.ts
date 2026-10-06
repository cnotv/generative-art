import * as THREE from 'three'
import { updateAnimation } from '@webgamekit/animation'
import {
  CAMERA_FOLLOW_RATIO,
  CAMERA_POSITION,
  CAMERA_TARGET,
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

/** Places every gate in view and lights the hint on those still ahead. */
export const drawGates = (slots: GateSlot[], view: GateView): void =>
  slots.forEach((slot, slotIndex) => {
    const gateIndex = visibleGateFor(slotIndex, view)
    if (gateIndex < 0) {
      if (slot.gateKey) hideSlot(slot)
      return
    }
    const gate = view.gates[gateIndex]
    const key = gateKey(view.lapSerial, gateIndex)
    if (slot.gateKey !== key) assignSlot(slot, gate, key)
    const distanceAhead = view.distances[gateIndex] - view.distance
    placeSlot(slot, -distanceAhead, fadeFor(distanceAhead))
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
 * Slides the runner towards its lane and keeps the camera behind it. The camera follows only
 * part of the way, so a lane change visibly moves the runner across the track.
 */
export const createRunnerDrawer = (scene: RunScene) => {
  const lookTarget = new THREE.Vector3(...CAMERA_TARGET)
  return (frame: RunnerFrame): void => {
    const { runner, camera } = scene
    const laneX = laneOffset(frame.targetLane, LANE_COUNT, LANE_WIDTH)
    runner.position.x +=
      (laneX - runner.position.x) * smoothingFactor(LANE_SWITCH_RATE, frame.deltaSeconds)
    updateAnimation({
      actionName: frame.isMoving ? RUNNER_ANIMATION : RUNNER_IDLE_ANIMATION,
      player: runner,
      delta: frame.deltaSeconds,
      speed: RUNNER_ANIMATION_SPEED
    })
    const follow = runner.position.x * CAMERA_FOLLOW_RATIO
    camera.position.set(
      CAMERA_POSITION[0] + follow + frame.shake,
      CAMERA_POSITION[1],
      CAMERA_POSITION[2]
    )
    lookTarget.set(CAMERA_TARGET[0] + follow, CAMERA_TARGET[1], CAMERA_TARGET[2])
    camera.lookAt(lookTarget)
  }
}
