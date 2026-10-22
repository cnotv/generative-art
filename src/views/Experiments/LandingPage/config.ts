import type { SkillArea, HeroLook } from './types'

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

export const ROOM_SIZE = 80
export const ROOM_ROUGHNESS = 0.9
export const ROOM_COLLIDER_DEPTH = 1

export const SLEEP_AMBIENT_INTENSITY = 0.06
export const SLEEP_DIRECTIONAL_INTENSITY = 0
/** How much of the hero's light is gone once the page has scrolled past it. */
export const HERO_SCROLL_DIMMING = 0.85
/**
 * Navy cardstock: the paper's texture, how many times it repeats per scene unit, how strongly its
 * fibres raise the surface, and the side the emboss lights.
 */
export const PAPER_TEXTURE_SIZE = 256
export const PAPER_WORLD_DENSITY = 0.25
export const PAPER_TONE_RANGE = [196, 255] as const
export const PAPER_FIBRE_COUNT = 420
export const PAPER_BUMP_SCALE = 0.8
export const EMBOSS_LIGHT_DIRECTION = [-0.6, 0.8] as const

/** The rim: a cool glow on faces turned side-on to the camera, and how tightly it hugs the edges. */
export const RIM_LIGHT_COLOR = 0x9fb8ff
export const RIM_LIGHT_POWER = 3

/**
 * Every finish tried for the hero, picked from the Config panel or with ?look= in the address.
 * The original lighting, the first pass with a rim, navy cardstock with an embossed logo, a light
 * letterpress card with the logo in ink, dark satin chrome with a faint, blurred reflection of the
 * skills city, and polished chrome mirroring it clearly.
 */
export const HERO_LOOKS: Record<string, HeroLook> = {
  original: {
    label: 'Original',
    wallColor: 0x1d2738,
    floorColor: 0x2a3547,
    logoColor: 0x1d2738,
    logoRoughness: 0.9,
    logoMetalness: 0,
    paper: false,
    embossStrength: 0,
    rimStrength: 0,
    ambientIntensity: 0.8,
    key: { color: 0xffffff, intensity: 1.2, position: [5, 3, 5] },
    spot: {
      color: 0xc9d8ff,
      intensity: 500,
      side: 11,
      height: 4,
      forward: 4,
      angle: 0.6,
      penumbra: 0.8
    },
    shadowRadius: 1,
    ink: false,
    reflection: 0,
    reflectionBlur: 0
  },
  rim: {
    label: 'Rim light',
    wallColor: 0x1d2738,
    floorColor: 0x2a3547,
    logoColor: 0x27334c,
    logoRoughness: 0.7,
    logoMetalness: 0,
    paper: false,
    embossStrength: 0,
    rimStrength: 0.22,
    ambientIntensity: 0.8,
    key: { color: 0xffffff, intensity: 0.9, position: [3, 5, 10] },
    spot: {
      color: 0xc9d8ff,
      intensity: 500,
      side: 5,
      height: 10,
      forward: 7,
      angle: 0.36,
      penumbra: 0.75
    },
    shadowRadius: 6,
    ink: false,
    reflection: 0,
    reflectionBlur: 0
  },
  cardstock: {
    label: 'Navy cardstock',
    wallColor: 0x1d2738,
    floorColor: 0x2a3547,
    logoColor: 0x243049,
    logoRoughness: 0.95,
    logoMetalness: 0,
    paper: true,
    embossStrength: 0.9,
    rimStrength: 0,
    ambientIntensity: 0.95,
    key: { color: 0xffffff, intensity: 0.9, position: [-4, 6, 10] },
    spot: {
      color: 0xc9d8ff,
      intensity: 380,
      side: 5,
      height: 10,
      forward: 7,
      angle: 0.36,
      penumbra: 1
    },
    shadowRadius: 10,
    ink: false,
    reflection: 0,
    reflectionBlur: 0
  },
  letterpress: {
    label: 'Letterpress',
    wallColor: 0xf6f0e4,
    floorColor: 0xeee5d4,
    logoColor: 0x26324d,
    logoRoughness: 0.9,
    logoMetalness: 0,
    paper: true,
    embossStrength: 0.5,
    rimStrength: 0,
    ambientIntensity: 1.25,
    key: { color: 0xfff0dc, intensity: 1.4, position: [-4, 6, 10] },
    spot: {
      color: 0xfff4e6,
      intensity: 260,
      side: 5,
      height: 10,
      forward: 7,
      angle: 0.36,
      penumbra: 1
    },
    shadowRadius: 10,
    ink: true,
    reflection: 0,
    reflectionBlur: 0
  },
  chrome: {
    label: 'Chrome',
    wallColor: 0x10151f,
    floorColor: 0x1a2030,
    logoColor: 0x252b3d,
    logoRoughness: 0.55,
    logoMetalness: 1,
    paper: false,
    embossStrength: 0,
    rimStrength: 0,
    ambientIntensity: 0.6,
    key: { color: 0xffffff, intensity: 0.8, position: [-4, 6, 10] },
    spot: {
      color: 0xc9d8ff,
      intensity: 380,
      side: 5,
      height: 10,
      forward: 7,
      angle: 0.36,
      penumbra: 1
    },
    shadowRadius: 8,
    ink: false,
    reflection: 0.02,
    reflectionBlur: 0.5
  },
  polishedChrome: {
    label: 'Polished chrome',
    wallColor: 0x10151f,
    floorColor: 0x1a2030,
    logoColor: 0x13161e,
    logoRoughness: 0,
    logoMetalness: 1,
    paper: false,
    embossStrength: 0,
    rimStrength: 0,
    ambientIntensity: 0.6,
    key: { color: 0xffffff, intensity: 0.8, position: [-4, 6, 10] },
    spot: {
      color: 0xc9d8ff,
      intensity: 380,
      side: 5,
      height: 10,
      forward: 7,
      angle: 0.36,
      penumbra: 1
    },
    shadowRadius: 8,
    ink: false,
    reflection: 0.25,
    reflectionBlur: 0.36
  }
}
export const DEFAULT_HERO_LOOK = 'cardstock'
/** Seconds a switch from one look to the next takes to blend. */
export const HERO_LOOK_TRANSITION_SECONDS = 1.5
/**
 * How far the logo or a letter must be from its place, in scene units, or turned from it, in
 * radians, for its return to count as coming back from a knock.
 */
export const HERO_MOVED_DISTANCE = 0.05
export const HERO_MOVED_ANGLE = 0.05
/** A short loop of the skills city, played forward then back, that the chrome look mirrors. */
export const REFLECTION_VIDEO = 'hero/skills-city-reflection.mp4'
/**
 * How the mirror finish lays the video across the logo: the scene units the footage spans, and how
 * far a face's tilt shifts what it reflects, so bevels and sides show a different part of it.
 */
export const REFLECTION_SPAN = 14
export const REFLECTION_TILT = 0.25
/** How many halvings of the footage's resolution the strongest reflection blur reaches. */
export const REFLECTION_BLUR_LEVELS = 6
/** The reflection sways slowly side to side: how far, as a share of the footage, and how fast. */
export const REFLECTION_SWAY = 0.08
export const REFLECTION_SWAY_SPEED = 0.25

export const OWNER_NAME = 'Giuseppe Leo'
export const OWNER_PROFESSION = 'Senior Frontend Developer'
export const OWNER_SUMMARY = '15+ years building, from startup to enterprise.'
export const OWNER_PROFILES = [
  { label: 'LinkedIn', icon: 'linkedin', url: 'https://www.linkedin.com/in/leogiuseppe/' },
  { label: 'GitHub', icon: 'github', url: 'https://github.com/cnotv' }
]
/** Where to read how this page was built: its journey, the tutorials and the toolkit behind it. */
export const BUILD_NOTES = [
  {
    label: 'The journey',
    url: 'https://cnotv.github.io/generative-art/docs/docs/journey/homepage-sleeping-logo-and-skills-city'
  },
  { label: 'Tutorials', url: 'https://cnotv.github.io/generative-art/docs/docs/category/guides' },
  {
    label: 'Toolkit docs',
    url: 'https://cnotv.github.io/generative-art/docs/docs/packages/threejs'
  }
]

/** Each employer's LinkedIn page, linked from the drawers. */
export const COMPANY_PAGES: Record<string, string> = {
  SUSE: 'https://www.linkedin.com/company/suse/',
  Retresco: 'https://www.linkedin.com/company/retresco/',
  'firma.de': 'https://www.linkedin.com/company/firma-de/'
}

/**
 * Areas of work, each with its district in the skills city model, and what its drawer tells a
 * recruiter: the tools and practices, and highlights from real roles, results first.
 */
export const SKILL_AREAS: SkillArea[] = [
  {
    district: 'district-frontend',
    title: 'Frontend development',
    line: 'Interfaces, design systems and real-time 3D in the browser.',
    tools: [
      'Vue 3',
      'Vue 2',
      'TypeScript',
      'Three.js',
      'Pinia',
      'Vite',
      'Vitest',
      'Cypress',
      'KSS',
      'WordPress'
    ],
    highlights: [
      {
        company: 'SUSE',
        period: 'since 2022',
        points: [
          'Builds the Rancher dashboard, the open source interface for cloud orchestration.',
          'Planned and led a one-year migration from Vue 2 to Vue 3 across several repositories, with a script that migrates internal and external plugins.'
        ]
      },
      {
        company: 'Retresco',
        period: '2018 to 2022',
        points: [
          'Built several stateful single-page apps from the ground up, used by top nationwide publishers and enterprises.'
        ]
      },
      {
        company: 'firma.de',
        period: '2017 to 2018',
        points: ['Built the UI framework, the KSS style guide and the WordPress theme.']
      }
    ],
    quote: {
      text: 'His work has always been the highest standard when it comes to documentation, testing and architectural decisions.',
      author: 'Ling Vu',
      url: 'https://www.linkedin.com/in/leogiuseppe/details/recommendations/'
    }
  },
  {
    district: 'district-ci',
    title: 'CI automation',
    line: 'Pipelines that test, build and ship every change.',
    tools: ['GitHub Actions', 'GitLab CI', 'Nexus', 'Cypress', 'Protractor'],
    highlights: [
      {
        company: 'SUSE',
        period: 'since 2022',
        points: [
          'Cut the end-to-end test pipeline from 2 hours to 5 minutes, 95% faster, by running it in parallel.',
          'Set up GitHub Actions for unit and end-to-end tests, linting, coverage, documentation and the style guide.'
        ]
      },
      {
        company: 'Retresco',
        period: '2018 to 2022',
        points: [
          'Published internal libraries to private Nexus repositories through GitLab CI.',
          'Migrated the end-to-end test suite from Protractor to Cypress.'
        ]
      }
    ]
  },
  {
    district: 'district-ai',
    title: 'AI automations',
    line: 'Agents and workflows that take over the repetitive work.',
    tools: ['GitHub Actions', 'AI coding agents'],
    highlights: [
      {
        company: 'SUSE',
        period: 'since 2022',
        points: [
          'Introduced agentic GitHub workflows that automate work on issues and pull requests.'
        ]
      }
    ]
  },
  {
    district: 'district-ux',
    title: 'UX',
    line: 'Flows shaped around how people actually use them.',
    tools: ['Style guides', 'UI frameworks', 'KSS'],
    highlights: [
      {
        company: 'Retresco',
        period: '2018 to 2022',
        points: ['Planned the UX decisions of new projects, alongside their architecture.']
      },
      {
        company: 'firma.de',
        period: '2017 to 2018',
        points: ['Created the style guide and UI framework of a legal e-commerce platform.']
      }
    ]
  },
  {
    district: 'district-k8s',
    title: 'Kubernetes',
    line: 'Running and scaling services on K8S clusters.',
    tools: ['Kubernetes', 'Rancher'],
    highlights: [
      {
        company: 'SUSE',
        period: 'since 2022',
        points: [
          'Works with Kubernetes daily, bringing features and support for newer Kubernetes versions to the Rancher dashboard.',
          'Coordinated releases across several teams of the Rancher ecosystem.'
        ]
      }
    ]
  },
  {
    district: 'district-nlg',
    title: 'NLG and NLU',
    line: 'Language understanding and generation on self-hosted and trained models.',
    tools: ['Keycloak', 'JWT', 'Sentry'],
    highlights: [
      {
        company: 'Retresco',
        period: '2018 to 2022',
        points: [
          'Built from the ground up several apps for natural language processing and generation, used by top nationwide publishers and enterprises.',
          'Delivered what enterprise clients such as banks required: Keycloak user roles, JWT authentication, Sentry monitoring and Internet Explorer 11 support.'
        ]
      }
    ]
  },
  {
    district: 'district-mentoring',
    title: 'Mentoring',
    line: 'Growing developers and teams through reviews, guidelines and regular sessions.',
    tools: ['Code reviews', 'Coding guidelines', 'Regular sessions', 'Technical interviews'],
    highlights: [
      {
        company: 'SUSE',
        period: 'since 2022',
        points: [
          'Mentors a team of 15 developers through code reviews, guidelines and bi-weekly sessions.'
        ]
      },
      {
        company: 'Retresco',
        period: '2018 to 2022',
        points: [
          'Mentored frontend and full stack developers across 4 teams and the frontend guild.',
          'Defined the code guidelines and the interview process for frontend positions.'
        ]
      }
    ]
  },
  {
    district: 'district-architecture',
    title: 'Architecture',
    line: 'Planning architecture and paying down tech debt across projects and teams.',
    tools: ['Migration planning', 'Project templates', 'Nexus'],
    highlights: [
      {
        company: 'SUSE',
        period: 'since 2022',
        points: [
          'Planned the move of several repositories and their plugins from Vue 2 to Vue 3, delivered over one year.'
        ]
      },
      {
        company: 'Retresco',
        period: '2018 to 2022',
        points: [
          'Planned the architecture of new projects.',
          'Created project templates, distributed through a private Nexus repository and generated from the command line.'
        ]
      }
    ]
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

/** The contour map behind the city and market: page colour, line and glow, all muted blues. */
export const BACKDROP_BASE_COLOR = 0x141a24
export const BACKDROP_LINE_COLOR = 0x26314a
export const BACKDROP_GLOW_COLOR = 0x171e2c
/** How many page pixels one unit of the noise field spans, and how many contour levels it has. */
export const BACKDROP_SCALE = 520
export const BACKDROP_LEVELS = 16
/** The backdrop's dot grid, in page pixels: the gap between dot centres and a dot's radius. */
export const BACKDROP_DOT_SPACING = 8
export const BACKDROP_DOT_RADIUS = 1
export const BACKDROP_MAX_PIXEL_RATIO = 1.5

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
