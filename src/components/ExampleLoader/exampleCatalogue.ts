import type { PlayableExample } from './types'

/**
 * The starters under `examples/` are standalone Vite apps that this app also serves from its
 * own origin: the dev server picks up any HTML below the root, and `vite.config.ts` lists
 * them as build inputs. Same origin is what lets them run in a frame at all, and each slug
 * has to match both a directory name and an entry in that config.
 */
export const playableExamples: readonly PlayableExample[] = [
  {
    slug: 'platformer-starter',
    title: 'Platformer',
    description: 'Third-person movement, jumping, fixed platforms and a follow camera.'
  },
  {
    slug: 'runner-starter',
    title: 'Endless runner',
    description: 'Lane switching, obstacles that spawn and despawn, scoring and collision.'
  }
]

/** `BASE_URL` carries the deployment's sub-path and always ends in a separator. */
export const buildExampleUrl = (slug: string): string =>
  `${import.meta.env.BASE_URL}examples/${slug}/index.html`
