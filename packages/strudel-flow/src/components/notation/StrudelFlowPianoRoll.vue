<script setup lang="ts">
import { computed } from 'vue'
import {
  STRUDEL_FLOW_BLACK_KEY_CLASSES,
  STRUDEL_FLOW_PIANO_ROLL_BEAT_WIDTH,
  STRUDEL_FLOW_PIANO_ROLL_GUTTER,
  STRUDEL_FLOW_PIANO_ROLL_MIN_ROWS,
  STRUDEL_FLOW_PIANO_ROLL_ROW_HEIGHT
} from '../../config'
import { readStrudelFlowMidiNote } from '../../noteValues'
import type { StrudelFlowNoteBar } from '../../types'

const props = defineProps<{
  bars: StrudelFlowNoteBar[]
  beatsPerBar: number
}>()

const SEMITONES_PER_OCTAVE = 12

const notes = computed(() =>
  props.bars.flatMap((bar, barIndex) =>
    bar.flatMap((event) =>
      event.notes.flatMap((note) => {
        const midiNote = readStrudelFlowMidiNote(note)
        return midiNote === null
          ? []
          : [{ midiNote, beat: barIndex * props.beatsPerBar + event.start, beats: event.beats }]
      })
    )
  )
)

// One row per semitone, a note of space above and below, and never fewer than an octave.
const pitchRange = computed(() => {
  const pitches = notes.value.map((note) => note.midiNote)
  const low = Math.min(...pitches) - 1
  const high = Math.max(Math.max(...pitches) + 1, low + STRUDEL_FLOW_PIANO_ROLL_MIN_ROWS - 1)
  return { low, high }
})

const rows = computed(() =>
  Array.from(
    { length: pitchRange.value.high - pitchRange.value.low + 1 },
    (_, offset) => pitchRange.value.high - offset
  )
)

const rowY = (midiNote: number): number =>
  (pitchRange.value.high - midiNote) * STRUDEL_FLOW_PIANO_ROLL_ROW_HEIGHT

const beatX = (beat: number): number =>
  STRUDEL_FLOW_PIANO_ROLL_GUTTER + beat * STRUDEL_FLOW_PIANO_ROLL_BEAT_WIDTH

const width = computed(() => beatX(props.bars.length * props.beatsPerBar))
const height = computed(() => rows.value.length * STRUDEL_FLOW_PIANO_ROLL_ROW_HEIGHT)
const isBlackKey = (midiNote: number): boolean =>
  STRUDEL_FLOW_BLACK_KEY_CLASSES.includes(midiNote % SEMITONES_PER_OCTAVE)
const isC = (midiNote: number): boolean => midiNote % SEMITONES_PER_OCTAVE === 0
const octaveOf = (midiNote: number): number => Math.floor(midiNote / SEMITONES_PER_OCTAVE) - 1
</script>

<template>
  <div v-if="notes.length > 0" class="strudel-flow-piano-roll nowheel">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      data-notation="piano"
      :width="width"
      :height="height"
      :viewBox="`0 0 ${width} ${height}`"
      role="img"
      :aria-label="`Piano roll, ${bars.length} bars`"
    >
      <template v-for="midiNote in rows" :key="midiNote">
        <rect
          v-if="isBlackKey(midiNote)"
          class="strudel-flow-piano-roll__black-key"
          :x="0"
          :y="rowY(midiNote)"
          :width="width"
          :height="STRUDEL_FLOW_PIANO_ROLL_ROW_HEIGHT"
        />
        <text
          v-if="isC(midiNote)"
          class="strudel-flow-piano-roll__label"
          :x="2"
          :y="rowY(midiNote) + STRUDEL_FLOW_PIANO_ROLL_ROW_HEIGHT"
        >
          C{{ octaveOf(midiNote) }}
        </text>
      </template>
      <line
        v-for="barIndex in bars.length + 1"
        :key="`bar-${barIndex}`"
        class="strudel-flow-piano-roll__bar-line"
        :x1="beatX((barIndex - 1) * beatsPerBar)"
        :y1="0"
        :x2="beatX((barIndex - 1) * beatsPerBar)"
        :y2="height"
      />
      <rect
        v-for="(note, noteIndex) in notes"
        :key="`note-${noteIndex}`"
        class="strudel-flow-piano-roll__note"
        :x="beatX(note.beat)"
        :y="rowY(note.midiNote)"
        :width="Math.max(1, note.beats * STRUDEL_FLOW_PIANO_ROLL_BEAT_WIDTH - 1)"
        :height="STRUDEL_FLOW_PIANO_ROLL_ROW_HEIGHT"
        rx="1"
      />
    </svg>
  </div>
</template>
