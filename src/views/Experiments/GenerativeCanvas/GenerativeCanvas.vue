<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Button } from '@/components/ui'
import ButtonSelector from '@/components/ui/button-selector/ButtonSelector.vue'
import { COMPONENT_EXAMPLES, INITIAL_CANVAS_STATE } from './config'
import { useComponentFrame } from './useComponentFrame'

const frameElement = ref<HTMLIFrameElement | null>(null)
const { state, status, lastError, frameDocument, mount } = useComponentFrame(
  frameElement,
  INITIAL_CANVAS_STATE
)

const selectedExampleId = ref(COMPONENT_EXAMPLES[0].id)
const exampleOptions = COMPONENT_EXAMPLES.map(({ id, label }) => ({ value: id, label }))
const selectedSource = computed(
  () => COMPONENT_EXAMPLES.find((example) => example.id === selectedExampleId.value)?.source ?? ''
)

const selectExample = (exampleId: string): void => {
  selectedExampleId.value = exampleId
  mount(selectedSource.value)
}

const incrementFromHost = (): void => {
  state.value = { ...state.value, count: Number(state.value.count) + 1 }
}

onMounted(() => mount(selectedSource.value))
</script>

<template>
  <div class="generative-canvas">
    <header class="generative-canvas__header">
      <h1 class="generative-canvas__title">Generative Canvas</h1>
      <p class="generative-canvas__description">
        Each component is compiled here and mounted in a sandboxed frame. The count lives in this
        page, so it survives every swap.
      </p>
    </header>

    <section class="generative-canvas__controls" aria-label="Component and host state">
      <ButtonSelector
        :model-value="selectedExampleId"
        :options="exampleOptions"
        @update:model-value="selectExample"
      />
      <p class="generative-canvas__state" data-testid="host-count">
        Host count: <strong>{{ state.count }}</strong>
      </p>
      <Button variant="secondary" @click="incrementFromHost">Add one from the host</Button>
      <p class="generative-canvas__status" data-testid="frame-status">Frame: {{ status }}</p>
      <pre v-if="lastError" class="generative-canvas__error" role="alert">{{ lastError }}</pre>
    </section>

    <iframe
      ref="frameElement"
      class="generative-canvas__frame"
      title="Generated component"
      sandbox="allow-scripts"
      :srcdoc="frameDocument"
    />

    <pre class="generative-canvas__source" aria-label="Component source">{{ selectedSource }}</pre>
  </div>
</template>

<style scoped>
.generative-canvas {
  box-sizing: border-box;
  height: 100vh;

  /* body is globally overflow:hidden, so the page scrolls in here. */
  overflow-y: auto;
  display: grid;
  grid-template:
    'header header' auto
    'controls frame' auto
    'source frame' 1fr / minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--spacing-6);
  padding: calc(var(--nav-height) + var(--spacing-8)) var(--spacing-8) var(--spacing-8);
  color: var(--color-primary);
}

.generative-canvas__header {
  grid-area: header;
}

.generative-canvas__title {
  font-size: var(--font-size-xl);
  font-weight: 700;
  margin-bottom: var(--spacing-2);
}

.generative-canvas__description {
  color: var(--color-muted-foreground);
}

.generative-canvas__controls {
  grid-area: controls;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-3);
}

.generative-canvas__state,
.generative-canvas__status {
  font-size: var(--font-size-base);
}

.generative-canvas__status {
  color: var(--color-muted-foreground);
}

.generative-canvas__error {
  white-space: pre-wrap;
  color: var(--color-destructive);
  font-size: var(--font-size-sm);
}

.generative-canvas__frame {
  grid-area: frame;
  width: 100%;
  min-height: var(--generative-canvas-frame-height);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-background);
}

.generative-canvas__source {
  grid-area: source;
  overflow: auto;
  margin: 0;
  padding: var(--spacing-4);
  border-radius: var(--radius-lg);
  background: var(--color-muted);
  font-size: var(--font-size-sm);
}

@media (width <= 768px) {
  .generative-canvas {
    grid-template:
      'header' auto
      'controls' auto
      'frame' auto
      'source' auto / minmax(0, 1fr);
    padding-inline: var(--spacing-4);
  }
}
</style>
