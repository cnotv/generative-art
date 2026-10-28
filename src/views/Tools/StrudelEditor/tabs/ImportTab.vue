<script setup lang="ts">
import { computed } from 'vue'
import Button from '@/components/ui/button/Button.vue'
import DropZone from '@/components/DropZone.vue'
import { TRANSCRIPTION_ACCEPTED_TYPES, TRANSCRIPTION_STAGE_LABELS } from '../config'
import { createTabSong, toTabSources } from '../transcription/generateTabCode'
import type { ImportedTranscription, TranscriptionProgress, TranscriptionStatus } from '../types'

const props = defineProps<{
  status: TranscriptionStatus
  progress: TranscriptionProgress | null
  transcriptions: ImportedTranscription[]
  code: string
  warnings: string[]
  errorMessage: string
}>()

const emit = defineEmits<{
  files: [chosenFiles: File[]]
  load: []
  add: []
  remove: [transcriptionId: number]
}>()

const stageLabel = computed(() =>
  props.progress === null
    ? TRANSCRIPTION_STAGE_LABELS.decoding
    : TRANSCRIPTION_STAGE_LABELS[props.progress.stage]
)

// Audio, MIDI and score imports stand alone, so the list then holds just that one.
const standaloneResult = computed(() => {
  const result = props.transcriptions[0]?.result
  return result === undefined || result.kind === 'tab' ? null : result
})

const chordProgression = computed(() =>
  (standaloneResult.value?.kind === 'grid' ? standaloneResult.value.bars : [])
    .map((bar) => bar.chord)
    .filter((chord): chord is string => chord !== null)
    .filter((chord, index, chords) => index === 0 || chords[index - 1] !== chord)
    .join(' ')
)

// Only tabs are listed, and only while the list holds nothing else, so rows match the song's.
const tabRows = computed(() => {
  const song = createTabSong(toTabSources(props.transcriptions))
  return {
    beatsPerMinute: song.beatsPerMinute,
    instruments: song.instruments.map((instrument, index) => ({
      ...instrument,
      id: props.transcriptions[index].id
    }))
  }
})

const onFilesChosen = (files: FileList): void => {
  emit('files', [...files])
}
</script>

<template>
  <section class="strudel-import">
    <p class="strudel-import__intro">
      Turn a song, a MIDI file, a tab or a piano score into a Strudel pattern. Audio is analysed in
      your browser for its tempo, drums, bass line and chords; a MIDI file is read note for note; a
      bass or guitar tab and a piano score are read from the picture. Either way it is written out
      as code you can play and edit.
    </p>
    <DropZone
      label="Drop an MP3, other audio, a MIDI file, or tab or piano score images here, or click to browse"
      :accept="TRANSCRIPTION_ACCEPTED_TYPES"
      multiple
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
    <template v-if="standaloneResult !== null">
      <dl class="strudel-import__summary">
        <dt>Tempo</dt>
        <dd>{{ standaloneResult.beatsPerMinute }} BPM</dd>
        <dt>Bars</dt>
        <dd>{{ standaloneResult.bars.length }}</dd>
        <template v-if="standaloneResult.kind === 'grid'">
          <dt>Chords</dt>
          <dd>{{ chordProgression || 'none detected' }}</dd>
        </template>
      </dl>
      <pre class="strudel-import__code">{{ code }}</pre>
      <Button class="strudel-import__action" @click="emit('load')">Load into editor</Button>
    </template>
    <template v-else-if="tabRows.instruments.length > 0">
      <dl class="strudel-import__summary">
        <dt>Tempo</dt>
        <dd>{{ tabRows.beatsPerMinute }} BPM</dd>
      </dl>
      <ul class="strudel-import__instruments">
        <li
          v-for="instrument in tabRows.instruments"
          :key="instrument.id"
          class="strudel-import__instrument"
        >
          <span class="strudel-import__instrument-label">{{ instrument.label }}</span>
          <span class="strudel-import__instrument-source">
            {{ instrument.sourceName }}, {{ instrument.transcription.bars.length }} bars
          </span>
          <Button
            size="sm"
            variant="outline"
            :aria-label="`Remove ${instrument.label} ${instrument.sourceName}`"
            @click="emit('remove', instrument.id)"
          >
            Remove
          </Button>
        </li>
      </ul>
      <ul v-if="warnings.length > 0" class="strudel-import__warnings">
        <li v-for="warning in warnings" :key="warning">{{ warning }}</li>
      </ul>
      <pre class="strudel-import__code">{{ code }}</pre>
      <div class="strudel-import__actions">
        <Button @click="emit('load')">Load into editor</Button>
        <Button variant="outline" @click="emit('add')">Add to editor</Button>
      </div>
    </template>

    <p class="strudel-import__note">
      From audio, the result is a sketch in the spirit of the track, not a copy: it hears drums, a
      bass line and one chord per bar, and leaves the melody to you. A tab screenshot works best
      when it is a clean digital one with the rhythm row under the staff, and a piano score when it
      is a clean engraving of a grand staff; grace notes, ornaments and ties are not read. The tempo
      is read from a marker such as "= 96" above the first staff, and is 120 when there is none.
      Drop several tabs, together or one after another, and each becomes its own instrument on the
      first tab's tempo. Load replaces the editor's code; Add appends the instruments to it.
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

.strudel-import__action {
  align-self: flex-start;
}

.strudel-import__actions {
  display: flex;
  gap: var(--spacing-2);
}

.strudel-import__instruments,
.strudel-import__warnings {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.strudel-import__instrument {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  font-size: var(--font-size-md);
}

.strudel-import__instrument-label {
  font-weight: 600;
  color: var(--color-foreground);
}

.strudel-import__instrument-source {
  flex: 1;
  color: var(--color-muted-foreground);
}

.strudel-import__warnings {
  font-size: var(--font-size-sm);
  color: var(--color-muted-foreground);
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
