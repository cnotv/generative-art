<script setup lang="ts">
import { ref } from 'vue'
import { Upload, Download, X } from 'lucide-vue-next'
import { LobbyUIRow, LobbyUIButton, LobbyUIIconButton } from '@/components/LobbyUI'
import { useControlsMapperStore } from '@/stores/controlsMapper'

const props = defineProps<{ gameId?: string }>()

const store = useControlsMapperStore(props.gameId)

const fileInput = ref<HTMLInputElement | null>(null)
const error = ref('')

const dateName = (): string => new Date().toLocaleString()

const fileStamp = (): string => new Date().toISOString().replace(/[.:]/g, '-')

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
    <div class="mapper-presets__list" data-lui-row>
      <LobbyUIButton variant="ghost" title="Import a config file" @click="fileInput?.click()">
        <Upload class="mapper-presets__icon" />
        Import
      </LobbyUIButton>
      <LobbyUIButton variant="ghost" title="Download the current config" @click="downloadConfig">
        <Download class="mapper-presets__icon" />
        Download
      </LobbyUIButton>
    </div>

    <div
      v-for="preset in store.presets"
      :key="preset.name"
      class="mapper-presets__saved"
      data-lui-row
    >
      <LobbyUIButton
        variant="ghost"
        size="sm"
        class="mapper-presets__load"
        :title="`Load ${preset.name}`"
        @click="store.applyPreset(preset.name)"
      >
        {{ preset.name }}
      </LobbyUIButton>
      <LobbyUIIconButton
        variant="ghost"
        size="sm"
        :title="`Delete ${preset.name}`"
        @click="store.deletePreset(preset.name)"
      >
        <X class="mapper-presets__icon" />
      </LobbyUIIconButton>
    </div>

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
  gap: var(--spacing-2);
}

.mapper-presets__list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-2);
}

.mapper-presets__saved {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-2);
}

.mapper-presets__load {
  min-width: 0;
  text-align: left;
}

.mapper-presets__icon {
  width: 1.2em;
  height: 1.2em;
  transform: translateY(0.12em);
  filter: drop-shadow(2px 2px 0 #000);
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
