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
export const OWNER_PROFESSION = 'Senior Frontend Developer'
export const OWNER_SUMMARY = '15+ years building, from startup to enterprise.'
export const OWNER_PROFILE_URL = 'https://www.linkedin.com/in/leogiuseppe/'
export const SPOT_COLOR = 0xc9d8ff

/** Areas of work, each with its lucide icon and the experience a recruiter would look for. */
export const SKILL_AREAS = [
  {
    icon: 'code',
    title: 'Frontend development',
    line: 'Interfaces, design systems and real-time 3D in the browser.',
    experience: [
      {
        company: 'SUSE',
        role: 'Senior Frontend Engineer',
        period: 'since 2022',
        points: [
          'Rancher dashboard, the open source UI for cloud orchestration.',
          'Planned and led a one year Vue 2 to Vue 3 migration across several repositories, with a migration script for internal and external plugins.',
          'Mentored a team of 15 developers through code reviews, guidelines and bi-weekly sessions.'
        ]
      },
      {
        company: 'Retresco',
        role: 'Senior Frontend Developer',
        period: '2018-2022',
        points: [
          'Mentored frontend and full stack developers in 4 teams and the frontend guild.',
          'Defined code guidelines and the interview process for frontend positions.'
        ]
      },
      {
        company: 'firma.de',
        role: 'Frontend Developer',
        period: '2017-2018',
        points: ['Built the UI framework, the KSS style guide and the WordPress theme.']
      }
    ],
    quote: {
      text: 'His work has always been the highest standard when it comes to documentation, testing and architectural decisions.',
      author: 'Ling Vu'
    }
  },
  {
    icon: 'pipeline',
    title: 'CI automation',
    line: 'Pipelines that test, build and ship every change.',
    experience: [
      {
        company: 'SUSE',
        role: 'Senior Frontend Engineer',
        period: 'since 2022',
        points: [
          'Cut the E2E pipeline from 2 hours to 5 minutes, 95% faster, through parallelisation.',
          'Set up GitHub Actions for unit and E2E tests, linting, coverage, documentation and style guide.'
        ]
      },
      {
        company: 'Retresco',
        role: 'Senior Frontend Developer',
        period: '2018-2022',
        points: [
          'Internal libraries in private Nexus repositories, with GitLab CI.',
          'Migrated the E2E suite from Protractor to Cypress.'
        ]
      }
    ]
  },
  {
    icon: 'agent',
    title: 'AI automations',
    line: 'Agents and workflows that take over the repetitive work.',
    experience: [
      {
        company: 'SUSE',
        role: 'Senior Frontend Engineer',
        period: 'since 2022',
        points: ['Agentic GitHub workflows that automate issues and pull requests.']
      }
    ]
  },
  {
    icon: 'pointer',
    title: 'UX',
    line: 'Flows shaped around how people actually use them.',
    experience: [
      {
        company: 'Retresco',
        role: 'Senior Frontend Developer',
        period: '2018-2022',
        points: ['Planned the architecture and UX decisions of new projects.']
      },
      {
        company: 'firma.de',
        role: 'Frontend Developer',
        period: '2017-2018',
        points: ['Style guide and UI framework for a legal e-commerce platform.']
      }
    ]
  },
  {
    icon: 'cluster',
    title: 'Kubernetes',
    line: 'Running and scaling services on K8S clusters.',
    experience: [
      {
        company: 'SUSE',
        role: 'Senior Frontend Engineer',
        period: 'since 2022',
        points: [
          'Daily work with K8S: features and updates for newer Kubernetes versions in the Rancher dashboard.',
          'Coordinated releases across several Rancher ecosystem teams.'
        ]
      }
    ]
  },
  {
    icon: 'language',
    title: 'NLG and NLU without LLMs',
    line: 'Language understanding and generation for publishers, no large model needed.',
    experience: [
      {
        company: 'Retresco',
        role: 'Senior Frontend Developer',
        period: '2018-2022',
        points: [
          'Built from the ground up several stateful single page apps for NLP and NLG, used by top nationwide publishers and enterprises.'
        ]
      }
    ]
  },
  {
    icon: 'classify',
    title: 'Tailor-made classification and generation',
    line: "Software built to sort and write content in each client's own domain.",
    experience: [
      {
        company: 'Retresco',
        role: 'Senior Frontend Developer',
        period: '2018-2022',
        points: [
          'Bootstrap templates distributed through a private Nexus repository, with CLI generation.',
          'Keycloak user roles, JWT authentication, Sentry monitoring and IE11 support for clients such as banks.'
        ]
      }
    ]
  }
]

/** Sectors whose organisations use the products, each with its lucide icon. */
export const PRODUCT_SECTORS = [
  { icon: 'bank', title: 'Banks' },
  { icon: 'telco', title: 'Telco' },
  { icon: 'publisher', title: 'Publishers' },
  { icon: 'governance', title: 'Governance' },
  { icon: 'defense', title: 'Defense' },
  { icon: 'public', title: 'Public institutions' }
]
