import type { CameraCalibration } from './types'

const STORAGE_KEY = 'rig-animator-camera-calibration'

const FRONT_NUMBER_FIELDS = [
  'shoulderSpanImage',
  'armSpanImage',
  'headHeightImage',
  'shoulderWidthMeters',
  'armSpanMeters'
] as const

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const hasNumbers = (value: unknown, keys: readonly string[]): boolean =>
  isRecord(value) && keys.every((key) => isFiniteNumber(value[key]))

const isFront = (value: unknown): boolean =>
  isRecord(value) &&
  hasNumbers(value, FRONT_NUMBER_FIELDS) &&
  (value.torsoHeightImage === null || isFiniteNumber(value.torsoHeightImage)) &&
  hasNumbers(value.bodyCenterImage, ['x', 'y']) &&
  hasNumbers(value.shoulderDirectionScene, ['x', 'z']) &&
  isRecord(value.handAngles)

const isCameraCalibration = (value: unknown): value is CameraCalibration =>
  isRecord(value) &&
  (value.front === null || isFront(value.front)) &&
  (value.side === null || hasNumbers(value.side, ['depthScale'])) &&
  isRecord(value.rootBoneNames)

/**
 * Persist a calibration so a refresh does not throw away two held T-poses. Never throws: storage
 * can be full, disabled or unavailable, and the calibration still works for this session.
 * @param calibration The calibration to save
 */
export const saveCameraCalibration = (calibration: CameraCalibration): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(calibration))
  } catch {
    // Nothing to do: the calibration stays in memory, it just won't survive a refresh.
  }
}

/**
 * Load a previously saved calibration.
 * @returns The calibration, or null when there is none, it doesn't match the expected shape, or
 *   storage is unavailable
 */
export const loadCameraCalibration = (): CameraCalibration | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isCameraCalibration(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** Clear the saved calibration. Never throws. */
export const clearCameraCalibration = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}
