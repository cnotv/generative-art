<script setup lang="ts">
import { computed, ref } from 'vue'
import { Download } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import ButtonSelector from '@/components/ui/button-selector/ButtonSelector.vue'
import { EXPORT_DEFAULT_OPTIONS, EXPORT_SAMPLE_RATE_OPTIONS } from '../config'
import type { StrudelExportOptions, StrudelExportStatus } from '../types'

const props = defineProps<{
  status: StrudelExportStatus
  errorMessage: string
}>()

const emit = defineEmits<{
  export: [exportOptions: StrudelExportOptions]
}>()

const fileName = ref(EXPORT_DEFAULT_OPTIONS.fileName)
const startCycle = ref(EXPORT_DEFAULT_OPTIONS.startCycle)
const endCycle = ref(EXPORT_DEFAULT_OPTIONS.endCycle)
const sampleRate = ref(String(EXPORT_DEFAULT_OPTIONS.sampleRate))

const isRendering = computed(() => props.status === 'rendering')
const hasValidRange = computed(
  () =>
    Number.isFinite(startCycle.value) &&
    Number.isFinite(endCycle.value) &&
    startCycle.value >= 0 &&
    endCycle.value > startCycle.value
)

const readCycle = (value: string | number): number => Math.floor(Number(value))

const onExport = (): void => {
  if (isRendering.value || !hasValidRange.value) {
    return
  }
  emit('export', {
    fileName: fileName.value,
    startCycle: startCycle.value,
    endCycle: endCycle.value,
    sampleRate: Number(sampleRate.value)
  })
}
</script>

<template>
  <section class="strudel-export">
    <p class="strudel-export__intro">
      Render the code on screen offline, faster than real time, and download it as a WAV file.
      Playback stops while it renders.
    </p>
    <label class="strudel-export__field">
      <span class="strudel-export__label">File name</span>
      <Input v-model="fileName" placeholder="Leave empty for a dated name" />
    </label>
    <div class="strudel-export__row">
      <label class="strudel-export__field">
        <span class="strudel-export__label">Start cycle</span>
        <Input
          type="number"
          :min="0"
          :model-value="startCycle"
          @update:model-value="startCycle = readCycle($event)"
        />
      </label>
      <label class="strudel-export__field">
        <span class="strudel-export__label">End cycle</span>
        <Input
          type="number"
          :min="startCycle + 1"
          :model-value="endCycle"
          @update:model-value="endCycle = readCycle($event)"
        />
      </label>
    </div>
    <div class="strudel-export__field">
      <span class="strudel-export__label">Sample rate</span>
      <ButtonSelector v-model="sampleRate" :options="EXPORT_SAMPLE_RATE_OPTIONS" />
    </div>
    <Button
      class="strudel-export__button"
      :disabled="isRendering || !hasValidRange"
      @click="onExport"
    >
      <Download aria-hidden="true" />
      {{ isRendering ? 'Rendering...' : 'Export to WAV' }}
    </Button>
    <p v-if="!hasValidRange" class="strudel-export__error" role="alert">
      The end cycle has to come after the start cycle.
    </p>
    <p v-else-if="status === 'error'" class="strudel-export__error" role="alert">
      {{ errorMessage }}
    </p>
    <p v-else-if="status === 'done'" class="strudel-export__status" role="status">
      The WAV file was downloaded.
    </p>
  </section>
</template>

<style scoped>
.strudel-export {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  padding: var(--spacing-4);
}

.strudel-export__intro,
.strudel-export__status {
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
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-3);
}

.strudel-export__label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-muted-foreground);
}

.strudel-export__button {
  align-self: flex-start;
}

.strudel-export__error {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-destructive);
}
</style>
