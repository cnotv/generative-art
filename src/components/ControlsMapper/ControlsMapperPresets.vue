<script setup lang="ts">
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useControlsMapperStore } from '@/stores/controlsMapper'

const store = useControlsMapperStore()

const presetName = ref('')
const importText = ref('')
const exportText = ref('')
const importError = ref('')

const save = () => {
  const name = presetName.value.trim()
  if (!name) return
  store.savePreset(name)
  presetName.value = ''
}

const exportCurrent = () => {
  exportText.value = store.exportCurrent(presetName.value.trim() || 'preset')
}

const importPreset = () => {
  importError.value = ''
  try {
    store.importPreset(importText.value)
    importText.value = ''
  } catch {
    importError.value = 'Invalid preset JSON'
  }
}
</script>

<template>
  <div class="mapper-presets">
    <div class="mapper-presets__row">
      <Input v-model="presetName" placeholder="Preset name" class="mapper-presets__name" />
      <Button size="sm" title="Save the current mapping and skin as a preset" @click="save">
        Save
      </Button>
      <Button
        variant="ghost"
        size="sm"
        title="Reset to the default mapping"
        @click="store.resetMapping()"
      >
        Reset
      </Button>
    </div>

    <ul v-if="store.presets.length" class="mapper-presets__list">
      <li v-for="preset in store.presets" :key="preset.name" class="mapper-presets__item">
        <span class="mapper-presets__item-name">{{ preset.name }}</span>
        <Button
          variant="outline"
          size="sm"
          :title="`Apply the ${preset.name} preset`"
          @click="store.applyPreset(preset.name)"
        >
          Apply
        </Button>
        <Button
          variant="ghost"
          size="sm"
          :title="`Delete the ${preset.name} preset`"
          @click="store.deletePreset(preset.name)"
        >
          Delete
        </Button>
      </li>
    </ul>

    <div class="mapper-presets__io">
      <Button
        variant="outline"
        size="sm"
        title="Export the current mapping as JSON"
        @click="exportCurrent"
      >
        Export JSON
      </Button>
      <textarea
        v-model="exportText"
        class="mapper-presets__json"
        readonly
        placeholder="Exported JSON appears here"
      ></textarea>
    </div>

    <div class="mapper-presets__io">
      <textarea
        v-model="importText"
        class="mapper-presets__json"
        placeholder="Paste preset JSON to import"
      ></textarea>
      <Button variant="outline" size="sm" title="Import a mapping from JSON" @click="importPreset">
        Import JSON
      </Button>
      <p v-if="importError" class="mapper-presets__error">{{ importError }}</p>
    </div>
  </div>
</template>

<style scoped>
.mapper-presets {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.mapper-presets__row {
  display: flex;
  gap: var(--spacing-2);
  align-items: center;
}

.mapper-presets__name {
  flex: 1;
}

.mapper-presets__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.mapper-presets__item {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: var(--spacing-2);
}

.mapper-presets__io {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.mapper-presets__json {
  width: 100%;
  min-height: 4rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-input);
  background-color: var(--color-background);
  color: var(--color-foreground);
  padding: var(--spacing-2);
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  resize: vertical;
}

.mapper-presets__error {
  margin: 0;
  color: var(--color-destructive);
  font-size: var(--font-size-sm);
}
</style>
