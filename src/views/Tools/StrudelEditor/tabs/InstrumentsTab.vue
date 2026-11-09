<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import {
  Copy,
  CopyPlus,
  Download,
  PencilLine,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Square,
  Trash2
} from 'lucide-vue-next'
import IconButton from '@/components/IconButton.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { useAiSettings } from '../ai/useAiSettings'
import { INSTRUMENT_KINDS, INSTRUMENT_KIND_OPTIONS } from '../instruments/config'
import { isInstrumentKind } from '../instruments/presetScan'
import { useInstrumentPreview } from '../instruments/useInstrumentPreview'
import { useInstruments } from '../instruments/useInstruments'
import type { InstrumentKind } from '../instruments/types'

const store = useInstruments()
const {
  presets,
  selectedPreset,
  selectedStatus,
  isSelectedBuiltIn,
  errorByName,
  renderMillisecondsByName,
  assistantBusy,
  assistantExplanation,
  assistantError
} = storeToRefs(store)
const { apiKey } = storeToRefs(useAiSettings())

const description = ref('')
const newName = ref('')
const newKind = ref<InstrumentKind>('electric-guitar')
const renameValue = ref('')
const {
  exampleCode,
  copyMessage,
  previewState,
  previewMessage,
  togglePreview,
  downloadPreview,
  copyExample
} = useInstrumentPreview(selectedPreset)
const previewButtonLabel = computed(() =>
  previewState.value === 'idle' ? 'Play preview' : 'Stop preview'
)

// Presets render when selected, so opening the tab renders the one that is showing.
onMounted(() => {
  void store.refreshForeignSoundNames()
  if (selectedPreset.value !== undefined) {
    void store.ensureRendered(selectedPreset.value.name)
  }
})

watch(
  () => selectedPreset.value?.name,
  (name) => {
    renameValue.value = name ?? ''
  },
  { immediate: true }
)

const kindDefinition = computed(() =>
  selectedPreset.value === undefined ? undefined : INSTRUMENT_KINDS[selectedPreset.value.kind]
)

const presetOptions = computed(() =>
  presets.value.map(({ name, kind }) => ({
    value: name,
    label: `${name} (${INSTRUMENT_KINDS[kind].label})`
  }))
)

const selectedName = computed({
  get: () => selectedPreset.value?.name ?? '',
  set: (name: string) => store.selectPreset(name)
})

const onKindPicked = (kind: string): void => {
  if (isInstrumentKind(kind)) {
    newKind.value = kind
  }
}

// Each technique past the first is reached by its name, so the tab lists them.
const techniqueHint = computed(() =>
  (kindDefinition.value?.techniques ?? [])
    .slice(1)
    .map((id) => `${selectedPreset.value?.name}:${id}`)
    .join(', ')
)

const statusMessage = computed(() => {
  const name = selectedPreset.value?.name ?? ''
  const seconds = ((renderMillisecondsByName.value[name] ?? 0) / 1000).toFixed(1)
  const messages = {
    idle: 'Waiting to render.',
    rendering: `Rendering ${name}...`,
    ready: `Ready, rendered in ${seconds} s. Play renders the example below, and pasting it into the editor sounds the same.`,
    error: `Could not render ${name}: ${errorByName.value[name] ?? ''}`
  }
  return messages[selectedStatus.value]
})

const newNameCheck = computed(() => (newName.value === '' ? null : store.checkName(newName.value)))
const renameCheck = computed(() =>
  renameValue.value === selectedPreset.value?.name
    ? null
    : store.checkName(renameValue.value, selectedPreset.value?.name)
)

const canCreate = computed(() => newNameCheck.value?.valid === true)
const canRename = computed(() => renameCheck.value?.valid === true)
const canAsk = computed(
  () => !assistantBusy.value && apiKey.value.length > 0 && description.value.trim().length > 0
)

const onCreate = (): void => {
  if (store.createPreset(newName.value, newKind.value).valid) {
    newName.value = ''
  }
}

const onAsk = (): void => {
  void store.askAssistant(description.value.trim())
}
</script>

<template>
  <div class="strudel-instruments">
    <p class="strudel-instruments__status" role="status">{{ statusMessage }}</p>

    <div class="strudel-instruments__row">
      <span class="strudel-instruments__label">Preset</span>
      <Select v-model="selectedName" :options="presetOptions" />
    </div>
    <pre
      v-if="exampleCode"
      class="strudel-instruments__example"
      aria-label="Example code"
    ><code>{{ exampleCode }}</code></pre>
    <p v-if="techniqueHint" class="strudel-instruments__hint">
      Single notes are the plain name; pick a technique by name: {{ techniqueHint }}.
    </p>

    <template v-if="selectedPreset && kindDefinition">
      <div v-for="knob in kindDefinition.knobs" :key="knob.id" class="strudel-instruments__knob">
        <span class="strudel-instruments__label">
          <span>{{ knob.label }}</span>
          <span class="strudel-instruments__knob-hint">{{ knob.hint }}</span>
        </span>
        <Slider
          :model-value="[selectedPreset.knobs[knob.id] ?? 0.5]"
          :min="0"
          :max="1"
          :step="0.01"
          :label="knob.label"
          @update:model-value="store.setKnob(knob.id, $event[0] ?? 0)"
        />
      </div>
    </template>

    <div class="strudel-instruments__actions">
      <Button
        size="icon"
        :disabled="selectedStatus !== 'ready'"
        :aria-label="previewButtonLabel"
        :title="previewButtonLabel"
        :aria-busy="previewState === 'rendering'"
        @click="togglePreview"
      >
        <Play v-if="previewState === 'idle'" :size="16" aria-hidden="true" />
        <Square v-else :size="16" aria-hidden="true" />
      </Button>
      <IconButton
        variant="outline"
        title="Download WAV"
        aria-label="Download WAV"
        :disabled="selectedStatus !== 'ready'"
        @click="downloadPreview"
      >
        <Download :size="16" aria-hidden="true" />
      </IconButton>
      <IconButton
        variant="outline"
        title="Copy the example code"
        aria-label="Copy"
        :disabled="!exampleCode"
        @click="copyExample"
      >
        <Copy :size="16" aria-hidden="true" />
      </IconButton>
      <IconButton
        variant="outline"
        title="Reset the knobs"
        aria-label="Reset"
        @click="store.resetPreset"
      >
        <RotateCcw :size="16" aria-hidden="true" />
      </IconButton>
    </div>
    <p v-if="copyMessage" class="strudel-instruments__hint" role="status">{{ copyMessage }}</p>
    <p v-if="previewState === 'rendering'" class="strudel-instruments__hint" role="status">
      Rendering the preview...
    </p>
    <p v-if="previewMessage" class="strudel-instruments__error" role="alert">
      {{ previewMessage }}
    </p>

    <section class="strudel-instruments__section" aria-label="Manage presets">
      <h4 class="strudel-instruments__title">Presets</h4>
      <div class="strudel-instruments__inline">
        <Input
          v-if="!isSelectedBuiltIn"
          v-model="renameValue"
          class="strudel-instruments__inline-input"
          aria-label="Rename preset"
          placeholder="Rename preset"
        />
        <IconButton
          v-if="!isSelectedBuiltIn"
          variant="outline"
          title="Rename the preset"
          aria-label="Rename"
          :disabled="!canRename"
          @click="store.renamePreset(renameValue)"
        >
          <PencilLine :size="16" aria-hidden="true" />
        </IconButton>
        <IconButton
          variant="outline"
          title="Duplicate the preset"
          aria-label="Duplicate"
          @click="store.duplicatePreset"
        >
          <CopyPlus :size="16" aria-hidden="true" />
        </IconButton>
        <IconButton
          variant="outline"
          title="Delete the preset"
          aria-label="Delete"
          :disabled="isSelectedBuiltIn"
          @click="store.deletePreset"
        >
          <Trash2 :size="16" aria-hidden="true" />
        </IconButton>
      </div>
      <p v-if="renameCheck && !renameCheck.valid" class="strudel-instruments__error" role="alert">
        {{ renameCheck.message }}
      </p>
      <div class="strudel-instruments__inline">
        <Input
          v-model="newName"
          class="strudel-instruments__inline-input"
          aria-label="New preset name"
          placeholder="New preset name"
        />
        <div class="strudel-instruments__inline-kind">
          <Select
            :model-value="newKind"
            :options="INSTRUMENT_KIND_OPTIONS"
            aria-label="Kind of the new preset"
            @update:model-value="onKindPicked"
          />
        </div>
        <IconButton
          variant="default"
          title="Create the preset"
          aria-label="Create"
          :disabled="!canCreate"
          @click="onCreate"
        >
          <Plus :size="16" aria-hidden="true" />
        </IconButton>
      </div>
      <p v-if="newNameCheck && !newNameCheck.valid" class="strudel-instruments__error" role="alert">
        {{ newNameCheck.message }}
      </p>
      <p class="strudel-instruments__hint">
        Built-in presets can be tweaked and reset, not renamed or deleted. Your presets and tweaks
        are kept in this browser.
      </p>
    </section>

    <section class="strudel-instruments__section" aria-label="AI tone">
      <h4 class="strudel-instruments__title">AI tone</h4>
      <div class="strudel-instruments__inline">
        <Input
          v-model="description"
          class="strudel-instruments__inline-input"
          placeholder="Dry desert fuzz, scooped mids"
          aria-label="Describe the tone"
        />
        <IconButton
          variant="default"
          :title="assistantBusy ? 'Asking...' : 'Ask for the knobs'"
          aria-label="Ask"
          :aria-busy="assistantBusy"
          :disabled="!canAsk"
          @click="onAsk"
        >
          <Sparkles :size="16" aria-hidden="true" />
        </IconButton>
      </div>
      <p v-if="apiKey.length === 0" class="strudel-instruments__hint">
        Add your OpenRouter key in the Settings tab, where the model is picked too.
      </p>
      <p v-if="assistantError" class="strudel-instruments__error" role="alert">
        {{ assistantError }}
      </p>
      <p v-else-if="assistantExplanation" class="strudel-instruments__hint">
        {{ assistantExplanation }}
      </p>
    </section>
  </div>
</template>

<style scoped>
.strudel-instruments {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  padding: var(--spacing-4);
}

.strudel-instruments__row {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.strudel-instruments__status,
.strudel-instruments__hint {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-muted-foreground);
}

.strudel-instruments__example {
  margin: 0;
  padding: var(--spacing-2) var(--spacing-3);
  overflow-x: auto;
  font-family: var(--font-mono, monospace);
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
  background: var(--color-muted);
  border-radius: var(--radius-md);
}

.strudel-instruments__knob {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.strudel-instruments__label {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
}

.strudel-instruments__knob-hint {
  color: var(--color-muted-foreground);
}

.strudel-instruments__section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.strudel-instruments__title {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-foreground);
}

.strudel-instruments__actions,
.strudel-instruments__inline {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.strudel-instruments__inline-input {
  flex: 1;
  min-width: 0;
}

.strudel-instruments__inline-kind {
  flex: none;
}

.strudel-instruments__error {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-destructive);
}
</style>
