<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import GenericPanel from './GenericPanel.vue'
import { Button } from '@/components/ui/button'
import ButtonSelector from '@/components/ui/button-selector/ButtonSelector.vue'
import { useSoundPanelStore } from '@/stores/soundPanel'

// CodeMirror stays out of every game's bundle until the panel is opened.
const StrudelCodeEditor = defineAsyncComponent(
  () => import('@/views/Tools/StrudelEditor/StrudelCodeEditor.vue')
)

const soundStore = useSoundPanelStore()

const selectedId = computed(() => soundStore.selectedId ?? '')
const isRendering = computed(() => soundStore.statusOf(selectedId.value) === 'rendering')
const error = computed(() => soundStore.errorOf(selectedId.value))

const options = computed(() =>
  soundStore.slots.map((slot) => ({
    value: slot.id,
    label: soundStore.isModified(slot.id) ? `${slot.label} (edited)` : slot.label
  }))
)

const statusText = computed(
  () =>
    ({
      idle: '',
      rendering: 'Rendering. The first time also loads the Strudel engine.',
      applied: 'Applied to the game.',
      error: ''
    })[soundStore.statusOf(selectedId.value)]
)
</script>

<template>
  <GenericPanel panel-type="sound" side="right" title="Sound" wide>
    <p v-if="!soundStore.isAvailable" class="sound-panel__empty">
      No sounds registered for this view.
    </p>
    <div v-else class="sound-panel">
      <ButtonSelector
        :model-value="selectedId"
        :options="options"
        @update:model-value="soundStore.select"
      />
      <StrudelCodeEditor
        :code="soundStore.codeOf(selectedId)"
        @update:code="soundStore.setCode(selectedId, $event)"
        @evaluate="soundStore.apply(selectedId)"
      />
      <div class="sound-panel__actions">
        <Button size="sm" :disabled="isRendering" @click="soundStore.apply(selectedId)">
          {{ isRendering ? 'Rendering...' : 'Apply' }}
        </Button>
        <Button
          size="sm"
          variant="outline"
          :disabled="
            !soundStore.isModified(selectedId) && soundStore.statusOf(selectedId) !== 'applied'
          "
          @click="soundStore.reset(selectedId)"
        >
          Reset
        </Button>
        <span class="sound-panel__status">{{ statusText }}</span>
      </div>
      <p v-if="error" class="sound-panel__error" role="alert">{{ error }}</p>
    </div>
  </GenericPanel>
</template>

<style scoped>
.sound-panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  padding: var(--spacing-2);
}

.sound-panel__empty {
  padding: var(--spacing-2);
  font-size: var(--font-size-xs);
  color: var(--color-muted-foreground);
}

.sound-panel__actions {
  display: flex;
  gap: var(--spacing-2);
  align-items: center;
}

.sound-panel__status {
  font-size: var(--font-size-xs);
  color: var(--color-muted-foreground);
}

.sound-panel__error {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-destructive);
}
</style>
