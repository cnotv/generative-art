import { MapMode, StateEffect, StateField } from '@codemirror/state'
import type { ChangeDesc, EditorState } from '@codemirror/state'
import { Decoration, EditorView } from '@codemirror/view'
import type { DecorationSet, WidgetType } from '@codemirror/view'
import { BlockWidget } from '@strudel/codemirror'
import { getWidgetID } from '@strudel/transpiler'

type WidgetCall = {
  widgetConfig: unknown
  /** Where the call's method name, such as `_pianoroll`, starts in the current document. */
  nameFrom: number
  callEnd: number
  name: string
}

type InlineWidgets = {
  calls: WidgetCall[]
  decorations: DecorationSet
}

const setInlineWidgets = StateEffect.define<unknown[]>()

const readWidgetEnd = (widgetConfig: unknown): number | null =>
  typeof widgetConfig === 'object' &&
  widgetConfig !== null &&
  'to' in widgetConfig &&
  typeof widgetConfig.to === 'number'
    ? widgetConfig.to
    : null

const readWidgetType = (widgetConfig: unknown): string | null =>
  typeof widgetConfig === 'object' &&
  widgetConfig !== null &&
  'type' in widgetConfig &&
  typeof widgetConfig.type === 'string'
    ? widgetConfig.type
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
 * Finds each widget's call in the document. The transpiler records only where the call ends,
 * so its method name is the last occurrence of that name before the end.
 * @param widgetConfigs - the transpiler's widget descriptions
 * @param state - the editor state the positions refer to
 * @returns one call per widget that still fits the document
 */
const locateWidgetCalls = (widgetConfigs: unknown[], state: EditorState): WidgetCall[] =>
  widgetConfigs.flatMap((widgetConfig) => {
    const callEnd = readWidgetEnd(widgetConfig)
    const name = readWidgetType(widgetConfig)
    if (callEnd === null || name === null || callEnd > state.doc.length) {
      return []
    }
    const nameFrom = state.sliceDoc(0, callEnd).lastIndexOf(name)
    return nameFrom === -1 ? [] : [{ widgetConfig, nameFrom, callEnd, name }]
  })

/**
 * Follows each call through an edit, dropping the ones whose method name was deleted or
 * changed, so a removed `._pianoroll()` takes its canvas and its height with it at once
 * instead of at the next evaluation.
 * @param calls - the calls before the edit
 * @param changes - the edit
 * @param state - the editor state after the edit
 * @returns the calls that are still in the code, at their new positions
 */
const followWidgetCalls = (
  calls: WidgetCall[],
  changes: ChangeDesc,
  state: EditorState
): WidgetCall[] =>
  calls.flatMap((call) => {
    const nameFrom = changes.mapPos(call.nameFrom, 1, MapMode.TrackDel)
    const isNameIntact =
      nameFrom !== null && state.sliceDoc(nameFrom, nameFrom + call.name.length) === call.name
    return isNameIntact ? [{ ...call, nameFrom, callEnd: changes.mapPos(call.callEnd, -1) }] : []
  })

/**
 * Places each widget below the line its call ends on. Strudel puts it at the call's end
 * position, which current CodeMirror renders by splitting the line and leaving an empty
 * line under every widget.
 * @param calls - the widget calls in the document
 * @param state - the editor state the positions refer to
 * @returns one block decoration per widget
 */
const buildWidgetDecorations = (calls: WidgetCall[], state: EditorState): DecorationSet =>
  Decoration.set(
    calls.map((call) =>
      Decoration.widget({
        widget: createBlockWidget(call.widgetConfig),
        block: true,
        side: 1
      }).range(state.doc.lineAt(call.callEnd).to)
    ),
    true
  )

const toInlineWidgets = (calls: WidgetCall[], state: EditorState): InlineWidgets => ({
  calls,
  decorations: buildWidgetDecorations(calls, state)
})

/** Holds the inline pianoroll, scope and other canvas widgets under their code lines. */
export const inlineWidgetField = StateField.define<InlineWidgets>({
  create: () => ({ calls: [], decorations: Decoration.none }),
  update: (inlineWidgets, transaction) => {
    const evaluatedWidgets = transaction.effects.findLast((effect) => effect.is(setInlineWidgets))
    if (evaluatedWidgets?.is(setInlineWidgets)) {
      return toInlineWidgets(
        locateWidgetCalls(evaluatedWidgets.value, transaction.state),
        transaction.state
      )
    }
    if (!transaction.docChanged) {
      return inlineWidgets
    }
    return toInlineWidgets(
      followWidgetCalls(inlineWidgets.calls, transaction.changes, transaction.state),
      transaction.state
    )
  },
  provide: (field) =>
    EditorView.decorations.from(field, (inlineWidgets) => inlineWidgets.decorations)
})

/**
 * Replaces the inline widgets with those of the latest evaluation.
 * @param view - the editor to update
 * @param widgetConfigs - the transpiler's non-slider widget descriptions
 */
export const showInlineWidgets = (view: EditorView, widgetConfigs: unknown[]): void => {
  view.dispatch({ effects: setInlineWidgets.of(widgetConfigs) })
}
