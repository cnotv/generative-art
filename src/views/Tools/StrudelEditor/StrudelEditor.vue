<script setup lang="ts">
import { onUnmounted } from 'vue'
import Button from '@/components/ui/button/Button.vue'
import { Select } from '@/components/ui/select'
import { STRUDEL_LICENSE_NOTE } from './config'
import { useStrudelEditor } from './useStrudelEditor'

const {
  selectedExampleId,
  patternCode,
  editorStatus,
  errorMessage,
  exampleOptions,
  selectExample,
  updatePatternCode,
  playPattern,
  stopPattern
} = useStrudelEditor()

const onExampleSelected = (exampleId: string): void => {
  selectExample(exampleId)
}

const onCodeInput = (inputEvent: Event): void => {
  const textArea = inputEvent.target as HTMLTextAreaElement | null
  if (textArea === null) {
    return
  }
  updatePatternCode(textArea.value)
}

const onPlayRequested = (): void => {
  void playPattern()
}

const onStopRequested = (): void => {
  void stopPattern()
}

onUnmounted(() => {
  void stopPattern()
})
</script>

<template>
  <div class="strudel-editor">
    <div class="strudel-editor__toolbar">
      <label class="strudel-editor__label" for="strudel-example">Example pattern</label>
      <Select
        :model-value="selectedExampleId"
        :options="exampleOptions"
        placeholder="Choose a pattern"
        @update:model-value="onExampleSelected"
      />
      <div class="strudel-editor__actions">
        <Button :disabled="editorStatus === 'playing'" @click="onPlayRequested">Play</Button>
        <Button variant="outline" :disabled="editorStatus !== 'playing'" @click="onStopRequested">
          Stop
        </Button>
      </div>
    </div>

    <label class="strudel-editor__label" for="strudel-code">Live code pattern</label>
    <textarea
      id="strudel-code"
      class="strudel-editor__code"
      :value="patternCode"
      spellcheck="false"
      rows="6"
      @input="onCodeInput"
    />

    <p class="strudel-editor__status" role="status">
      <template v-if="editorStatus === 'playing'">Playing the current pattern.</template>
      <template v-else-if="editorStatus === 'error'">
        {{ errorMessage || 'Pattern failed to evaluate.' }}
      </template>
      <template v-else>Idle. Choose a pattern and press Play.</template>
    </p>
    <p class="strudel-editor__license">{{ STRUDEL_LICENSE_NOTE }}</p>
  </div>
</template>

<style scoped>
.strudel-editor {
  padding-top: var(--nav-height);
  min-height: 100vh;
  max-width: 56rem;
  margin: 0 auto;
  padding-inline: var(--spacing-4);
  padding-bottom: var(--spacing-10);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
}

.strudel-editor__toolbar {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  padding: var(--spacing-4);
  background: var(--color-secondary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
}

.strudel-editor__actions {
  display: flex;
  gap: var(--spacing-2);
  flex-wrap: wrap;
}

.strudel-editor__label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-muted-foreground);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.strudel-editor__code {
  width: 100%;
  box-sizing: border-box;
  min-height: 10rem;
  padding: var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  color: var(--color-foreground);
  font-family: var(--font-mono);
  font-size: var(--font-size-md);
  line-height: 1.5;
  resize: vertical;
}

.strudel-editor__status {
  font-size: var(--font-size-md);
  color: var(--color-muted-foreground);
  margin: 0;
}

.strudel-editor__license {
  font-size: var(--font-size-sm);
  color: var(--color-muted-foreground);
  margin: 0;
}
</style>
