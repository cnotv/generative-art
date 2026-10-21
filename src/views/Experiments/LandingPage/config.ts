/** Seconds each phase of the wake up and jump lasts, in order. */
export const INTRO_TIMING = {
  wake: 0.9,
  anticipation: 0.35,
  air: 0.65,
  settle: 0.9
}

export const EYE_OPEN_DURATION = 0.3
export const BLINK_START = 0.5
export const BLINK_DURATION = 0.2

export const ANTICIPATION_LEAN = 0.12
export const AIR_LEAN = 0.22
export const ARC_HEIGHT = 3
export const SETTLE_ROCK = 0.15
export const SETTLE_FREQUENCY = 14
export const SETTLE_DAMPING = 5

/** Radians the sleeping logo is turned towards the room, its back against the wall. */
export const SLEEP_YAW = (35 * Math.PI) / 180

/** The letters drop in and bounce to rest while the logo wakes, so they are there to land on. */
export const LETTERS_DROP_START = 0.3
export const LETTERS_DROP_DURATION = 0.6
export const LETTERS_DROP_STAGGER = 0.08
export const LETTERS_DROP_HEIGHT = 14
export const LOGO_ON_LETTERS_GAP = 0.6

export const CORNER_MARGIN = 0.6
export const WALL_GAP = 0.05
export const EYE_FRONT_OFFSET = 0.003
/** Lids overlap the hole's rim so no sliver of it shows when closed. */
export const EYELID_OVERLAP = 1.12
export const EYE_PROBE_STEPS = 24
// A lid scaled to exactly zero has no inverse matrix, which breaks raycasting the logo.
export const EYELID_MIN_SCALE = 0.001
export const EYE_SEGMENTS = 32

/** The logo's white eyes in logobw.svg coordinates, and the body's extent they sit in. */
export const SVG_BODY_BOUNDS = { minX: 13.4, maxX: 363.6, minY: 84.4, maxY: 279.2 }
export const SVG_EYES = [
  { x: 130.5, y: 225.5, radius: 20 },
  { x: 240.5, y: 225.5, radius: 20 }
]

export const ROOM_WALL_COLOR = 0x1d2738
export const ROOM_FLOOR_COLOR = 0x2a3547
export const ROOM_SIZE = 80
export const ROOM_ROUGHNESS = 0.9
export const ROOM_COLLIDER_DEPTH = 1

export const SLEEP_AMBIENT_INTENSITY = 0.06
export const SLEEP_DIRECTIONAL_INTENSITY = 0
export const SPOT_INTENSITY = 500
/** Where the spotlight hangs relative to what it lights: off to the side, low, a little forward. */
export const SPOT_SIDE = 11
export const SPOT_HEIGHT = 4
export const SPOT_FORWARD = 4
export const SPOT_ANGLE = 0.6
export const SPOT_PENUMBRA = 0.8

export const OWNER_NAME = 'Giuseppe Leo'
export const OWNER_PROFESSION = 'Frontend Developer'
export const SPOT_COLOR = 0xc9d8ff

export const SKILL_AREAS = [
  'Frontend development',
  'CI automation',
  'AI automations',
  'UX',
  'Kubernetes (K8S)',
  'NLG and NLU domain knowledge without LLMs, for publishers',
  'Tailor-made classification and generation software'
]

export const PRODUCT_SECTORS = [
  'Banks',
  'Telco',
  'Publishers',
  'Governance',
  'Defense',
  'Public institutions'
]
