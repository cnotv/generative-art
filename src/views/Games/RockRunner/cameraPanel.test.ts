import { describe, it, expect } from 'vitest'
import {
  RR_CAMERA_CONTROLS,
  RR_CAMERA_MODE_CONTROLS,
  DEFAULT_RUN_CAMERA,
  cameraSchemaFor
} from './cameraPanel'
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

describe('cameraSchemaFor', () => {
  // Eight sliders at once was a wall of which two thirds described cameras the
  // player was not looking through, with nothing saying which two mattered.
  it.each(['third', 'first', 'free'] as const)("shows only %s's own offsets", (mode) => {
    const keys = Object.keys(cameraSchemaFor(mode))
    const others = (['third', 'first', 'free'] as const)
      .filter((other) => other !== mode)
      .flatMap((other) => Object.keys(RR_CAMERA_MODE_CONTROLS[other]))

    expect(keys).toEqual(expect.arrayContaining(Object.keys(RR_CAMERA_MODE_CONTROLS[mode])))
    others.forEach((key) => expect(keys).not.toContain(key))
  })

  it.each(['third', 'first', 'free'] as const)('offers the tabs from within %s', (mode) => {
    expect(Object.keys(cameraSchemaFor(mode))).toContain('mode')
  })

  // Rendered as a row of buttons rather than a dropdown, which is what makes it
  // read as tabs over the settings beneath.
  it('draws the selector as buttons, one per camera', () => {
    const selector = cameraSchemaFor('third').mode as {
      component: string
      options: { value: string }[]
    }

    expect(selector.component).toBe('ButtonSelector')
    expect(selector.options.map((option) => option.value)).toEqual(['third', 'first', 'free'])
  })

  it('keeps the shared settings on every tab', () => {
    ;(['third', 'first', 'free'] as const).forEach((mode) => {
      expect(Object.keys(cameraSchemaFor(mode))).toContain('transitionSeconds')
    })
  })

  // Between them the tabs have to reach every value the config holds, or one
  // would be unreachable from the panel entirely.
  it('reaches every offset across the three tabs', () => {
    const across = (['third', 'first', 'free'] as const).flatMap((mode) =>
      Object.keys(cameraSchemaFor(mode))
    )

    Object.keys(DEFAULT_RUN_CAMERA).forEach((key) => expect(across).toContain(key))
  })
})
