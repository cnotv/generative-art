<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Plus, RotateCcw } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  STRUDEL_FLOW_MAX_BEATS_PER_MINUTE,
  STRUDEL_FLOW_MIN_BEATS_PER_MINUTE
} from '@webgamekit/strudel-flow'
import { STRUDEL_FLOW_NODE_DEFINITIONS } from '@webgamekit/strudel-flow'
import { normalizeStrudelFlowBeatsPerMinute } from '@webgamekit/strudel-flow'
import type { StrudelFlowNodeKind } from '@webgamekit/strudel-flow'

const props = defineProps<{
  beatsPerMinute: number
}>()

const emit = defineEmits<{
  addNode: [kind: StrudelFlowNodeKind]
  'update:beatsPerMinute': [beatsPerMinute: number]
  reset: []
}>()

const NODE_CATEGORIES = ['Instruments', 'Effects'] as const

const nodeGroups = computed(() =>
  NODE_CATEGORIES.map((category) => ({
    category,
    definitions: STRUDEL_FLOW_NODE_DEFINITIONS.filter(
      (definition) => definition.category === category
    )
  }))
)

const tempoDraft = ref(String(props.beatsPerMinute))

watch(
  () => props.beatsPerMinute,
  (beatsPerMinute) => {
    tempoDraft.value = String(beatsPerMinute)
  }
)

const onTempoInput = (value: string | number): void => {
  tempoDraft.value = String(value)
  const parsedValue = Number(value)
  if (
    String(value).trim().length > 0 &&
    Number.isFinite(parsedValue) &&
    parsedValue >= STRUDEL_FLOW_MIN_BEATS_PER_MINUTE &&
    parsedValue <= STRUDEL_FLOW_MAX_BEATS_PER_MINUTE
  ) {
    emit('update:beatsPerMinute', parsedValue)
  }
}

const commitTempo = (): void => {
  const parsedValue = Number(tempoDraft.value)
  if (tempoDraft.value.trim().length === 0 || !Number.isFinite(parsedValue)) {
    tempoDraft.value = String(props.beatsPerMinute)
    return
  }
  const normalizedTempo = normalizeStrudelFlowBeatsPerMinute(parsedValue)
  tempoDraft.value = String(normalizedTempo)
  if (normalizedTempo !== props.beatsPerMinute) {
    emit('update:beatsPerMinute', normalizedTempo)
  }
}
</script>

<template>
  <div class="strudel-flow-tab">
    <h3 class="strudel-flow-tab__heading">flow</h3>
    <p class="strudel-flow-tab__intro">
      Add instrument and effect nodes, connect an output to an effect input, then press Play. The
      patch writes itself into the code editor on every change.
    </p>

    <div class="strudel-flow-tab__tempo">
      <label class="strudel-flow-tab__tempo-label" for="strudel-flow-tempo"> Tempo (BPM) </label>
      <Input
        id="strudel-flow-tempo"
        type="number"
        :step="1"
        :model-value="tempoDraft"
        aria-label="Beats per minute"
        @update:model-value="onTempoInput"
        @blur="commitTempo"
        @keydown.enter="commitTempo"
      />
    </div>

    <section
      v-for="group in nodeGroups"
      :key="group.category"
      class="strudel-flow-tab__group"
      :aria-labelledby="`strudel-flow-palette-${group.category}`"
    >
      <h4 :id="`strudel-flow-palette-${group.category}`" class="strudel-flow-tab__group-title">
        {{ group.category }}
      </h4>
      <ul class="strudel-flow-tab__list">
        <li
          v-for="definition in group.definitions"
          :key="definition.kind"
          class="strudel-flow-tab__item"
        >
          <div class="strudel-flow-tab__item-text">
            <p class="strudel-flow-tab__item-title">{{ definition.title }}</p>
            <p class="strudel-flow-tab__item-description">{{ definition.description }}</p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            :aria-label="`Add ${definition.title} node`"
            @click="emit('addNode', definition.kind)"
          >
            <Plus aria-hidden="true" />
            Add
          </Button>
        </li>
      </ul>
    </section>

    <Button class="strudel-flow-tab__reset" variant="outline" @click="emit('reset')">
      <RotateCcw aria-hidden="true" />
      Reset patch
    </Button>
  </div>
</template>

<style scoped>
.strudel-flow-tab {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  padding: var(--spacing-4);
  font-size: var(--font-size-sm);
}

.strudel-flow-tab__heading {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 700;
}

.strudel-flow-tab__intro {
  margin: 0;
  color: var(--color-muted-foreground);
}

.strudel-flow-tab__tempo {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 6rem;
  align-items: center;
  gap: var(--spacing-2);
}

.strudel-flow-tab__tempo-label {
  color: var(--color-muted-foreground);
  font-weight: 600;
}

.strudel-flow-tab__group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.strudel-flow-tab__group-title {
  margin: 0;
  color: var(--color-muted-foreground);
  font-size: var(--font-size-sm);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.strudel-flow-tab__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.strudel-flow-tab__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-3);
  padding: var(--spacing-2) var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.strudel-flow-tab__item-text {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-0-5);
  min-width: 0;
}

.strudel-flow-tab__item-title,
.strudel-flow-tab__item-description {
  margin: 0;
}

.strudel-flow-tab__item-title {
  font-weight: 600;
}

.strudel-flow-tab__item-description {
  color: var(--color-muted-foreground);
}

.strudel-flow-tab__reset {
  align-self: flex-start;
}
</style>
