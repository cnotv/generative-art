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

/** Session storage key set once the intro has played, so it does not replay in the session. */
export const INTRO_SEEN_KEY = 'landing-intro-seen'

/** Seconds after the scene is ready before the logo wakes up on its own. */
export const AUTO_WAKE_DELAY = 0.5

/** Radians the sleeping logo is turned towards the room, its back against the wall. */
export const SLEEP_YAW = (35 * Math.PI) / 180

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
/** The key light once awake, as tuned in the Lights panel: in front, to the right and low. */
export const DIRECTIONAL_LIGHT_POSITION = [5, 3, 5] as const
export const SPOT_INTENSITY = 500
/** Where the spotlight hangs relative to what it lights: off to the side, low, a little forward. */
export const SPOT_SIDE = 11
export const SPOT_HEIGHT = 4
export const SPOT_FORWARD = 4
export const SPOT_ANGLE = 0.6
export const SPOT_PENUMBRA = 0.8

export const OWNER_NAME = 'Giuseppe Leo'
export const OWNER_PROFESSION = 'Senior Frontend Developer'
export const OWNER_SUMMARY = '15+ years building, from startup to enterprise.'
export const OWNER_PROFILES = [
  { label: 'LinkedIn', icon: 'linkedin', url: 'https://www.linkedin.com/in/leogiuseppe/' },
  { label: 'GitHub', icon: 'github', url: 'https://github.com/cnotv' }
]
export const SPOT_COLOR = 0xc9d8ff

/** Areas of work, each with its district in the skills city model. */
export const SKILL_AREAS = [
  {
    district: 'district-frontend',
    title: 'Frontend development',
    line: 'Interfaces, design systems and real-time 3D in the browser.'
  },
  {
    district: 'district-ci',
    title: 'CI automation',
    line: 'Pipelines that test, build and ship every change.'
  },
  {
    district: 'district-ai',
    title: 'AI automations',
    line: 'Agents and workflows that take over the repetitive work.'
  },
  {
    district: 'district-ux',
    title: 'UX',
    line: 'Flows shaped around how people actually use them.'
  },
  {
    district: 'district-k8s',
    title: 'Kubernetes',
    line: 'Running and scaling services on K8S clusters.'
  },
  {
    district: 'district-nlg',
    title: 'NLG and NLU',
    line: 'Language understanding and generation on self-hosted and trained models.'
  },
  {
    district: 'district-mentoring',
    title: 'Mentoring',
    line: 'Growing developers and teams through reviews, guidelines and regular sessions.'
  },
  {
    district: 'district-architecture',
    title: 'Architecture',
    line: 'Planning architecture and paying down tech debt across projects and teams.'
  }
]

/** Sectors whose organisations use the products, each with its avatar in the avatars model. */
export const PRODUCT_SECTORS = [
  { avatar: 'bank', title: 'Banks' },
  { avatar: 'telco', title: 'Telco' },
  { avatar: 'publisher', title: 'Publishers' },
  { avatar: 'governance', title: 'Governance' },
  { avatar: 'defense', title: 'Defense' },
  { avatar: 'public', title: 'Public institutions' }
]

export const MARKET_AVATARS_MODEL = 'market-avatars.glb'
/** How far past its bounding sphere each avatar's camera frames it. */
export const AVATAR_FRAME_PADDING = 1.05

/** How far above the market section the traces to the sectors start: the island's southern tip. */
export const SECTOR_TRACE_ORIGIN_RISE = 104
/** How far short of a sector's avatar its arrow stops, in pixels. */
export const SECTOR_ARROW_GAP = 6

export const SKILLS_CITY_MODEL = 'skills-city.glb'
/** Direction the isometric camera looks at the city from, matching the Blender preview. */
export const CITY_VIEW_DIRECTION = [14, 18, 20] as const
export const CITY_CAMERA_DISTANCE = 60
export const CITY_CAMERA_NEAR = 0.1
export const CITY_FRAME_PADDING = 1.04
export const CITY_SKY_COLOR = 0xc9d8ff
export const CITY_GROUND_COLOR = 0x1d2738
export const CITY_AMBIENT_INTENSITY = 2.2
export const CITY_KEY_COLOR = 0xe6eeff
export const CITY_KEY_INTENSITY = 2.4
export const CITY_KEY_POSITION = [18, 14, 6] as const
export const CITY_SHADOW_EXTENT = 14
export const CITY_SHADOW_MAP_SIZE = 2048
export const DISTRICT_LIFT = 0.6
export const DISTRICT_LIFT_EASE = 0.2
export const DISTRICT_LIFT_SETTLED = 0.002
export const CITY_MAX_PIXEL_RATIO = 2
