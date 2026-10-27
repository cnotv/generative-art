<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import ButtonSelector from '@/components/ui/button-selector/ButtonSelector.vue'
import {
  STRUDEL_EXPORT_DEFAULT_FILE_NAME,
  STRUDEL_EXPORT_FORMAT_OPTIONS,
  STRUDEL_EXPORT_SAMPLE_RATE_OPTIONS
} from '../config'
import type { StrudelExportFormat, StrudelExportRequest, StrudelExportStatus } from '../types'

defineProps<{
  status: StrudelExportStatus
  errorMessage: string
}>()

const emit = defineEmits<{
  export: [request: StrudelExportRequest]
}>()

const format = ref<StrudelExportFormat>('wav')
const fileName = ref('')
const beginCycle = ref(0)
const endCycle = ref(4)
const sampleRate = ref('48000')

const hasValidCycles = computed(
  () => Number.isFinite(beginCycle.value) && endCycle.value > beginCycle.value
)

const onFormatChange = (nextFormat: string): void => {
  format.value = nextFormat === 'midi' ? 'midi' : 'wav'
}

const onExport = (): void => {
  emit('export', {
    format: format.value,
    beginCycle: beginCycle.value,
    endCycle: endCycle.value,
    sampleRate: Number(sampleRate.value),
    fileName: fileName.value.trim() || STRUDEL_EXPORT_DEFAULT_FILE_NAME
  })
}
</script>

<template>
  <div class="strudel-export">
    <p class="strudel-export__intro">
      WAV is the sound as it plays. MIDI is its notes, for a DAW or a synth; drum samples become
      General MIDI drums, other samples are left out.
    </p>
    <div class="strudel-export__field" role="group" aria-label="Format">
      <ButtonSelector
        :model-value="format"
        :options="STRUDEL_EXPORT_FORMAT_OPTIONS"
        @update:model-value="onFormatChange"
      />
    </div>
    <div class="strudel-export__field">
      <label class="strudel-export__label" for="export-filename">File name</label>
      <Input
        id="export-filename"
        v-model="fileName"
        :placeholder="STRUDEL_EXPORT_DEFAULT_FILE_NAME"
      />
    </div>
    <div class="strudel-export__row">
      <div class="strudel-export__field">
        <label class="strudel-export__label" for="export-start">Start cycle</label>
        <Input
          id="export-start"
          type="number"
          :step="1"
          :model-value="beginCycle"
          @update:model-value="beginCycle = Number($event)"
        />
      </div>
      <div class="strudel-export__field">
        <label class="strudel-export__label" for="export-end">End cycle</label>
        <Input
          id="export-end"
          type="number"
          :step="1"
          :model-value="endCycle"
          @update:model-value="endCycle = Number($event)"
        />
      </div>
    </div>
    <div
      v-if="format === 'wav'"
      class="strudel-export__field"
      role="group"
      aria-label="Sample rate"
    >
      <ButtonSelector v-model="sampleRate" :options="STRUDEL_EXPORT_SAMPLE_RATE_OPTIONS" />
    </div>
    <Button size="sm" :disabled="status === 'exporting' || !hasValidCycles" @click="onExport">
      {{ status === 'exporting' ? 'Exporting...' : `Export ${format === 'midi' ? 'MIDI' : 'WAV'}` }}
    </Button>
    <p v-if="status === 'error'" class="strudel-export__error" role="alert">{{ errorMessage }}</p>
  </div>
</template>

<style scoped>
.strudel-export {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  padding: var(--spacing-4);
}

.strudel-export__intro {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-muted-foreground);
}

.strudel-export__field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.strudel-export__row {
  display: flex;
  gap: var(--spacing-3);
}

.strudel-export__row .strudel-export__field {
  flex: 1;
}

.strudel-export__label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-muted-foreground);
}

.strudel-export__error {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-destructive);
}
</style>
