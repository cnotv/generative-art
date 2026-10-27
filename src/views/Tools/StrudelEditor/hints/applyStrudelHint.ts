import type { StrudelHint } from '../types'

/**
 * Makes a hint's edits, from the end of the code back, so an earlier edit never shifts the
 * position of a later one.
 * @param code - the code the hint was built from
 * @param hint - the hint to apply
 * @returns the code with the hint applied
 */
export const applyStrudelHint = (code: string, hint: StrudelHint): string =>
  [...hint.edits]
    .sort((first, second) => second.from - first.from)
    .reduce(
      (editedCode, edit) =>
        `${editedCode.slice(0, edit.from)}${edit.insert}${editedCode.slice(edit.to)}`,
      code
    )
