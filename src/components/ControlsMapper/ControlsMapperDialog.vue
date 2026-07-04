<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'
import '@/assets/styles/lobby-ui.scss'
import { LobbyUIOptionToggle, LobbyUIButton, LobbyUIFocusHint } from '@/components/LobbyUI'
import { useControlsMapperStore } from '@/stores/controlsMapper'
import { useMenuFocus } from '@/composables/useMenuFocus'
import ControlsMapperBindings from './ControlsMapperBindings.vue'
import ControlsMapperStyle from './ControlsMapperStyle.vue'
import ControlsMapperPresets from './ControlsMapperPresets.vue'
import type { MapperActionConfig } from './config'
import type { ControlMapping } from '@webgamekit/controls'

const props = defineProps<{
  gameId: string
  actions: MapperActionConfig[]
  defaultMapping?: ControlMapping
  title?: string
}>()
const emit = defineEmits<{ close: [] }>()

const store = useControlsMapperStore(props.gameId, props.defaultMapping)
const panelReference = ref<HTMLElement | null>(null)

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

const { focusedHint, inputSource, focusFirst } = useMenuFocus(panelReference, () => store.capturing)

onMounted(async () => {
  await nextTick()
  focusFirst()
})
</script>

<template>
  <div class="controls-dialog__backdrop" @click.self="emit('close')">
    <section ref="panelReference" class="controls-dialog" role="dialog" aria-modal="true">
      <header class="controls-dialog__header" data-lui-row>
        <h2 class="controls-dialog__title">{{ title ?? 'Controls' }}</h2>
        <div class="controls-dialog__actions">
          <LobbyUIButton variant="ghost" @click="store.resetToDefaults()">Reset</LobbyUIButton>
          <LobbyUIButton variant="primary" @click="emit('close')">Done</LobbyUIButton>
        </div>
      </header>

      <div class="controls-dialog__tabs" data-lui-row>
        <LobbyUIOptionToggle
          :model-value="activeTab"
          :options="tabOptions"
          @update:model-value="setTab"
        />
      </div>

      <ControlsMapperBindings
        v-if="activeTab === 'bindings'"
        :game-id="gameId"
        :actions="actions"
      />
      <ControlsMapperStyle v-else-if="activeTab === 'style'" :game-id="gameId" />
      <ControlsMapperPresets v-else :game-id="gameId" />

      <LobbyUIFocusHint :hint="focusedHint" :visible="inputSource === 'gamepad'" />
    </section>
  </div>
</template>

<style scoped>
.controls-dialog__backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal, 200);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-4);
  background: rgb(0 0 0 / 0.6);
}

.controls-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-5);
  width: min(90vw, 32rem);
  max-height: 85vh;
  overflow-y: auto;
  padding: var(--spacing-5) var(--spacing-6);
  border-radius: var(--radius-lg);
  background: linear-gradient(160deg, #3a2c6e 0%, #5b3f8f 100%);
  font-family: var(--lui-font);
  color: var(--lui-text-color);
}

.controls-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--spacing-3);
}

.controls-dialog__title {
  margin: 0;
  flex: 1 1 auto;
  font-weight: 900;
  font-size: var(--lui-text-important);
  text-shadow: var(--lui-text-shadow);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  line-height: 1;
}

.controls-dialog__actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.controls-dialog__tabs {
  display: flex;
  gap: var(--spacing-2);
}
</style>
