import { EditorState, Prec } from '@codemirror/state'
import type { Extension } from '@codemirror/state'
import { EditorView, drawSelection, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { autocompletion } from '@codemirror/autocomplete'
import { javascript } from '@codemirror/lang-javascript'
import {
  flash,
  flashField,
  highlightExtension,
  highlightMiniLocations,
  settings,
  sliderPlugin,
  theme,
  updateMiniLocations,
  updateSliderWidgets
} from '@strudel/codemirror'
import { STRUDEL_EDITOR_THEME } from '../config'
import { inlineWidgetField, showInlineWidgets } from './inlineWidgets'
import { createCompletionVocabulary } from './completionVocabulary'
import { createStrudelCompletionSource } from './strudelCompletions'
import { strudelHoverDocumentation } from './strudelHoverDocumentation'
import type {
  StrudelCodeMirror,
  StrudelCodeMirrorOptions,
  StrudelCompletionVocabulary,
  StrudelEvaluationMeta
} from '../types'

const isSliderWidget = (widget: unknown): boolean =>
  typeof widget === 'object' && widget !== null && 'type' in widget && widget.type === 'slider'

/**
 * strudel.cc applies a theme by writing its colours to `:root` with `!important` and adding
 * the `dark` class to `<html>`, which this app also reads for its own dark mode. The same
 * variables are set on the editor's own element instead, where the highlight and slider
 * styles still find them.
 * @param element - the element that holds the editor
 * @param themeName - a strudel.cc theme name
 */
const applyThemeVariables = (element: HTMLElement, themeName: string): void => {
  Object.entries(settings[themeName] ?? {})
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    .forEach(([variableName, value]) => element.style.setProperty(`--${variableName}`, value))
}

const runAndClaim = (handler: () => void) => (): boolean => {
  handler()
  return true
}

const buildExtensions = (
  options: StrudelCodeMirrorOptions,
  completionVocabulary: StrudelCompletionVocabulary
): Extension[] => [
  lineNumbers(),
  history(),
  drawSelection(),
  javascript(),
  theme(STRUDEL_EDITOR_THEME),
  EditorView.lineWrapping,
  EditorView.contentAttributes.of({ 'aria-label': options.ariaLabel }),
  // Above the strudel.cc theme, so the visuals canvas behind the editor stays visible.
  Prec.highest(EditorView.theme({ '&': { backgroundColor: 'transparent' } })),
  EditorView.theme({
    '&': { height: '100%', fontSize: 'var(--font-size-md)' },
    '.cm-scroller': { fontFamily: 'var(--font-mono)' },
    // App.vue pins every canvas full-size and absolute for the 3D views, which would lift
    // the inline pianoroll and scope out of their rows and over the code.
    '.cm-content canvas': { position: 'static', display: 'block', maxWidth: '100%' },
    '.cm-tooltip': {
      backgroundColor: 'var(--background)',
      color: 'var(--foreground)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)'
    },
    '.cm-tooltip-autocomplete > ul': { fontFamily: 'var(--font-mono)', maxHeight: '14em' },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
      backgroundColor: 'var(--selection)',
      color: 'var(--foreground)'
    },
    '.cm-completionDetail': { opacity: 'var(--opacity-muted)', fontStyle: 'normal' },
    '.cm-completionInfo, .cm-tooltip-hover .cm-strudel-doc': {
      maxWidth: 'min(28rem, 80vw)',
      padding: 'var(--spacing-2) var(--spacing-3)',
      fontSize: 'var(--font-size-sm)'
    },
    '.cm-strudel-doc__signature': { fontFamily: 'var(--font-mono)' },
    '.cm-strudel-doc__synonyms': { opacity: 'var(--opacity-muted)' },
    '.cm-strudel-doc p, .cm-strudel-doc ul': { margin: 'var(--spacing-1) 0' },
    '.cm-strudel-doc__params': { paddingLeft: 'var(--spacing-4)' },
    '.cm-strudel-doc__example': {
      margin: 'var(--spacing-2) 0 0',
      fontFamily: 'var(--font-mono)',
      whiteSpace: 'pre-wrap'
    }
  }),
  autocompletion({
    override: [createStrudelCompletionSource(completionVocabulary)],
    // Stays open while the pointer moves to the documentation beside the list.
    closeOnBlur: false
  }),
  strudelHoverDocumentation(completionVocabulary.functionDocumentations),
  sliderPlugin,
  inlineWidgetField,
  Prec.highest(highlightExtension),
  flashField,
  EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      options.onCodeChange(update.state.doc.toString())
    }
  }),
  Prec.highest(
    keymap.of([
      { key: 'Ctrl-Enter', run: runAndClaim(options.onEvaluate) },
      { key: 'Alt-Enter', run: runAndClaim(options.onEvaluate) },
      { key: 'Ctrl-.', run: runAndClaim(options.onStop) },
      { key: 'Alt-.', preventDefault: true, run: runAndClaim(options.onStop) }
    ])
  ),
  keymap.of([...defaultKeymap, ...historyKeymap])
]

/**
 * The strudel.cc code editor: CodeMirror with inline sliders, inline pianoroll and scope
 * widgets, the playhead highlighted in the mini-notation, and the same play and stop keys.
 * @param options - where to mount it, the starting code and the callbacks it reports to
 * @returns controls to replace the code, show an evaluation and highlight playing notes
 */
export const createStrudelCodeMirror = (options: StrudelCodeMirrorOptions): StrudelCodeMirror => {
  applyThemeVariables(options.parent, STRUDEL_EDITOR_THEME)
  const view = new EditorView({
    state: EditorState.create({
      doc: options.initialCode,
      extensions: buildExtensions(options, createCompletionVocabulary())
    }),
    parent: options.parent
  })
  return {
    setCode: (patternCode: string): boolean => {
      const currentCode = view.state.doc.toString()
      if (currentCode === patternCode) {
        return false
      }
      view.dispatch({ changes: { from: 0, to: currentCode.length, insert: patternCode } })
      return true
    },
    applyEvaluation: (meta: StrudelEvaluationMeta): void => {
      updateSliderWidgets(view, meta.widgets.filter(isSliderWidget))
      showInlineWidgets(
        view,
        meta.widgets.filter((widget) => !isSliderWidget(widget))
      )
      updateMiniLocations(view, meta.miniLocations)
      flash(view)
    },
    highlight: (activeHaps: unknown[], time: number): void => {
      highlightMiniLocations(view, time, activeHaps)
    },
    clearHighlights: (): void => {
      updateMiniLocations(view, [])
    },
    destroy: (): void => {
      view.destroy()
    }
  }
}
