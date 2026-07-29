import { describe, it, expect } from 'vitest'
import { RR_CAMERA_CONTROLS, DEFAULT_RUN_CAMERA } from './cameraPanel'
import {
  CHASE_BACK,
  CHASE_HEIGHT,
  CAMERA_TRANSITION_SECONDS,
  FIRST_PERSON_FORWARD,
  FIRST_PERSON_HEIGHT,
  FIRST_PERSON_LOOK_AHEAD,
  FREE_CAM_BACK,
  FREE_CAM_HEIGHT,
  ROCK_RADIUS
} from './config'

type Control = { min: number; max: number; step: number; label: string }
const controls = RR_CAMERA_CONTROLS as Record<string, Control>

describe('DEFAULT_RUN_CAMERA', () => {
  it('ships the offsets the constants describe', () => {
    expect(DEFAULT_RUN_CAMERA).toEqual({
      thirdPersonHeight: CHASE_HEIGHT,
      thirdPersonBack: CHASE_BACK,
      firstPersonHeight: FIRST_PERSON_HEIGHT,
      firstPersonForward: FIRST_PERSON_FORWARD,
      firstPersonLookAhead: FIRST_PERSON_LOOK_AHEAD,
      freeCamHeight: FREE_CAM_HEIGHT,
      freeCamBack: FREE_CAM_BACK,
      transitionSeconds: CAMERA_TRANSITION_SECONDS
    })
  })

  it('offers a control for every offset it holds', () => {
    expect(Object.keys(controls).sort()).toEqual(Object.keys(DEFAULT_RUN_CAMERA).sort())
  })
})

describe('RR_CAMERA_CONTROLS', () => {
  it.each(Object.entries(DEFAULT_RUN_CAMERA))(
    'leaves %s adjustable in both directions from its shipped value',
    (name, value) => {
      expect(controls[name].min).toBeLessThanOrEqual(value as number)
      expect(controls[name].max).toBeGreaterThanOrEqual(value as number)
      expect(controls[name].max).toBeGreaterThan(controls[name].min)
    }
  )

  it.each(Object.keys(DEFAULT_RUN_CAMERA))('gives %s a label and a usable step', (name) => {
    expect(controls[name].label).toBeTruthy()
    expect(controls[name].step).toBeGreaterThan(0)
  })

  // The first-person view is level rather than angled down, so eye height is
  // the only thing setting how much of the path ahead is visible — and it is
  // measured from a centre already sitting a radius above the deck.
  it('puts the first-person eye well clear of the deck', () => {
    expect(FIRST_PERSON_HEIGHT + ROCK_RADIUS).toBeGreaterThan(ROCK_RADIUS * 2)
  })

  // Far enough forward that the ball falls behind the camera, which is what
  // stops a player seeing their own body.
  it('pushes the eye past the ball it is riding', () => {
    expect(FIRST_PERSON_FORWARD).toBeGreaterThan(ROCK_RADIUS)
  })

  it('lets the mode change be made instant', () => {
    expect(controls.transitionSeconds.min).toBe(0)
  })

  // The free camera exists to look at the whole scene, so it has to pull back
  // further than the chase camera ever does.
  it('lets the free camera reach further out than the chase camera', () => {
    expect(controls.freeCamBack.max).toBeGreaterThan(controls.thirdPersonBack.max)
    expect(controls.freeCamHeight.max).toBeGreaterThan(controls.thirdPersonHeight.max)
  })
})
