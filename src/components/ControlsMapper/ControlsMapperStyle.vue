<script setup lang="ts">
import { computed } from 'vue'
import { CONTROL_SKINS } from '@webgamekit/controls'
import { LobbyUIRow, LobbyUIOptionToggle } from '@/components/LobbyUI'
import TouchControl from '@/components/TouchControl.vue'
import { useControlsMapperStore } from '@/stores/controlsMapper'
import { useGamepadStick } from './useGamepadStick'

const store = useControlsMapperStore()

const { position: stickPosition } = useGamepadStick()

const skinOptions = CONTROL_SKINS.map((skin) => ({ value: skin.id, label: skin.label }))

const fauxPadMapping = computed(() => store.mapping['faux-pad'] ?? {})

const buttonMapping = computed(() => {
  const jumpEntry = Object.entries(store.mapping.keyboard ?? {}).find(
    ([, action]) => action === 'jump'
  )
  return { [jumpEntry?.[0] === ' ' ? 'Space' : (jumpEntry?.[0] ?? 'A')]: 'jump' }
})

const previewAction = (action: string) => store.recordAction(action, 'preview', 'faux-pad')
</script>

<template>
  <div class="mapper-style">
    <LobbyUIRow label="Skin">
      <LobbyUIOptionToggle
        size="sm"
        :model-value="store.selectedSkin"
        :options="skinOptions"
        @update:model-value="store.selectSkin"
      />
    </LobbyUIRow>

    <div class="mapper-style__preview">
      <div class="mapper-style__stage">
        <TouchControl
          :key="`pad-${store.selectedSkin}`"
          inline
          mode="faux-pad"
          :skin="store.selectedSkin"
          :mapping="fauxPadMapping"
          :position="stickPosition"
          :on-action="previewAction"
        />
      </div>
      <div class="mapper-style__stage">
        <TouchControl
          :key="`btn-${store.selectedSkin}`"
          inline
          mode="button"
          :skin="store.selectedSkin"
          :mapping="buttonMapping"
          :on-action="previewAction"
        />
      </div>
    </div>

    <p class="mapper-style__hint">
      Drag the pad, move a gamepad stick, or tap the button to test it.
    </p>
  </div>
</template>

<style scoped>
.mapper-style {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.mapper-style__preview {
  display: flex;
  gap: var(--spacing-6);
  justify-content: center;
}

.mapper-style__stage {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 140px;
  height: 140px;
}

.mapper-style__hint {
  margin: 0;
  text-align: center;
  font-family: var(--lui-font);
  font-size: var(--lui-text-small);
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
}
</style>
