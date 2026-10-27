<script setup lang="ts">
import TranscriptionPanel from '../TranscriptionPanel.vue'
import { TRANSCRIPTION_ACCEPTED_TYPES } from '../config'
import type { TranscriptionProgress, TranscriptionResult, TranscriptionStatus } from '../types'

const props = defineProps<{
  status: TranscriptionStatus
  progress: TranscriptionProgress | null
  result: TranscriptionResult | null
  code: string
  errorMessage: string
}>()

const emit = defineEmits<{
  file: [chosenFile: File]
  load: []
}>()
</script>

<template>
  <section class="strudel-import">
    <p class="strudel-import__intro">
      Turn a song into a Strudel pattern. The file is analysed in your browser for its tempo, drums,
      bass line and chords, then written out as code you can play and edit.
    </p>
    <TranscriptionPanel
      v-bind="props"
      :accept="TRANSCRIPTION_ACCEPTED_TYPES"
      drop-label="Drop an MP3 or other audio file here, or click to browse"
      @file="emit('file', $event)"
      @load="emit('load')"
    />
    <p class="strudel-import__note">
      The result is a sketch in the spirit of the track, not a copy: it hears drums, a bass line and
      one chord per bar, and leaves the melody to you.
    </p>
  </section>
</template>

<style scoped>
.strudel-import {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  padding: var(--spacing-4);
}

.strudel-import__intro,
.strudel-import__note {
  margin: 0;
  font-size: var(--font-size-md);
  color: var(--color-muted-foreground);
}
</style>
