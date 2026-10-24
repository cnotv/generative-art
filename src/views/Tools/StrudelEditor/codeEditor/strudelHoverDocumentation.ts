import { hoverTooltip } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import type { EditorState } from '@codemirror/state'
import { renderFunctionDocumentation } from './renderFunctionDocumentation'
import { resolveSyntaxNode } from './syntaxNodeAt'
import type { StrudelFunctionDocumentation } from '../types'

type DocumentedWord = {
  word: string
  from: number
  to: number
  documentation: StrudelFunctionDocumentation
}

// A call such as note(...) parses as a variable name and a chained .lpf(...) as a property name;
// comments, strings and declarations never do.
const IDENTIFIER_NODE_NAMES = new Set(['VariableName', 'PropertyName'])

/**
 * Every name a function can be written as, its synonyms included, mapped to its documentation.
 * @param functionDocumentations - the generated Strudel documentation
 * @returns the documentation by name, the first documented winning a shared name
 */
export const indexFunctionDocumentations = (
  functionDocumentations: StrudelFunctionDocumentation[]
): Map<string, StrudelFunctionDocumentation> =>
  new Map(
    functionDocumentations
      .flatMap((functionDocumentation) =>
        [functionDocumentation.name, ...functionDocumentation.synonyms].map(
          (name): [string, StrudelFunctionDocumentation] => [name, functionDocumentation]
        )
      )
      .filter(
        ([name], index, entries) => entries.findIndex(([candidate]) => candidate === name) === index
      )
  )

/**
 * The documented Strudel function name at a position, if the code there names one.
 * @param state - the editor state
 * @param position - where the pointer is
 * @param side - which word wins on a boundary between two: -1 the one before, 1 the one after
 * @param documentationByName - the documentation index
 * @returns the name, its range and its documentation, or null anywhere else
 */
export const findDocumentedWordAt = (
  state: EditorState,
  position: number,
  side: -1 | 1,
  documentationByName: Map<string, StrudelFunctionDocumentation>
): DocumentedWord | null => {
  const node = resolveSyntaxNode(state, position, side)
  if (!IDENTIFIER_NODE_NAMES.has(node.name)) {
    return null
  }
  const word = state.sliceDoc(node.from, node.to)
  const documentation = documentationByName.get(word)
  return documentation === undefined ? null : { word, from: node.from, to: node.to, documentation }
}

/**
 * Shows a function's documentation in a tooltip while the pointer rests on its name, as
 * strudel.cc does, with the same panel the completion list shows.
 * @param functionDocumentations - the generated Strudel documentation
 * @returns the CodeMirror extension
 */
export const strudelHoverDocumentation = (
  functionDocumentations: StrudelFunctionDocumentation[]
): Extension => {
  const documentationByName = indexFunctionDocumentations(functionDocumentations)
  return hoverTooltip((view, position, side) => {
    const documentedWord = findDocumentedWordAt(view.state, position, side, documentationByName)
    if (documentedWord === null) {
      return null
    }
    return {
      pos: documentedWord.from,
      end: documentedWord.to,
      above: true,
      create: () => ({
        dom: renderFunctionDocumentation(documentedWord.documentation, documentedWord.word)
      })
    }
  })
}
