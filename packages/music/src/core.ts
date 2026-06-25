interface StrudelGlobals {
  evaluate: (code: string) => Promise<unknown>
  hush: () => void
  setcps: (cyclesPerSecond: number) => void
  samples: (source: string) => Promise<unknown>
}

const strudelGlobals = (): Partial<StrudelGlobals> =>
  globalThis as unknown as Partial<StrudelGlobals>

/** Standard Tidal drum/instrument sample bank, so drum sounds resolve. The full
 *  URL is used because the `github:` shorthand assumes the wrong default branch. */
const SAMPLE_BANK = 'https://raw.githubusercontent.com/tidalcycles/dirt-samples/master/strudel.json'

/**
 * Build the memoised initialiser. `@strudel/web` is imported lazily (so the
 * browser-only audio code never loads in tests/SSR) and the standard sample bank
 * is loaded once, so the default drum sounds are available to patterns.
 * @returns An idempotent async init function
 */
const createMusicInit = (): (() => Promise<void>) => {
  let ready: Promise<void> | null = null
  return () => {
    if (!ready) {
      ready = import('@strudel/web').then(
        // `prebake` is Strudel's supported hook to load samples during init, before
        // any pattern is evaluated; `samples` is a global registered by initStrudel.
        async (module) =>
          module.initStrudel({ prebake: () => strudelGlobals().samples?.(SAMPLE_BANK) })
      )
    }
    return ready
  }
}

/**
 * Initialise the Strudel audio engine and load the default samples once.
 * @returns Resolves when Strudel is ready to evaluate patterns.
 */
export const musicInit = createMusicInit()

/**
 * Play a Strudel pattern, initialising the engine on first use.
 * @param pattern - Strudel pattern source, e.g. `s("bd hh sd hh")`.
 * @returns Resolves once the pattern has been evaluated and scheduled.
 */
export const musicPlay = async (pattern: string): Promise<void> => {
  await musicInit()
  await strudelGlobals().evaluate?.(pattern)
}

/** Stop all currently playing Strudel patterns. */
export const musicStop = (): void => {
  strudelGlobals().hush?.()
}

/**
 * Set the global tempo in cycles per second (higher is faster).
 * @param cyclesPerSecond - Strudel `cps` value.
 */
export const musicSetTempo = (cyclesPerSecond: number): void => {
  strudelGlobals().setcps?.(cyclesPerSecond)
}
