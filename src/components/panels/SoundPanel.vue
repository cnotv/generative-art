<script setup lang="ts">
import { computed, defineAsyncComponent, watch } from 'vue'
import { ExternalLink, Play, Square } from 'lucide-vue-next'
import GenericPanel from './GenericPanel.vue'
import { Button } from '@/components/ui/button'
import ButtonSelector from '@/components/ui/button-selector/ButtonSelector.vue'
import { STRUDEL_FLOW_EDITOR_MODE_OPTIONS } from '@webgamekit/strudel-flow'
import { readStrudelNoteBars } from '@/views/Tools/StrudelEditor/noteBars'
import { useSoundPanelStore } from '@/stores/soundPanel'
import { useSoundFlow } from './useSoundFlow'

// CodeMirror stays out of every game's bundle until the panel is opened.
const StrudelCodeEditor = defineAsyncComponent(
  () => import('@/views/Tools/StrudelEditor/StrudelCodeEditor.vue')
)

// Vue Flow is a large canvas library and only loads when someone opens the flow.
const StrudelFlowEditor = defineAsyncComponent(() =>
  import('@webgamekit/strudel-flow').then((module) => module.StrudelFlowEditor)
)

const soundStore = useSoundPanelStore()

const selectedId = computed(() => soundStore.selectedId ?? '')
const isRendering = computed(() => soundStore.statusOf(selectedId.value) === 'rendering')
const error = computed(() => soundStore.errorOf(selectedId.value))

const soundFlow = useSoundFlow(
  computed(() => soundStore.codeOf(selectedId.value)),
  (code) => soundStore.setCode(selectedId.value, code)
)
watch(selectedId, soundFlow.reload)

const isPlaying = computed(() => soundStore.playingId === selectedId.value)

const resetSound = async (): Promise<void> => {
  await soundStore.reset(selectedId.value)
  soundFlow.reload()
}

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
      <ButtonSelector
        :model-value="soundFlow.mode.value"
        :options="STRUDEL_FLOW_EDITOR_MODE_OPTIONS"
        aria-label="Editor mode"
        @update:model-value="soundFlow.setMode"
      />
      <StrudelCodeEditor
        v-show="soundFlow.mode.value === 'code'"
        :code="soundStore.codeOf(selectedId)"
        @update:code="soundStore.setCode(selectedId, $event)"
        @evaluate="soundStore.apply(selectedId)"
      />
      <div v-if="soundFlow.mode.value === 'flow'" class="sound-panel__flow">
        <StrudelFlowEditor
          v-model:nodes="soundFlow.nodes.value"
          v-model:edges="soundFlow.edges.value"
          :beats-per-minute="soundFlow.beatsPerMinute.value"
          :beats-per-cycle="soundFlow.beatsPerCycle.value"
          :note-reader="readStrudelNoteBars"
          :sample-groups="soundFlow.sampleGroups.value"
          :voice-groups="soundFlow.voiceGroups.value"
          @connect="soundFlow.connectNodes"
          @update-node="soundFlow.updateNodeData"
          @remove-node="soundFlow.removeNode"
          @add-node="soundFlow.addNode"
          @update:beats-per-minute="soundFlow.setBeatsPerMinute"
          @update:beats-per-cycle="soundFlow.setBeatsPerCycle"
        />
      </div>
      <p v-if="soundFlow.flowError.value" class="sound-panel__error" role="alert">
        {{ soundFlow.flowError.value }}
      </p>
      <div class="sound-panel__actions">
        <Button
          size="sm"
          variant="outline"
          :disabled="isRendering"
          @click="soundStore.togglePreview(selectedId)"
        >
          <Square v-if="isPlaying" class="sound-panel__icon" aria-hidden="true" />
          <Play v-else class="sound-panel__icon" aria-hidden="true" />
          {{ isPlaying ? 'Stop' : 'Play' }}
        </Button>
        <Button size="sm" :disabled="isRendering" @click="soundStore.apply(selectedId)">
          {{ isRendering ? 'Rendering...' : 'Apply' }}
        </Button>
        <Button
          size="sm"
          variant="outline"
          :disabled="
            !soundStore.isModified(selectedId) && soundStore.statusOf(selectedId) !== 'applied'
          "
          @click="resetSound"
        >
          Reset
        </Button>
        <Button size="sm" variant="outline" @click="soundStore.openEditor(selectedId)">
          <ExternalLink class="sound-panel__icon" aria-hidden="true" />
          Open in Strudel Editor
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

.sound-panel__flow {
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  grid-template-columns: minmax(0, 1fr);
  height: 60dvh;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.sound-panel__icon {
  width: 1em;
  height: 1em;
}

.sound-panel__actions {
  flex-wrap: wrap;
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
