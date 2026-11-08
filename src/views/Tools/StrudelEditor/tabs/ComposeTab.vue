<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { STRUDEL_COMPOSER_ACTIONS } from '../ai/config'
import { useAiSettings } from '../ai/useAiSettings'
import { useStrudelComposer } from '../ai/useStrudelComposer'
import type { StrudelComposerAction } from '../ai/types'

// editorError is what the editor reported when the code last failed to run, or empty.
const props = defineProps<{ code: string; editorError: string }>()

const emit = defineEmits<{ apply: [code: string] }>()

const composer = useStrudelComposer()
const { request, autoApply, busyAction, answer, answerApplied, errorMessage } =
  storeToRefs(composer)
const { apiKey } = storeToRefs(useAiSettings())

const applyCode = (code: string): void => emit('apply', code)

// Compose starts from the request alone; revising or reviewing needs code to work on.
const canRun = (action: StrudelComposerAction): boolean =>
  busyAction.value === null &&
  apiKey.value.length > 0 &&
  request.value.trim().length > 0 &&
  (action === 'compose' || props.code.trim().length > 0)

const requestActions = STRUDEL_COMPOSER_ACTIONS.filter(({ id }) => id !== 'fix')

const canFix = computed(
  () =>
    busyAction.value === null &&
    apiKey.value.length > 0 &&
    props.editorError.length > 0 &&
    props.code.trim().length > 0
)

const canApply = computed(
  () => answer.value !== null && answer.value.code.length > 0 && !answerApplied.value
)

const onRun = (action: StrudelComposerAction): void => {
  void composer.run(action, props.code, applyCode)
}

const onFix = (): void => {
  void composer.run('fix', props.code, applyCode, props.editorError)
}
</script>

<template>
  <div class="strudel-compose">
    <Input
      v-model="request"
      placeholder="A slow dub techno piece with a minor chord plan"
      aria-label="What to compose"
    />
    <div class="strudel-compose__actions">
      <Button
        v-for="action in requestActions"
        :key="action.id"
        size="sm"
        :variant="action.id === 'compose' ? 'default' : 'outline'"
        :disabled="!canRun(action.id)"
        :aria-busy="busyAction === action.id"
        @click="onRun(action.id)"
      >
        {{ busyAction === action.id ? `${action.label}...` : action.label }}
      </Button>
    </div>
    <section
      v-if="props.editorError"
      class="strudel-compose__fix"
      aria-label="Fix the error in the editor"
    >
      <p class="strudel-compose__error">The code fails to run: {{ props.editorError }}</p>
      <div class="strudel-compose__actions">
        <Button
          size="sm"
          variant="outline"
          :disabled="!canFix"
          :aria-busy="busyAction === 'fix'"
          @click="onFix"
        >
          {{ busyAction === 'fix' ? 'Fixing...' : 'Fix error' }}
        </Button>
      </div>
    </section>
    <div class="strudel-compose__checkbox">
      <Checkbox id="strudel-compose-auto-apply" v-model="autoApply" />
      <label for="strudel-compose-auto-apply">Auto apply the code to the editor</label>
    </div>
    <p class="strudel-compose__hint">
      Compose writes a new piece, Revise changes the code in the editor, Review only comments on it.
      Ctrl+Z in the editor undoes an applied answer.
    </p>
    <p v-if="apiKey.length === 0" class="strudel-compose__hint">
      Add your OpenRouter key in the Settings tab, where the compose model is picked too.
    </p>

    <p v-if="errorMessage" class="strudel-compose__error" role="alert">{{ errorMessage }}</p>
    <section v-else-if="answer" class="strudel-compose__answer" aria-label="Answer">
      <p v-if="answer.explanation" class="strudel-compose__explanation">
        {{ answer.explanation }}
      </p>
      <template v-if="answer.code">
        <pre
          class="strudel-compose__code"
          aria-label="Answered code"
        ><code>{{ answer.code }}</code></pre>
        <div class="strudel-compose__actions">
          <Button size="sm" :disabled="!canApply" @click="composer.applyAnswer(applyCode)">
            Apply
          </Button>
        </div>
        <p v-if="answerApplied" class="strudel-compose__hint" role="status">
          Applied to the editor.
        </p>
      </template>
    </section>
  </div>
</template>

<style scoped>
.strudel-compose {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.strudel-compose__actions {
  display: flex;
  gap: var(--spacing-2);
}

.strudel-compose__fix {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.strudel-compose__checkbox {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
  cursor: pointer;
}

.strudel-compose__hint,
.strudel-compose__explanation {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-muted-foreground);
}

.strudel-compose__explanation {
  color: var(--color-foreground);
}

.strudel-compose__answer {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.strudel-compose__code {
  margin: 0;
  padding: var(--spacing-2) var(--spacing-3);
  max-height: 20rem;
  overflow: auto;
  font-family: var(--font-mono, monospace);
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
  background: var(--color-muted);
  border-radius: var(--radius-md);
}

.strudel-compose__error {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-destructive);
}
</style>
