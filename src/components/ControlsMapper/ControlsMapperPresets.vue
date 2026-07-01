<script setup lang="ts">
import { ref } from 'vue'
import { LobbyUIRow, LobbyUIButton } from '@/components/LobbyUI'
import { useControlsMapperStore } from '@/stores/controlsMapper'

const store = useControlsMapperStore()

const fileInput = ref<HTMLInputElement | null>(null)
const error = ref('')

const dateName = (): string => new Date().toLocaleString()

const fileStamp = (): string => new Date().toISOString().replace(/[.:]/g, '-')

const saveCurrent = () => store.savePreset(dateName())

const downloadConfig = () => {
  const json = store.exportCurrent(dateName())
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `controls-config-${fileStamp()}.json`
  link.click()
  URL.revokeObjectURL(url)
}

const importConfig = async (event: Event) => {
  error.value = ''
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    store.importPreset(await file.text())
  } catch {
    error.value = 'Invalid config file'
  } finally {
    if (fileInput.value) fileInput.value.value = ''
  }
}
</script>

<template>
  <div class="mapper-presets">
    <div class="mapper-presets__actions" data-lui-row>
      <LobbyUIButton variant="primary" @click="saveCurrent">Save</LobbyUIButton>
      <LobbyUIButton variant="ghost" @click="fileInput?.click()">Import</LobbyUIButton>
      <LobbyUIButton variant="ghost" @click="downloadConfig">Download</LobbyUIButton>
    </div>

    <LobbyUIRow v-for="preset in store.presets" :key="preset.name" :label="preset.name">
      <LobbyUIButton variant="primary" @click="store.applyPreset(preset.name)">Load</LobbyUIButton>
      <LobbyUIButton variant="ghost" @click="store.deletePreset(preset.name)">Delete</LobbyUIButton>
    </LobbyUIRow>

    <p v-if="error" class="mapper-presets__error">{{ error }}</p>

    <input
      ref="fileInput"
      type="file"
      accept="application/json"
      class="mapper-presets__file"
      @change="importConfig"
    />
  </div>
</template>

<style scoped>
.mapper-presets {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.mapper-presets__actions {
  display: flex;
  gap: var(--spacing-2);
  flex-wrap: wrap;
}

.mapper-presets__error {
  margin: 0;
  font-family: var(--lui-font);
  font-size: var(--lui-text-small);
  color: var(--lui-focus-color);
  text-shadow: var(--lui-text-shadow);
}

.mapper-presets__file {
  display: none;
}
</style>
