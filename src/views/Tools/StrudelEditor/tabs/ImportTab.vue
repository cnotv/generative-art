<script setup lang="ts">
import { computed } from 'vue'
import Button from '@/components/ui/button/Button.vue'
import DropZone from '@/components/DropZone.vue'
import { TRANSCRIPTION_ACCEPTED_TYPES, TRANSCRIPTION_STAGE_LABELS } from '../config'
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

const stageLabel = computed(() =>
  props.progress === null
    ? TRANSCRIPTION_STAGE_LABELS.decoding
    : TRANSCRIPTION_STAGE_LABELS[props.progress.stage]
)

const chordProgression = computed(() =>
  (props.result?.bars ?? [])
    .map((bar) => bar.chord)
    .filter((chord): chord is string => chord !== null)
    .filter((chord, index, chords) => index === 0 || chords[index - 1] !== chord)
    .join(' ')
)

const onFilesChosen = (files: FileList): void => {
  const chosenFile = files.item(0)
  if (chosenFile !== null) {
    emit('file', chosenFile)
  }
}

const onLoadRequested = (): void => {
  emit('load')
}
</script>

<template>
  <section class="strudel-import">
    <p class="strudel-import__intro">
      Turn a song or a MIDI file into a Strudel pattern. Audio is analysed in your browser for its
      tempo, drums, bass line and chords; a MIDI file is read note for note. Either way it is
      written out as code you can play and edit.
    </p>
    <DropZone
      label="Drop an MP3, other audio or a MIDI file here, or click to browse"
      :accept="TRANSCRIPTION_ACCEPTED_TYPES"
      @change="onFilesChosen"
    />

    <div v-if="status === 'working'" class="strudel-import__progress" role="status">
      <progress
        class="strudel-import__progress-bar"
        :value="progress?.fraction ?? 0"
        max="1"
        aria-label="Transcription progress"
      />
      <span class="strudel-import__stage">{{ stageLabel }}</span>
    </div>
    <p v-else-if="status === 'error'" class="strudel-import__error" role="alert">
      {{ errorMessage }}
    </p>
    <template v-else-if="status === 'done' && result !== null">
      <dl class="strudel-import__summary">
        <dt>Tempo</dt>
        <dd>{{ result.beatsPerMinute }} BPM</dd>
        <dt>Bars</dt>
        <dd>{{ result.bars.length }}</dd>
        <dt>Chords</dt>
        <dd>{{ chordProgression || 'none detected' }}</dd>
      </dl>
      <pre class="strudel-import__code">{{ code }}</pre>
      <Button class="strudel-import__load" @click="onLoadRequested">Load into editor</Button>
    </template>

    <p class="strudel-import__note">
      From audio, the result is a sketch in the spirit of the track, not a copy: it hears drums, a
      bass line and one chord per bar, and leaves the melody to you.
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

.strudel-import__progress {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

.strudel-import__progress-bar {
  flex: 1;
  accent-color: var(--color-primary);
}

.strudel-import__stage {
  font-size: var(--font-size-sm);
  color: var(--color-muted-foreground);
}

.strudel-import__error {
  margin: 0;
  color: var(--color-destructive);
}

.strudel-import__summary {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: var(--spacing-1) var(--spacing-4);
  margin: 0;
  font-size: var(--font-size-md);
}

.strudel-import__summary dt {
  font-weight: 600;
  color: var(--color-muted-foreground);
}

.strudel-import__summary dd {
  margin: 0;
  color: var(--color-foreground);
}

.strudel-import__load {
  align-self: flex-start;
}

.strudel-import__code {
  margin: 0;
  padding: var(--spacing-3);
  max-height: 12rem;
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  color: var(--color-foreground);
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  white-space: pre;
}
</style>
