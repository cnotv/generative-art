// Strudel ships plain JavaScript. These declare only the parts the Strudel Editor view uses.

declare module '@strudel/codemirror' {
  import type { Extension } from '@codemirror/state'
  import type { EditorView, WidgetType } from '@codemirror/view'

  export const sliderPlugin: Extension
  /** Renders the canvas a `_pianoroll()` or `_scope()` call created for its widget id. */
  export const BlockWidget: { prototype: WidgetType }
  /** Registers the element a widget id renders; `_pianoroll()` and `_scope()` call it. */
  export function setWidget(widgetId: string, element: HTMLElement): void
  export const highlightExtension: Extension
  export const flashField: Extension
  export const settings: Record<string, Record<string, string | boolean>>
  export function theme(themeName: string): Extension
  export function flash(view: EditorView, milliseconds?: number): void
  export function updateSliderWidgets(view: EditorView, widgets: unknown[]): void
  export function updateMiniLocations(view: EditorView, locations: unknown[]): void
  export function highlightMiniLocations(view: EditorView, time: number, haps: unknown[]): void
  export function slider(value: number): unknown
  export function sliderWithID(id: string, value: number, min?: number, max?: number): unknown
}

declare module '@strudel/core/util.mjs' {
  /** The MIDI key of an event's `freq` or `note`, as Strudel's own MIDI output computes it. */
  export function valueToMidi(value: object, fallbackValue?: number): number
}

declare module '@strudel/draw' {
  export type DrawFrameCallback = (
    haps: unknown[],
    time: number,
    drawer: unknown,
    painters: unknown[]
  ) => void

  export type Drawer = {
    start: (scheduler: unknown) => void
    stop: () => void
    setDrawTime: (drawTime: [number, number]) => void
    invalidate: (scheduler?: unknown, time?: number) => void
  }

  export const Drawer: new (onFrame: DrawFrameCallback, drawTime: [number, number]) => Drawer
  /**
   * Stops every animation `.pianoroll()`, `.scope()` and the like started, and clears the
   * `test-canvas`, creating a full-window one first if none exists.
   */
  export function cleanupDraw(clearScreen?: boolean, id?: string): void
}

declare module '@strudel/transpiler' {
  export type TranspilerOptions = {
    emitMiniLocations?: boolean
    emitWidgets?: boolean
    id?: string
  }

  export function transpiler(
    code: string,
    options?: TranspilerOptions
  ): { output: string; miniLocations: unknown[]; widgets: unknown[] }
  export function getWidgetID(widgetConfig: unknown): string
}
