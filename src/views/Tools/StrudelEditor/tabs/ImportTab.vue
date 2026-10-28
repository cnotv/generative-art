<script setup lang="ts">
import { computed } from 'vue'
import Button from '@/components/ui/button/Button.vue'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion'
import DropZone from '@/components/DropZone.vue'
import { TRANSCRIPTION_ACCEPTED_TYPES, TRANSCRIPTION_STAGE_LABELS } from '../config'
import { createImportedSong, toSongSources } from '../transcription/generateSongCode'
import type { ImportedTranscription, TranscriptionProgress, TranscriptionStatus } from '../types'

const props = defineProps<{
  status: TranscriptionStatus
  progress: TranscriptionProgress | null
  transcriptions: ImportedTranscription[]
  code: string
  warnings: string[]
  errorMessage: string
  addVisualizer: boolean
}>()

const emit = defineEmits<{
  files: [chosenFiles: File[]]
  load: []
  add: []
  remove: [transcriptionId: number]
  'update:addVisualizer': [addVisualizer: boolean]
}>()

const stageLabel = computed(() =>
  props.progress === null
    ? TRANSCRIPTION_STAGE_LABELS.decoding
    : TRANSCRIPTION_STAGE_LABELS[props.progress.stage]
)

// An audio or MIDI import stands alone, so the list then holds just that one.
const gridResult = computed(() => {
  const result = props.transcriptions[0]?.result
  return result?.kind === 'grid' ? result : null
})

const chordProgression = computed(() =>
  (gridResult.value?.bars ?? [])
    .map((bar) => bar.chord)
    .filter((chord): chord is string => chord !== null)
    .filter((chord, index, chords) => index === 0 || chords[index - 1] !== chord)
    .join(' ')
)

// One row per file, naming the instruments it plays; a score that only rests plays none.
const songRows = computed(() => {
  const song = createImportedSong(toSongSources(props.transcriptions))
  return {
    beatsPerMinute: song.beatsPerMinute,
    rows: song.sources.map((source, sourceIndex) => ({
      id: props.transcriptions[sourceIndex].id,
      sourceName: source.sourceName,
      barCount: source.transcription.bars.length,
      label:
        song.instruments
          .filter((instrument) => instrument.sourceIndex === sourceIndex)
          .map((instrument) => instrument.label)
          .join(' and ') || 'piano score'
    }))
  }
})

const warningCountLabel = computed(() =>
  props.warnings.length === 1 ? '1 warning' : `${props.warnings.length} warnings`
)

const onFilesChosen = (files: FileList): void => {
  emit('files', [...files])
}
</script>

<template>
  <section class="strudel-import">
    <Accordion>
      <AccordionItem value="intro">
        <AccordionTrigger>Turn music into Strudel code</AccordionTrigger>
        <AccordionContent>
          <p class="strudel-import__text">
            Turn a song, a MIDI file, a tab or a piano score into a Strudel pattern. Audio is
            analysed in your browser for its tempo, drums, bass line and chords; a MIDI file is read
            note for note; a bass or guitar tab and a piano score are read from the picture. Either
            way it is written out as code you can play and edit.
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
    <DropZone
      label="Drop an MP3, other audio, a MIDI file, or tab or piano score images here, or click to browse"
      :accept="TRANSCRIPTION_ACCEPTED_TYPES"
      multiple
      @change="onFilesChosen"
    />
    <div class="strudel-import__option">
      <Checkbox
        id="strudel-import-visualizer"
        :model-value="addVisualizer"
        @update:model-value="emit('update:addVisualizer', $event)"
      />
      <label for="strudel-import-visualizer">Draw a pianoroll per instrument</label>
    </div>

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
    <template v-if="gridResult !== null">
      <dl class="strudel-import__summary">
        <dt>Tempo</dt>
        <dd>{{ gridResult.beatsPerMinute }} BPM</dd>
        <dt>Bars</dt>
        <dd>{{ gridResult.bars.length }}</dd>
        <dt>Chords</dt>
        <dd>{{ chordProgression || 'none detected' }}</dd>
      </dl>
      <Accordion>
        <AccordionItem value="code">
          <AccordionTrigger>Code</AccordionTrigger>
          <AccordionContent>
            <pre class="strudel-import__code">{{ code }}</pre>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      <Button class="strudel-import__action" @click="emit('load')">Load</Button>
    </template>
    <template v-else-if="songRows.rows.length > 0">
      <dl class="strudel-import__summary">
        <dt>Tempo</dt>
        <dd>{{ songRows.beatsPerMinute }} BPM</dd>
      </dl>
      <ul class="strudel-import__instruments">
        <li v-for="row in songRows.rows" :key="row.id" class="strudel-import__instrument">
          <span class="strudel-import__instrument-label">{{ row.label }}</span>
          <span class="strudel-import__instrument-source">
            {{ row.sourceName }}, {{ row.barCount }} bars
          </span>
          <Button
            class="strudel-import__instrument-remove"
            size="sm"
            variant="outline"
            :aria-label="`Remove ${row.label} ${row.sourceName}`"
            @click="emit('remove', row.id)"
          >
            Remove
          </Button>
        </li>
      </ul>
      <Accordion type="multiple">
        <AccordionItem v-if="warnings.length > 0" value="warnings">
          <AccordionTrigger>{{ warningCountLabel }}</AccordionTrigger>
          <AccordionContent>
            <ul class="strudel-import__warnings">
              <li v-for="warning in warnings" :key="warning">{{ warning }}</li>
            </ul>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="code">
          <AccordionTrigger>Code</AccordionTrigger>
          <AccordionContent>
            <pre class="strudel-import__code">{{ code }}</pre>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      <div class="strudel-import__actions">
        <Button @click="emit('load')">Load</Button>
        <Button variant="outline" @click="emit('add')">Add</Button>
      </div>
    </template>

    <Accordion>
      <AccordionItem value="suggestions">
        <AccordionTrigger>Read suggestions</AccordionTrigger>
        <AccordionContent>
          <p class="strudel-import__text">
            From audio, the result is a sketch in the spirit of the track, not a copy: it hears
            drums, a bass line and one chord per bar, and leaves the melody to you. A tab screenshot
            works best when it is a clean digital one with the rhythm row under the staff, and a
            piano score when it is a clean engraving of a grand staff; grace notes, ornaments and
            ties are not read. The tempo is read from a marker such as "= 96" above the first staff,
            and is 120 when there is none. Drop several tabs and scores, together or one after
            another, and each becomes its own instrument on the first file's tempo. Load replaces
            the editor's code; Add appends the instruments to it.
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  </section>
</template>

<style scoped>
.strudel-import {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  padding: var(--spacing-4);
}

.strudel-import__text {
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

.strudel-import__option {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--font-size-md);
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
  display: grid;
  grid-template-areas:
    'label remove'
    'source remove';
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0 var(--spacing-3);
  font-size: var(--font-size-md);
}

.strudel-import__instrument-label {
  grid-area: label;
  font-weight: 600;
  color: var(--color-foreground);
}

.strudel-import__instrument-source {
  grid-area: source;
  overflow-wrap: anywhere;
  font-size: var(--font-size-sm);
  color: var(--color-muted-foreground);
}

.strudel-import__instrument-remove {
  grid-area: remove;
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
