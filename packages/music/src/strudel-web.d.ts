declare module '@strudel/web' {
  interface InitStrudelOptions {
    /** Loader run during init to register samples before any pattern plays. */
    prebake?: () => unknown
    [key: string]: unknown
  }
  /**
   * Initialise the Strudel audio engine and register its pattern globals
   * (`evaluate`, `hush`, `setcps`, `samples`, the pattern builders) on `globalThis`.
   * @param options - Optional Strudel init options (e.g. a `prebake` loader).
   * @returns Resolves once init (including `prebake`) completes.
   */
  export function initStrudel(options?: InitStrudelOptions): Promise<void>
}
