<script setup lang="ts">
import { computed } from 'vue'
import { formatStrudelFlowBeats } from '../../noteValues'
import type { StrudelFlowNoteBar } from '../../types'

const props = defineProps<{
  bars: StrudelFlowNoteBar[]
  beatsPerBar: number
}>()

const REST = '~'
const BEAT_TOLERANCE = 1e-6

// Silence between notes, and at the end of a bar that stops early, is listed as a rest.
const restOf = (beats: number): { name: string; beats: number }[] =>
  beats > BEAT_TOLERANCE ? [{ name: REST, beats }] : []

const listedBars = computed(() =>
  props.bars.map((bar) => {
    const listed = bar.reduce<{ end: number; entries: { name: string; beats: number }[] }>(
      (state, event) => ({
        end: event.start + event.beats,
        entries: [
          ...state.entries,
          ...restOf(event.start - state.end),
          { name: event.notes.join(','), beats: event.beats }
        ]
      }),
      { end: 0, entries: [] }
    )
    return [...listed.entries, ...restOf(props.beatsPerBar - listed.end)]
  })
)
</script>

<template>
  <ol class="strudel-flow-note-names nowheel" aria-label="Notes by bar">
    <li v-for="(bar, barIndex) in listedBars" :key="barIndex" class="strudel-flow-note-names__bar">
      <span class="strudel-flow-note-names__bar-number">{{ barIndex + 1 }}</span>
      <span
        v-for="(entry, entryIndex) in bar"
        :key="entryIndex"
        class="strudel-flow-note-names__note"
      >
        <span class="strudel-flow-note-names__name">{{ entry.name }}</span
        >&#32;<span class="strudel-flow-note-names__length">{{
          formatStrudelFlowBeats(entry.beats)
        }}</span>
      </span>
    </li>
  </ol>
</template>
