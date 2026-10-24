import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import type { EditorState } from '@codemirror/state'
import { STRUDEL_COMPLETION_PARSE_TIMEOUT_MS } from '../config'

// @lezer/common is not a direct dependency, so its node type is read off CodeMirror's.
export type SyntaxNode = ReturnType<ReturnType<typeof syntaxTree>['resolveInner']>

/**
 * The innermost syntax node at a position, parsing up to it first when the editor has not yet
 * got that far, as with a state that was never shown in a view.
 * @param state - the editor state
 * @param position - the document position
 * @param side - which neighbouring node wins at a boundary: -1 the one before, 1 the one after
 * @returns the innermost node there
 */
export const resolveSyntaxNode = (state: EditorState, position: number, side: -1 | 1): SyntaxNode =>
  (
    ensureSyntaxTree(state, position, STRUDEL_COMPLETION_PARSE_TIMEOUT_MS) ?? syntaxTree(state)
  ).resolveInner(position, side)
