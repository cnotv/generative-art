<script setup lang="ts">
import { computed } from 'vue'
import Button from '@/components/ui/button/Button.vue'
import TranscriptionPanel from '../TranscriptionPanel.vue'
import { MIDI_ACCEPTED_TYPES } from '../config'
import { createMidiSnippets, useMidiDevices } from '../useMidiDevices'
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
  code: [patternCode: string]
}>()

const { midiDeviceStatus, midiInputNames, midiOutputNames, connectMidiDevices } = useMidiDevices()

const DEVICE_STATUS_MESSAGES = {
  idle: 'Connect to list the keyboards, controllers and synths plugged into this computer.',
  connecting: 'Waiting for permission to use MIDI devices...',
  ready: '',
  unsupported: 'This browser has no Web MIDI support. Chrome, Edge and Firefox do.',
  denied: 'MIDI access was refused. Allow it in the site settings, then connect again.'
} as const

const snippets = computed(() =>
  createMidiSnippets(midiInputNames.value[0] ?? null, midiOutputNames.value[0] ?? null)
)

const onConnect = (): void => {
  void connectMidiDevices()
}
</script>

<template>
  <section class="strudel-midi">
    <h3 class="strudel-midi__heading">MIDI file</h3>
    <p class="strudel-midi__intro">
      Load a .mid file: its drums, lowest notes and chords are read onto a sixteen-step grid and
      written out as code.
    </p>
    <TranscriptionPanel
      v-bind="props"
      :accept="MIDI_ACCEPTED_TYPES"
      drop-label="Drop a MIDI file here, or click to browse"
      @file="emit('file', $event)"
      @load="emit('load')"
    />

    <h3 class="strudel-midi__heading">MIDI devices</h3>
    <p v-if="midiDeviceStatus !== 'ready'" class="strudel-midi__intro">
      {{ DEVICE_STATUS_MESSAGES[midiDeviceStatus] }}
    </p>
    <dl v-else class="strudel-midi__devices">
      <dt>Inputs</dt>
      <dd>{{ midiInputNames.join(', ') || 'none connected' }}</dd>
      <dt>Outputs</dt>
      <dd>{{ midiOutputNames.join(', ') || 'none connected' }}</dd>
    </dl>
    <Button
      v-if="midiDeviceStatus !== 'ready'"
      class="strudel-midi__connect"
      variant="secondary"
      :disabled="midiDeviceStatus === 'connecting' || midiDeviceStatus === 'unsupported'"
      @click="onConnect"
    >
      Connect MIDI devices
    </Button>

    <article v-for="snippet in snippets" :key="snippet.id" class="strudel-midi__snippet">
      <h4 class="strudel-midi__snippet-title">{{ snippet.title }}</h4>
      <p class="strudel-midi__intro">{{ snippet.description }}</p>
      <pre class="strudel-midi__code">{{ snippet.code }}</pre>
      <Button size="sm" variant="outline" @click="emit('code', snippet.code)">
        Load into editor
      </Button>
    </article>
  </section>
</template>

<style scoped>
.strudel-midi {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  padding: var(--spacing-4);
}

.strudel-midi__heading,
.strudel-midi__snippet-title {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-foreground);
}

.strudel-midi__intro {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-muted-foreground);
}

.strudel-midi__devices {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: var(--spacing-1) var(--spacing-4);
  margin: 0;
  font-size: var(--font-size-sm);
}

.strudel-midi__devices dt {
  font-weight: 600;
  color: var(--color-muted-foreground);
}

.strudel-midi__devices dd {
  margin: 0;
  color: var(--color-foreground);
}

.strudel-midi__connect {
  align-self: flex-start;
}

.strudel-midi__snippet {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-2);
  padding-top: var(--spacing-3);
  border-top: 1px solid var(--color-border);
}

.strudel-midi__code {
  align-self: stretch;
  margin: 0;
  padding: var(--spacing-3);
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
