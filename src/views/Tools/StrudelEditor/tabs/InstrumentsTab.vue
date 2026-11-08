<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import {
  INSTRUMENT_KINDS,
  INSTRUMENT_KIND_OPTIONS,
  INSTRUMENT_MODEL_OPTIONS
} from '../instruments/config'
import {
  buildInstrumentPreviewCode,
  buildInstrumentPreviewHits
} from '../instruments/previewPhrase'
import { isInstrumentKind } from '../instruments/presetScan'
import { useInstruments } from '../instruments/useInstruments'
import { downloadStrudelCodeAsWav, previewStrudelPhrase } from '../strudelPlayback'
import type { InstrumentKind } from '../instruments/types'

const store = useInstruments()
const {
  presets,
  selectedPreset,
  selectedStatus,
  isSelectedBuiltIn,
  errorByName,
  renderMillisecondsByName,
  apiKey,
  model,
  assistantBusy,
  assistantExplanation,
  assistantError
} = storeToRefs(store)

const description = ref('')
const newName = ref('')
const newKind = ref<InstrumentKind>('electric-guitar')
const renameValue = ref('')
const downloadMessage = ref('')
const downloadBusy = ref(false)

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

const usageHint = computed(() =>
  selectedPreset.value === undefined || kindDefinition.value === undefined
    ? ''
    : kindDefinition.value.usageHint.replaceAll('{name}', selectedPreset.value.name)
)

const statusMessage = computed(() => {
  const name = selectedPreset.value?.name ?? ''
  const seconds = ((renderMillisecondsByName.value[name] ?? 0) / 1000).toFixed(1)
  const messages = {
    idle: 'Waiting to render.',
    rendering: `Rendering ${name}...`,
    ready: `Ready, rendered in ${seconds} s. Press Play preview, or play it with the names below.`,
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

// Called straight from the click, so the audio unlock inside it still counts as the user's gesture.
const onPlayPreview = (): void => {
  if (selectedPreset.value !== undefined) {
    previewStrudelPhrase(buildInstrumentPreviewHits(selectedPreset.value)).catch(() => undefined)
  }
}

const onDownload = async (): Promise<void> => {
  const preset = selectedPreset.value
  if (preset === undefined) {
    return
  }
  downloadBusy.value = true
  downloadMessage.value = ''
  try {
    const result = await downloadStrudelCodeAsWav(
      buildInstrumentPreviewCode(preset),
      `${preset.name}-preview`
    )
    downloadMessage.value = result.success
      ? ''
      : (result.errorMessage ?? 'Could not render the file.')
  } catch (error) {
    downloadMessage.value = error instanceof Error ? error.message : 'Could not render the file.'
  } finally {
    downloadBusy.value = false
  }
}

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
    <p v-if="usageHint" class="strudel-instruments__hint">
      Sounds start with <code>{{ selectedPreset?.name }}_</code>: <code>{{ usageHint }}</code>
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
      <Button size="sm" :disabled="selectedStatus !== 'ready'" @click="onPlayPreview">
        Play preview
      </Button>
      <Button
        variant="outline"
        size="sm"
        :disabled="selectedStatus !== 'ready' || downloadBusy"
        @click="onDownload"
      >
        {{ downloadBusy ? 'Rendering...' : 'Download WAV' }}
      </Button>
      <Button variant="outline" size="sm" @click="store.resetPreset">Reset</Button>
    </div>
    <p v-if="downloadMessage" class="strudel-instruments__error" role="alert">
      {{ downloadMessage }}
    </p>

    <section class="strudel-instruments__section" aria-label="Manage presets">
      <h4 class="strudel-instruments__title">Presets</h4>
      <div class="strudel-instruments__actions">
        <Button variant="outline" size="sm" @click="store.duplicatePreset">Duplicate</Button>
        <Button
          variant="outline"
          size="sm"
          :disabled="isSelectedBuiltIn"
          @click="store.deletePreset"
        >
          Delete
        </Button>
      </div>
      <template v-if="!isSelectedBuiltIn">
        <Input v-model="renameValue" aria-label="Rename preset" placeholder="Rename preset" />
        <p v-if="renameCheck && !renameCheck.valid" class="strudel-instruments__error" role="alert">
          {{ renameCheck.message }}
        </p>
        <div class="strudel-instruments__actions">
          <Button
            variant="outline"
            size="sm"
            :disabled="!canRename"
            @click="store.renamePreset(renameValue)"
          >
            Rename
          </Button>
        </div>
      </template>
      <Input v-model="newName" aria-label="New preset name" placeholder="New preset name" />
      <div class="strudel-instruments__row">
        <span class="strudel-instruments__label">Kind</span>
        <Select
          :model-value="newKind"
          :options="INSTRUMENT_KIND_OPTIONS"
          @update:model-value="onKindPicked"
        />
      </div>
      <p v-if="newNameCheck && !newNameCheck.valid" class="strudel-instruments__error" role="alert">
        {{ newNameCheck.message }}
      </p>
      <div class="strudel-instruments__actions">
        <Button size="sm" :disabled="!canCreate" @click="onCreate">Create</Button>
      </div>
      <p class="strudel-instruments__hint">
        Built-in presets can be tweaked and reset, not renamed or deleted. Your presets and tweaks
        are kept in this browser.
      </p>
    </section>

    <section class="strudel-instruments__section" aria-label="AI tone">
      <h4 class="strudel-instruments__title">AI tone</h4>
      <Input
        v-model="description"
        placeholder="Dry desert fuzz, scooped mids"
        aria-label="Describe the tone"
      />
      <Input
        v-model="apiKey"
        type="password"
        autocomplete="off"
        placeholder="OpenRouter key"
        aria-label="OpenRouter key"
      />
      <p class="strudel-instruments__hint">
        The key is kept only in this browser's local storage, on this device. It is sent to
        OpenRouter and nowhere else.
      </p>
      <span class="strudel-instruments__label">Model</span>
      <Select v-model="model" :options="INSTRUMENT_MODEL_OPTIONS" />

      <div class="strudel-instruments__actions">
        <Button size="sm" :disabled="!canAsk" @click="onAsk">
          {{ assistantBusy ? 'Asking...' : 'Ask' }}
        </Button>
        <Button
          variant="outline"
          size="sm"
          :disabled="apiKey.length === 0"
          @click="store.forgetApiKey"
        >
          Forget key
        </Button>
      </div>
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

.strudel-instruments__actions {
  display: flex;
  gap: var(--spacing-2);
}

.strudel-instruments__error {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-destructive);
}
</style>
