<script setup lang="ts">
import { formatStrudelFlowBeats } from '../../noteValues'
import type { StrudelFlowNoteBar } from '../../types'

defineProps<{
  bars: StrudelFlowNoteBar[]
}>()
</script>

<template>
  <ol class="strudel-flow-note-names nowheel" aria-label="Notes by bar">
    <li v-for="(bar, barIndex) in bars" :key="barIndex" class="strudel-flow-note-names__bar">
      <span class="strudel-flow-note-names__bar-number">{{ barIndex + 1 }}</span>
      <span
        v-for="(event, eventIndex) in bar"
        :key="eventIndex"
        class="strudel-flow-note-names__note"
      >
        <span class="strudel-flow-note-names__name">{{ event.notes.join(',') }}</span
        >&#32;<span class="strudel-flow-note-names__length">{{
          formatStrudelFlowBeats(event.beats)
        }}</span>
      </span>
    </li>
  </ol>
</template>
