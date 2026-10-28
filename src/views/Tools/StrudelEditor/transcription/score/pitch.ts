import {
  SCORE_BOTTOM_LINE_STEP,
  SCORE_FLAT_ORDER,
  SCORE_LETTER_SEMITONES,
  SCORE_SHARP_ORDER
} from '../../config'
import type { Clef, NoteHead, StaffPrelude, TabSystem } from '../../types'
import { midiNoteToName } from '../pitch'

const LETTERS_PER_OCTAVE = 7
const SEMITONES_PER_OCTAVE = 12

/**
 * How many letter steps above C0 a head sits, from its height on the staff: every half gap is
 * one step, counted from the bottom line, which the clef names.
 * @param head - the note head
 * @param staff - its staff
 * @param clef - the staff's clef
 * @returns the diatonic step, C0 being 0
 */
export const diatonicStepOf = (head: NoteHead, staff: TabSystem, clef: Clef): number => {
  const halfGap = (staff.lineYs.at(-1)! - staff.lineYs[0]) / 8
  return SCORE_BOTTOM_LINE_STEP[clef] + Math.round((staff.lineYs.at(-1)! - head.centerY) / halfGap)
}

/**
 * The sharp or flat the key gives a step: positive accidentals sharpen the letters in sharp
 * order, negative ones flatten them in flat order.
 * @param step - the diatonic step
 * @param keyAccidentals - sharps as a positive count, flats as a negative one
 * @returns +1, -1 or 0 semitones
 */
export const keyAlterationOf = (step: number, keyAccidentals: number): number => {
  const letter = step % LETTERS_PER_OCTAVE
  if (keyAccidentals > 0) {
    return SCORE_SHARP_ORDER.slice(0, keyAccidentals).includes(letter) ? 1 : 0
  }
  return SCORE_FLAT_ORDER.slice(0, -keyAccidentals).includes(letter) ? -1 : 0
}

/**
 * The Strudel name of a diatonic step with an alteration, such as "c#5".
 * @param step - the diatonic step, C0 being 0
 * @param alteration - semitones up or down
 * @returns the note name
 */
export const stepToNoteName = (step: number, alteration: number): string => {
  const octave = Math.floor(step / LETTERS_PER_OCTAVE)
  const letter = step % LETTERS_PER_OCTAVE
  return midiNoteToName(
    SEMITONES_PER_OCTAVE * (octave + 1) + SCORE_LETTER_SEMITONES[letter] + alteration
  )
}

/**
 * Names the heads of one bar in reading order. An accidental holds for its line or space until
 * the bar line; anything else takes the key's alteration.
 * @param heads - the bar's heads, left to right
 * @param alterations - accidentals printed in front of heads, by head
 * @param context - the staff and what its prelude says
 * @param context.staff - the five line staff
 * @param context.prelude - its clef and key
 * @returns the note name of each head, in the same order
 */
export const nameBarHeads = (
  heads: NoteHead[],
  alterations: Map<NoteHead, number>,
  context: { staff: TabSystem; prelude: StaffPrelude }
): string[] =>
  heads.reduce<{ names: string[]; held: Map<number, number> }>(
    ({ names, held }, head) => {
      const step = diatonicStepOf(head, context.staff, context.prelude.clef)
      const printed = alterations.get(head)
      const nextHeld = printed === undefined ? held : new Map(held).set(step, printed)
      const alteration = nextHeld.get(step) ?? keyAlterationOf(step, context.prelude.keyAccidentals)
      return { names: [...names, stepToNoteName(step, alteration)], held: nextHeld }
    },
    { names: [], held: new Map() }
  ).names
