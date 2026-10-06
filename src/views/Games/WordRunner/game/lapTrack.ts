import { FEATURE_OFFSET, GATE_SPACING, LEAD_IN_DISTANCE } from '../config'
import { crossedGateIndices, gateDistances } from '../runner/runMotion'
import type { Gate, GateView, RouteFeature, TrackPath } from '../types'

/**
 * Where the runner is on the current lap: how far along the course, where each gate and the
 * route feature after it stand, and which of them the last step crossed. A lap always starts
 * from the start of the course, which is what makes every lap the same route.
 */
export const createLapTrack = () => {
  let distance = 0
  let distances: number[] = []
  let featureDistances: number[] = []
  let features: RouteFeature[] = []
  // Keys the pooled gates by lap as it is run, not by lap index: the index moves on the
  // moment the last gate is passed, while that gate is still on screen during the recap.
  let lapSerial = 0
  let snapCamera = true

  const begin = (gateCount: number, gateFeatures: RouteFeature[]): void => {
    distance = 0
    distances = gateDistances(0, gateCount, LEAD_IN_DISTANCE, GATE_SPACING)
    featureDistances = distances.map((gateDistance) => gateDistance + FEATURE_OFFSET)
    features = gateFeatures
    lapSerial += 1
    snapCamera = true
  }

  /** Moves the runner on and reports the gates and the route features it went through. */
  const move = (stepDistance: number): { gates: number[]; features: number[] } => {
    const previousDistance = distance
    distance += stepDistance
    return {
      gates: crossedGateIndices(previousDistance, distance, distances),
      features: crossedGateIndices(previousDistance, distance, featureDistances)
    }
  }

  const clear = (): void => {
    distance = 0
    distances = []
    featureDistances = []
    snapCamera = true
  }

  /** Whether the camera should cut rather than glide this frame; true once after each restart. */
  const takeSnap = (): boolean => {
    const shouldSnap = snapCamera
    snapCamera = false
    return shouldSnap
  }

  const view = (path: TrackPath, gates: Gate[]): GateView => ({
    path,
    gates,
    features,
    distances,
    distance,
    lapSerial
  })

  return {
    begin,
    move,
    clear,
    takeSnap,
    view,
    distance: () => distance,
    lapSerial: () => lapSerial,
    featureAt: (gateIndex: number) => features[gateIndex]
  }
}
