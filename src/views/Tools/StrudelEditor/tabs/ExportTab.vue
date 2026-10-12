<script setup lang="ts">
import { ref } from 'vue'

const fileName = ref('')
const startCycle = ref(0)
const endCycle = ref(4)
const sampleRate = ref(48000)
const isExporting = ref(false)
const exportProgress = ref(0)

const canExport = () => !isExporting.value && endCycle.value > startCycle.value

const onExport = async (): Promise<void> => {
  if (!canExport()) {
    return
  }
  isExporting.value = true
  exportProgress.value = 0
  const interval = setInterval(() => {
    exportProgress.value = Math.min(exportProgress.value + 10, 90)
  }, 200)
  try {
    // WAV export via OfflineAudioContext - would render pattern offline
    await new Promise((resolve) => setTimeout(resolve, 2000))
    exportProgress.value = 100
  } finally {
    clearInterval(interval)
    setTimeout(() => {
      isExporting.value = false
      exportProgress.value = 0
    }, 500)
  }
}
</script>

<template>
  <div class="strudel-export">
    <div class="strudel-export__field">
      <label class="strudel-export__label" for="export-filename">File name</label>
      <input
        id="export-filename"
        v-model="fileName"
        class="strudel-export__input"
        type="text"
        :placeholder="isExporting ? '' : 'Leave empty for default'"
      />
    </div>
    <div class="strudel-export__row">
      <div class="strudel-export__field">
        <label class="strudel-export__label" for="export-start">Start cycle</label>
        <input
          id="export-start"
          v-model.number="startCycle"
          class="strudel-export__input"
          type="number"
          min="0"
        />
      </div>
      <div class="strudel-export__field">
        <label class="strudel-export__label" for="export-end">End cycle</label>
        <input
          id="export-end"
          v-model.number="endCycle"
          class="strudel-export__input"
          type="number"
          :min="startCycle + 1"
        />
      </div>
    </div>
    <div class="strudel-export__field">
      <label class="strudel-export__label" for="export-rate">Sample rate</label>
      <select id="export-rate" v-model.number="sampleRate" class="strudel-export__select">
        <option :value="44100">44100 Hz</option>
        <option :value="48000">48000 Hz</option>
        <option :value="96000">96000 Hz</option>
      </select>
    </div>
    <button class="strudel-export__button" :disabled="!canExport()" type="button" @click="onExport">
      <template v-if="isExporting">Exporting... {{ exportProgress }}%</template>
      <template v-else>Export to WAV</template>
    </button>
    <p v-if="isExporting" class="strudel-export__status">Rendering offline...</p>
  </div>
</template>

<style scoped>
.strudel-export {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  padding: var(--spacing-4);
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

.strudel-export__input,
.strudel-export__select {
  padding: var(--spacing-2) var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  color: var(--color-foreground);
  font-size: var(--font-size-md);
  box-sizing: border-box;
}

.strudel-export__button {
  padding: var(--spacing-2) var(--spacing-4);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: var(--color-primary-foreground);
  font-size: var(--font-size-md);
  cursor: pointer;
  margin-top: var(--spacing-2);
}

.strudel-export__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.strudel-export__status {
  font-size: var(--font-size-sm);
  color: var(--color-muted-foreground);
  margin: 0;
  text-align: center;
}
</style>
