import type { EditorView, Rect } from '@codemirror/view'
import { STRUDEL_COMPLETION_INFO_MARGIN, STRUDEL_COMPLETION_INFO_MAX_WIDTH } from '../config'

type InfoPosition = { style: string; class: string }

const besideTheList = (
  list: Rect,
  option: Rect,
  info: Rect,
  space: Rect,
  placeLeft: boolean
): InfoPosition => {
  const infoHeight = info.bottom - info.top
  const offset = Math.max(space.top, Math.min(option.top, space.bottom - infoHeight)) - list.top
  const availableWidth = placeLeft ? list.left - space.left : space.right - list.right
  return {
    style: `top: ${offset}px; max-width: ${Math.min(STRUDEL_COMPLETION_INFO_MAX_WIDTH, availableWidth)}px`,
    class: placeLeft ? 'cm-completionInfo-left' : 'cm-completionInfo-right'
  }
}

const underOrOverTheList = (list: Rect, option: Rect, info: Rect, space: Rect): InfoPosition => {
  const infoHeight = info.bottom - info.top
  const spaceBelow = space.bottom - list.bottom
  const maxWidth = Math.min(
    STRUDEL_COMPLETION_INFO_MAX_WIDTH,
    space.right - list.left - STRUDEL_COMPLETION_INFO_MARGIN
  )
  const fitsBelow = spaceBelow >= infoHeight || spaceBelow > list.top
  const placement = fitsBelow
    ? `top: ${option.bottom - list.top}px`
    : `bottom: ${list.bottom - option.top}px`
  return {
    style: `${placement}; max-width: ${maxWidth}px`,
    class: 'cm-completionInfo-right-narrow'
  }
}

/**
 * Where the documentation beside the completion list goes: CodeMirror's own placement, beside
 * the list where it fits and under or over it where it does not, but up to twice as wide.
 * CodeMirror writes the width inline from this, so a stylesheet cannot widen it.
 * @param _view - the editor, unused since this editor is never right-to-left or scaled
 * @param list - the completion list's box
 * @param option - the selected option's box
 * @param info - the documentation's box as last drawn
 * @param space - the box the tooltips have to stay inside
 * @returns the inline style and the placement class for the documentation
 */
export const positionCompletionInfo = (
  _view: EditorView,
  list: Rect,
  option: Rect,
  info: Rect,
  space: Rect
): InfoPosition => {
  const spaceLeft = list.left - space.left
  const spaceRight = space.right - list.right
  const infoWidth = info.right - info.left
  const placeLeft = spaceRight < Math.min(infoWidth, spaceLeft)
  return infoWidth <= (placeLeft ? spaceLeft : spaceRight)
    ? besideTheList(list, option, info, space, placeLeft)
    : underOrOverTheList(list, option, info, space)
}
