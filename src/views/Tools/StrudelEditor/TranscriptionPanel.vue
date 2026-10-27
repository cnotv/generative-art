<script setup lang="ts">
import { computed } from 'vue'
import Button from '@/components/ui/button/Button.vue'
import DropZone from '@/components/DropZone.vue'
import { TRANSCRIPTION_STAGE_LABELS } from './config'
import type { TranscriptionProgress, TranscriptionResult, TranscriptionStatus } from './types'

const props = defineProps<{
  accept: string
  dropLabel: string
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
  <div class="strudel-transcription">
    <DropZone :label="dropLabel" :accept="accept" @change="onFilesChosen" />

    <div v-if="status === 'working'" class="strudel-transcription__progress" role="status">
      <progress
        class="strudel-transcription__progress-bar"
        :value="progress?.fraction ?? 0"
        max="1"
        aria-label="Transcription progress"
      />
      <span class="strudel-transcription__stage">{{ stageLabel }}</span>
    </div>
    <p v-else-if="status === 'error'" class="strudel-transcription__error" role="alert">
      {{ errorMessage }}
    </p>
    <template v-else-if="status === 'done' && result !== null">
      <dl class="strudel-transcription__summary">
        <dt>Tempo</dt>
        <dd>{{ result.beatsPerMinute }} BPM</dd>
        <dt>Bars</dt>
        <dd>{{ result.bars.length }}</dd>
        <dt>Chords</dt>
        <dd>{{ chordProgression || 'none detected' }}</dd>
      </dl>
      <pre class="strudel-transcription__code">{{ code }}</pre>
      <Button class="strudel-transcription__load" @click="onLoadRequested">Load into editor</Button>
    </template>
  </div>
</template>

<style scoped>
.strudel-transcription {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.strudel-transcription__progress {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

.strudel-transcription__progress-bar {
  flex: 1;
  accent-color: var(--color-primary);
}

.strudel-transcription__stage {
  font-size: var(--font-size-sm);
  color: var(--color-muted-foreground);
}

.strudel-transcription__error {
  margin: 0;
  color: var(--color-destructive);
}

.strudel-transcription__summary {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: var(--spacing-1) var(--spacing-4);
  margin: 0;
  font-size: var(--font-size-md);
}

.strudel-transcription__summary dt {
  font-weight: 600;
  color: var(--color-muted-foreground);
}

.strudel-transcription__summary dd {
  margin: 0;
  color: var(--color-foreground);
}

.strudel-transcription__load {
  align-self: flex-start;
}

.strudel-transcription__code {
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
