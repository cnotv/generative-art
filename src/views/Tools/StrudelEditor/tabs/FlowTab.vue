<script setup lang="ts">
import { Plus, RotateCcw } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { STRUDEL_FLOW_NODE_DEFINITIONS } from '@webgamekit/strudel-flow'
import type { StrudelFlowNodeCategory, StrudelFlowNodeKind } from '@webgamekit/strudel-flow'

const emit = defineEmits<{
  addNode: [kind: StrudelFlowNodeKind]
  reset: []
}>()

const NODE_CATEGORIES: StrudelFlowNodeCategory[] = ['Instruments', 'Effects', 'Sounds']

const nodeGroups = NODE_CATEGORIES.map((category) => ({
  category,
  definitions: STRUDEL_FLOW_NODE_DEFINITIONS.filter(
    (definition) => definition.category === category
  )
}))
</script>

<template>
  <div class="strudel-flow-tab">
    <h3 class="strudel-flow-tab__heading">flow</h3>
    <p class="strudel-flow-tab__intro">
      Add instrument, effect and sound nodes, connect an output to an input, then press Play. The
      patch writes itself into the code editor on every change, and code you type rebuilds the
      patch. Tempo and beats per cycle sit on top of the canvas.
    </p>

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
