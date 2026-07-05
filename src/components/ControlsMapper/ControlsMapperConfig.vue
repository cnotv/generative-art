<script setup lang="ts">
import { ref } from 'vue'
import '@/assets/styles/lobby-ui.scss'
import { LobbyUIOptionToggle, LobbyUIButton } from '@/components/LobbyUI'
import { useControlsMapperStore } from '@/stores/controlsMapper'
import ControlsMapperBindings from './ControlsMapperBindings.vue'
import ControlsMapperStyle from './ControlsMapperStyle.vue'
import ControlsMapperPresets from './ControlsMapperPresets.vue'
import type { MapperActionConfig } from './types'
import type { ControlMapping } from '@webgamekit/controls'

const props = defineProps<{
  gameId: string
  actions: MapperActionConfig[]
  defaultMapping?: ControlMapping
}>()

const store = useControlsMapperStore(props.gameId, props.defaultMapping)

type Tab = 'bindings' | 'style' | 'presets'
const activeTab = ref<Tab>('bindings')
const tabOptions = [
  { value: 'bindings', label: 'Bindings' },
  { value: 'style', label: 'Style' },
  { value: 'presets', label: 'Presets' }
]
const setTab = (value: string) => {
  activeTab.value = value as Tab
}
</script>

<template>
  <div class="controls-config">
    <div class="controls-config__tabs" data-lui-row>
      <LobbyUIOptionToggle
        :model-value="activeTab"
        :options="tabOptions"
        @update:model-value="setTab"
      />
    </div>

    <ControlsMapperBindings v-if="activeTab === 'bindings'" :game-id="gameId" :actions="actions" />
    <ControlsMapperStyle v-else-if="activeTab === 'style'" :game-id="gameId" />
    <ControlsMapperPresets v-else :game-id="gameId" />

    <div class="controls-config__footer" data-lui-row>
      <LobbyUIButton variant="ghost" @click="store.resetToDefaults()">Reset</LobbyUIButton>
    </div>
  </div>
</template>

<style scoped>
.controls-config {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-5);
}

.controls-config__tabs {
  display: flex;
  gap: var(--spacing-2);
}

.controls-config__footer {
  display: flex;
  justify-content: flex-end;
}
</style>
