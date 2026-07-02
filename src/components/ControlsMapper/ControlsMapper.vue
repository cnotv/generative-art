<script setup lang="ts">
import { onMounted, onUnmounted, watch, ref, nextTick } from 'vue'
import '@/assets/styles/lobby-ui.scss'
import { createControls } from '@webgamekit/controls'
import type { ControlsExtras } from '@webgamekit/controls'
import { LobbyUIOptionToggle, LobbyUIButton } from '@/components/LobbyUI'
import { useControlsMapperStore } from '@/stores/controlsMapper'
import { useMenuFocus } from '@/composables/useMenuFocus'
import ControlsMapperBindings from './ControlsMapperBindings.vue'
import ControlsMapperStyle from './ControlsMapperStyle.vue'
import ControlsMapperPresets from './ControlsMapperPresets.vue'
import ControlsMapperTester from './ControlsMapperTester.vue'

const store = useControlsMapperStore()

const panelReference = ref<HTMLElement | null>(null)
type MapperTab = 'bindings' | 'test' | 'presets'
const activeTab = ref<MapperTab>('bindings')
const tabOptions = [
  { value: 'bindings', label: 'Bindings' },
  { value: 'test', label: 'Test' },
  { value: 'presets', label: 'Presets' }
]
const setTab = (value: string) => {
  activeTab.value = value as MapperTab
}

const saveCurrent = () => store.savePreset(new Date().toLocaleString())

const { focusedHint, inputSource, focusFirst } = useMenuFocus(panelReference)

const HINT_GAP_PX = 12

let controls: ControlsExtras | null = null

watch(
  () => store.mapping,
  (mapping) => controls?.setMapping(mapping),
  { deep: true }
)

watch(activeTab, async () => {
  await nextTick()
  focusFirst()
})

onMounted(async () => {
  controls = createControls({
    mapping: store.mapping,
    onAction: (action, trigger, device) => store.recordAction(action, trigger, device),
    onRelease: (action) => store.recordRelease(action),
    touch: false,
    mouse: false
  })
  await nextTick()
  focusFirst()
})

onUnmounted(() => {
  controls?.destroyControls()
  controls = null
})
</script>

<template>
  <section ref="panelReference" class="controls-mapper">
    <header class="controls-mapper__header" data-lui-row>
      <h1 class="controls-mapper__title">Controls Mapper</h1>
      <div class="controls-mapper__actions">
        <LobbyUIButton variant="primary" @click="saveCurrent">Save</LobbyUIButton>
        <LobbyUIButton variant="ghost" @click="store.resetToDefaults()">Reset</LobbyUIButton>
      </div>
    </header>

    <div class="controls-mapper__tabs" data-lui-row>
      <LobbyUIOptionToggle
        :model-value="activeTab"
        :options="tabOptions"
        @update:model-value="setTab"
      />
    </div>

    <template v-if="activeTab === 'bindings'">
      <ControlsMapperBindings />
    </template>
    <template v-else-if="activeTab === 'test'">
      <ControlsMapperStyle />
      <ControlsMapperTester />
    </template>
    <template v-else>
      <ControlsMapperPresets />
    </template>

    <div
      v-if="focusedHint && inputSource === 'gamepad'"
      class="controls-mapper__hint"
      aria-hidden="true"
      :style="{
        top: `${focusedHint.rect.top + focusedHint.rect.height / 2}px`,
        left: `${focusedHint.rect.left + focusedHint.rect.width + HINT_GAP_PX}px`
      }"
    >
      <span class="controls-mapper__hint-glyph">✕</span>
      {{ focusedHint.label }}
    </div>
  </section>
</template>

<style scoped>
.controls-mapper {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-6);
  width: 100%;
  max-width: 40rem;
  font-family: var(--lui-font);
  color: var(--lui-text-color);
}

.controls-mapper__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--spacing-3);
  margin-bottom: var(--spacing-4);
}

.controls-mapper__title {
  margin: 0;
  flex: 1 1 auto;
  font-weight: 900;
  font-size: var(--lui-text-important);
  text-shadow: var(--lui-text-shadow);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  line-height: 1;
}

.controls-mapper__actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.controls-mapper__tabs {
  display: flex;
  gap: var(--spacing-2);
}

.controls-mapper__hint {
  position: fixed;
  z-index: var(--z-tooltip, 300);
  transform: translateY(-50%);
  pointer-events: none;
  font-family: var(--lui-font);
  font-size: var(--lui-text-small);
  line-height: 1;
  color: #000;
  background: var(--lui-focus-color);
  padding-inline: 0.7em;
  padding-block: 0.4em;
  border-radius: 999px;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
}

.controls-mapper__hint-glyph {
  font-weight: 900;
}
</style>
