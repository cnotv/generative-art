<script setup lang="ts">
import { ref } from 'vue'
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from 'radix-vue'
import { Plus, Download, Upload, X } from 'lucide-vue-next'
import { useControlsMapperStore } from '@/stores/controlsMapper'

const store = useControlsMapperStore()

const fileInput = ref<HTMLInputElement | null>(null)
const error = ref('')

const dateName = (): string => new Date().toLocaleString()

const fileStamp = (): string => new Date().toISOString().replace(/[.:]/g, '-')

const saveCurrent = () => {
  store.savePreset(dateName())
}

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
    <DropdownMenuRoot>
      <DropdownMenuTrigger class="mapper-presets__trigger" title="Add, import or download a config">
        <Plus class="mapper-presets__icon" />
        Add
      </DropdownMenuTrigger>

      <DropdownMenuPortal>
        <DropdownMenuContent class="mapper-presets__menu" :side-offset="4" align="start">
          <DropdownMenuItem class="mapper-presets__action" @select="saveCurrent">
            <Plus class="mapper-presets__icon" />
            Save current config
          </DropdownMenuItem>
          <DropdownMenuItem class="mapper-presets__action" @select="fileInput?.click()">
            <Upload class="mapper-presets__icon" />
            Import config
          </DropdownMenuItem>
          <DropdownMenuItem class="mapper-presets__action" @select="downloadConfig">
            <Download class="mapper-presets__icon" />
            Download config
          </DropdownMenuItem>

          <template v-if="store.presets.length">
            <DropdownMenuSeparator class="mapper-presets__separator" />
            <DropdownMenuLabel class="mapper-presets__label">Saved configs</DropdownMenuLabel>
            <DropdownMenuItem
              v-for="preset in store.presets"
              :key="preset.name"
              class="mapper-presets__saved"
              :title="`Import the config from ${preset.name}`"
              @select="store.applyPreset(preset.name)"
            >
              <span class="mapper-presets__saved-date">{{ preset.name }}</span>
              <button
                class="mapper-presets__delete"
                :title="`Delete the config from ${preset.name}`"
                @click.stop="store.deletePreset(preset.name)"
                @pointerdown.stop
              >
                <X class="mapper-presets__icon" />
              </button>
            </DropdownMenuItem>
          </template>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>

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

.mapper-presets__trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-1);
  align-self: flex-start;
  padding: var(--spacing-1) var(--spacing-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background-color: var(--color-background);
  color: var(--color-foreground);
  font-size: var(--font-size-base);
  cursor: pointer;
}

.mapper-presets__trigger:hover {
  background-color: var(--color-accent);
}

.mapper-presets__menu {
  z-index: var(--z-dropdown);
  min-width: 14rem;
  max-height: 20rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  padding: var(--spacing-1);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background-color: var(--color-background);
  color: var(--color-foreground);
  box-shadow: var(--shadow-lg);
}

.mapper-presets__action,
.mapper-presets__saved {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-1) var(--spacing-2);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-base);
  cursor: pointer;
  outline: none;
}

.mapper-presets__action:hover,
.mapper-presets__action[data-highlighted],
.mapper-presets__saved:hover,
.mapper-presets__saved[data-highlighted] {
  background-color: var(--color-accent);
  color: var(--color-accent-foreground);
}

.mapper-presets__saved {
  justify-content: space-between;
}

.mapper-presets__saved-date {
  font-family: var(--font-mono);
}

.mapper-presets__separator {
  height: 1px;
  margin: var(--spacing-1) 0;
  background-color: var(--color-border);
}

.mapper-presets__label {
  padding: var(--spacing-1) var(--spacing-2);
  font-size: var(--font-size-base);
  color: var(--color-muted-foreground);
}

.mapper-presets__delete {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-1);
  border: none;
  background: transparent;
  color: var(--color-muted-foreground);
  cursor: pointer;
  border-radius: var(--radius-sm);
}

.mapper-presets__delete:hover {
  color: var(--color-destructive);
}

.mapper-presets__icon {
  width: 1rem;
  height: 1rem;
}

.mapper-presets__error {
  margin: 0;
  color: var(--color-destructive);
  font-size: var(--font-size-base);
}

.mapper-presets__file {
  display: none;
}
</style>
