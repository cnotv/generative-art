<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { STRUDEL_COMPOSER_ACTIONS, STRUDEL_COMPOSER_INSTRUMENT_STATUS_LABELS } from '../ai/config'
import { INSTRUMENT_KINDS } from '../instruments/config'
import { useAiSettings } from '../ai/useAiSettings'
import { useStrudelComposer } from '../ai/useStrudelComposer'
import type { StrudelComposerAction } from '../ai/types'

// editorError is what the editor reported when the code last failed to run, or empty.
const props = defineProps<{ code: string; editorError: string }>()

const emit = defineEmits<{ apply: [code: string] }>()

const composer = useStrudelComposer()
const {
  request,
  autoApply,
  designInstruments,
  busyAction,
  answer,
  answerApplied,
  instrumentResults,
  applying,
  errorMessage
} = storeToRefs(composer)
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

// Applying again is allowed, so a later edit in the editor can be put back to the answer.
const canApply = computed(
  () => answer.value !== null && answer.value.code.length > 0 && !applying.value
)

// Before Apply an instrument has no result yet; a failure says why.
const instrumentRows = computed(() =>
  (answer.value?.instruments ?? []).map((instrument, index) => {
    const result = instrumentResults.value[index]
    const statusLabel =
      result === undefined
        ? STRUDEL_COMPOSER_INSTRUMENT_STATUS_LABELS.pending
        : STRUDEL_COMPOSER_INSTRUMENT_STATUS_LABELS[result.status]
    return {
      ...instrument,
      kindLabel: INSTRUMENT_KINDS[instrument.kind].label,
      statusLabel: result?.message ? `${statusLabel}: ${result.message}` : statusLabel,
      failed: result?.status === 'failed'
    }
  })
)

const onRun = (action: StrudelComposerAction): void => {
  void composer.run(action, props.code, applyCode)
}

const onApply = (): void => {
  void composer.applyAnswer(applyCode)
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
      <label
        for="strudel-compose-auto-apply"
        title="Write the answer into the editor as soon as it arrives"
        >Auto apply</label
      >
    </div>
    <div class="strudel-compose__checkbox">
      <Checkbox id="strudel-compose-design-instruments" v-model="designInstruments" />
      <label
        for="strudel-compose-design-instruments"
        title="Let the Sound model design new instruments for the piece"
        >Instruments</label
      >
    </div>
    <Accordion>
      <AccordionItem value="about">
        <AccordionTrigger>About composing</AccordionTrigger>
        <AccordionContent>
          <p class="strudel-compose__hint">
            Compose writes a new piece, Revise changes the code in the editor, Review only comments
            on it. Ctrl+Z in the editor undoes an applied answer.
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
    <p v-if="apiKey.length === 0" class="strudel-compose__hint">
      Add an OpenRouter key in Settings.
    </p>

    <p v-if="errorMessage" class="strudel-compose__error" role="alert">{{ errorMessage }}</p>
    <section v-else-if="answer" class="strudel-compose__answer" aria-label="Answer">
      <Accordion v-if="answer.explanation || instrumentRows.length > 0">
        <AccordionItem value="report">
          <AccordionTrigger>Report</AccordionTrigger>
          <AccordionContent>
            <p v-if="answer.explanation" class="strudel-compose__explanation">
              {{ answer.explanation }}
            </p>
            <ul
              v-if="instrumentRows.length > 0"
              class="strudel-compose__instruments"
              aria-label="Designed instruments"
            >
              <li v-for="row in instrumentRows" :key="row.name" class="strudel-compose__instrument">
                <span class="strudel-compose__instrument-name">{{ row.name }}</span>
                {{ row.kindLabel }}: {{ row.description }}
                <span
                  class="strudel-compose__instrument-status"
                  :class="{ 'strudel-compose__instrument-status--failed': row.failed }"
                  >{{ row.statusLabel }}</span
                >
              </li>
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      <template v-if="answer.code">
        <pre
          class="strudel-compose__code"
          aria-label="Answered code"
        ><code>{{ answer.code }}</code></pre>
        <div class="strudel-compose__actions">
          <Button size="sm" :disabled="!canApply" :aria-busy="applying" @click="onApply">
            {{ applying ? 'Applying...' : 'Apply' }}
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

.strudel-compose__instruments {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
}

.strudel-compose__instrument-name {
  font-family: var(--font-mono, monospace);
}

.strudel-compose__instrument-status {
  display: block;
  color: var(--color-muted-foreground);
}

.strudel-compose__instrument-status--failed {
  color: var(--color-destructive);
}

.strudel-compose__error {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-destructive);
}
</style>
