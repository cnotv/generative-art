import { StateEffect, StateField } from '@codemirror/state'
import type { EditorState } from '@codemirror/state'
import { Decoration, EditorView } from '@codemirror/view'
import type { DecorationSet, WidgetType } from '@codemirror/view'
import { BlockWidget } from '@strudel/codemirror'
import { getWidgetID } from '@strudel/transpiler'

const setInlineWidgets = StateEffect.define<unknown[]>()

const readWidgetEnd = (widgetConfig: unknown): number | null =>
  typeof widgetConfig === 'object' &&
  widgetConfig !== null &&
  'to' in widgetConfig &&
  typeof widgetConfig.to === 'number'
    ? widgetConfig.to
    : null

const readWidgetConfig = (widget: unknown): unknown =>
  typeof widget === 'object' && widget !== null && 'widgetConfig' in widget
    ? widget.widgetConfig
    : undefined

/**
 * Strudel's own block widget, which renders the canvas its `_pianoroll()` or `_scope()`
 * call created, but equal only to a widget with the same id. Strudel's version calls every
 * widget equal, and current CodeMirror then reuses one widget's canvas for another and
 * drops the code between them from the screen.
 * @param widgetConfig - the transpiler's description of one widget call
 * @returns a widget that CodeMirror keeps apart from the others
 */
const createBlockWidget = (widgetConfig: unknown): WidgetType => {
  const widgetId = getWidgetID(widgetConfig)
  return Object.create(BlockWidget.prototype, {
    widgetConfig: { value: widgetConfig },
    eq: { value: (other: unknown): boolean => getWidgetID(readWidgetConfig(other)) === widgetId }
  })
}

/**
 * Places each widget below the line its call ends on. Strudel puts it at the call's end
 * position, which current CodeMirror renders by splitting the line and leaving an empty
 * line under every widget.
 * @param widgetConfigs - the transpiler's widget descriptions
 * @param state - the editor state the positions refer to
 * @returns one block decoration per widget that still fits the document
 */
const buildWidgetDecorations = (widgetConfigs: unknown[], state: EditorState): DecorationSet =>
  Decoration.set(
    widgetConfigs.flatMap((widgetConfig) => {
      const widgetEnd = readWidgetEnd(widgetConfig)
      if (widgetEnd === null || widgetEnd > state.doc.length) {
        return []
      }
      return [
        Decoration.widget({
          widget: createBlockWidget(widgetConfig),
          block: true,
          side: 1
        }).range(state.doc.lineAt(widgetEnd).to)
      ]
    }),
    true
  )

/** Holds the inline pianoroll, scope and other canvas widgets under their code lines. */
export const inlineWidgetField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update: (decorations, transaction) =>
    transaction.effects.reduce(
      (current, effect) =>
        effect.is(setInlineWidgets)
          ? buildWidgetDecorations(effect.value, transaction.state)
          : current,
      decorations.map(transaction.changes)
    ),
  provide: (field) => EditorView.decorations.from(field)
})

/**
 * Replaces the inline widgets with those of the latest evaluation.
 * @param view - the editor to update
 * @param widgetConfigs - the transpiler's non-slider widget descriptions
 */
export const showInlineWidgets = (view: EditorView, widgetConfigs: unknown[]): void => {
  view.dispatch({ effects: setInlineWidgets.of(widgetConfigs) })
}
