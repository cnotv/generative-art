interface PlayableExample {
  slug: string
  title: string
}

/**
 * The starters under `examples/` are standalone Vite apps that this app also serves from its
 * own origin: the dev server picks up any HTML below the root, and `vite.config.ts` lists them
 * as build inputs. Each slug has to match both a directory name and an entry in that config.
 * They are pages rather than routes, so the navigation links to them instead of routing.
 */
export const playableExamples: readonly PlayableExample[] = [
  { slug: 'platformer-starter', title: 'Platformer' },
  { slug: 'runner-starter', title: 'Endless Runner' }
]

/** `BASE_URL` carries the deployment's sub-path and always ends in a separator. */
export const buildExampleUrl = (slug: string): string =>
  `${import.meta.env.BASE_URL}examples/${slug}/index.html`
