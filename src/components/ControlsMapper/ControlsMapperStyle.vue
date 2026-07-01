<script setup lang="ts">
import { computed } from 'vue'
import { CONTROL_SKINS } from '@webgamekit/controls'
import { Button } from '@/components/ui/button'
import TouchControl from '@/components/TouchControl.vue'
import { useControlsMapperStore } from '@/stores/controlsMapper'
import { useGamepadStick } from './useGamepadStick'

const store = useControlsMapperStore()

const { position: stickPosition } = useGamepadStick()

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
    <div class="mapper-style__skins">
      <Button
        v-for="skin in CONTROL_SKINS"
        :key="skin.id"
        :variant="store.selectedSkin === skin.id ? 'default' : 'outline'"
        size="sm"
        :title="`Use the ${skin.label} skin`"
        @click="store.selectSkin(skin.id)"
      >
        {{ skin.label }}
      </Button>
    </div>

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
      Drag the pad, move a gamepad stick, or tap the button to preview and test it.
    </p>
  </div>
</template>

<style scoped>
.mapper-style {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.mapper-style__skins {
  display: flex;
  gap: var(--spacing-2);
  flex-wrap: wrap;
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
  font-size: var(--font-size-base);
  color: var(--color-muted-foreground);
}
</style>
