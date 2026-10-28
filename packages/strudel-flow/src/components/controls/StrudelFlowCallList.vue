<script setup lang="ts">
import { computed } from 'vue'
import { Plus, X } from 'lucide-vue-next'
import { readStrudelFlowCallFields, writeStrudelFlowCallFields } from '../../callArguments'
import type { StrudelFlowCall, StrudelFlowCallField, StrudelFlowNodeData } from '../../types'
import StrudelFlowKnob from './StrudelFlowKnob.vue'

const props = defineProps<{
  data: StrudelFlowNodeData
}>()

const emit = defineEmits<{
  update: [data: StrudelFlowNodeData]
}>()

const calls = computed(() => props.data.calls ?? [])
const callFields = computed(() => calls.value.map(readStrudelFlowCallFields))

const updateCalls = (nextCalls: StrudelFlowCall[]): void => {
  emit('update', Object.assign({}, props.data, { calls: nextCalls }))
}

const onFieldInput = (index: number, field: keyof StrudelFlowCall, event: Event): void => {
  const input = event.target
  if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
    updateCalls(
      calls.value.map((call, callIndex) =>
        callIndex === index ? { ...call, [field]: input.value } : call
      )
    )
  }
}

const setArgument = (index: number, argument: string): void => {
  updateCalls(
    calls.value.map((call, callIndex) => (callIndex === index ? { ...call, argument } : call))
  )
}

const updateField = (callIndex: number, fieldIndex: number, field: StrudelFlowCallField): void => {
  const fields = callFields.value[callIndex] ?? []
  setArgument(
    callIndex,
    writeStrudelFlowCallFields(
      fields.map((current, index) => (index === fieldIndex ? field : current))
    )
  )
}

const onNumberChange = (
  callIndex: number,
  fieldIndex: number,
  field: Extract<StrudelFlowCallField, { kind: 'number' }>,
  value: number
): void => {
  updateField(callIndex, fieldIndex, { ...field, value })
}

const hasNumberField = (fields: StrudelFlowCallField[]): boolean =>
  fields.some((field) => field.kind === 'number')

const onTextInput = (
  callIndex: number,
  fieldIndex: number,
  field: Extract<StrudelFlowCallField, { kind: 'text' }>,
  event: Event
): void => {
  if (event.target instanceof HTMLInputElement) {
    updateField(callIndex, fieldIndex, { ...field, value: event.target.value })
  }
}

const onStepToggle = (
  callIndex: number,
  fieldIndex: number,
  field: Extract<StrudelFlowCallField, { kind: 'toggles' }>,
  stepIndex: number
): void => {
  updateField(callIndex, fieldIndex, {
    ...field,
    steps: field.steps.map((step, index) => (index === stepIndex ? !step : step))
  })
}

const onRemove = (index: number): void => {
  updateCalls(calls.value.filter((_call, callIndex) => callIndex !== index))
}

const onAdd = (): void => {
  updateCalls([...calls.value, { method: '', argument: '' }])
}
</script>

<template>
  <section class="strudel-flow-calls" aria-label="Chained calls">
    <span class="strudel-flow-field__label">Calls</span>
    <ul class="strudel-flow-calls__list">
      <template v-for="(call, index) in calls" :key="index">
        <li
          v-if="callFields[index] !== null"
          class="strudel-flow-calls__row strudel-flow-calls__row--controls"
        >
          <div class="strudel-flow-calls__heading">
            <span class="strudel-flow-calls__name">.{{ call.method }}</span>
            <button
              type="button"
              class="strudel-flow-calls__remove nodrag"
              :aria-label="`Remove ${call.method}`"
              :title="`Remove ${call.method}`"
              @click="onRemove(index)"
            >
              <X aria-hidden="true" />
            </button>
          </div>
          <div v-if="hasNumberField(callFields[index] ?? [])" class="strudel-flow-knobs">
            <template v-for="(field, fieldIndex) in callFields[index]" :key="fieldIndex">
              <StrudelFlowKnob
                v-if="field.kind === 'number'"
                :label="field.label"
                :model-value="field.value"
                :min="field.min"
                :max="field.max"
                :step="field.step"
                @update:model-value="onNumberChange(index, fieldIndex, field, $event)"
              />
            </template>
          </div>
          <template v-for="(field, fieldIndex) in callFields[index]" :key="fieldIndex">
            <label v-if="field.kind === 'text'" class="strudel-flow-calls__control">
              <span class="strudel-flow-calls__control-label">{{ field.label }}</span>
              <input
                class="strudel-flow-calls__text nodrag"
                :value="field.value"
                :aria-label="`${call.method} ${field.label.toLowerCase()}`"
                spellcheck="false"
                @input="onTextInput(index, fieldIndex, field, $event)"
              />
            </label>
            <div v-else-if="field.kind === 'toggles'" class="strudel-flow-calls__control">
              <span class="strudel-flow-calls__control-label">{{ field.label }}</span>
              <div
                class="strudel-flow-calls__steps"
                role="group"
                :aria-label="`${call.method} ${field.perCycle ? 'cycles' : 'steps'}`"
              >
                <button
                  v-for="(step, stepIndex) in field.steps"
                  :key="stepIndex"
                  type="button"
                  class="strudel-flow-calls__step nodrag"
                  :class="{ 'strudel-flow-calls__step--on': step }"
                  :aria-pressed="step"
                  :aria-label="`${field.perCycle ? 'Cycle' : 'Step'} ${stepIndex + 1}`"
                  @click="onStepToggle(index, fieldIndex, field, stepIndex)"
                />
              </div>
            </div>
          </template>
        </li>
        <li v-else class="strudel-flow-calls__row">
          <span class="strudel-flow-calls__punctuation" aria-hidden="true">.</span>
          <input
            class="strudel-flow-calls__method nodrag"
            :value="call.method"
            placeholder="fast"
            :size="Math.max(4, call.method.length)"
            aria-label="Call name"
            spellcheck="false"
            @input="onFieldInput(index, 'method', $event)"
          />
          <span class="strudel-flow-calls__punctuation" aria-hidden="true">(</span>
          <textarea
            class="strudel-flow-calls__argument nodrag nowheel"
            :value="call.argument"
            rows="1"
            placeholder="2"
            :aria-label="`${call.method || 'Call'} argument`"
            spellcheck="false"
            @input="onFieldInput(index, 'argument', $event)"
          />
          <span class="strudel-flow-calls__punctuation" aria-hidden="true">)</span>
          <button
            type="button"
            class="strudel-flow-calls__remove nodrag"
            :aria-label="`Remove ${call.method || 'call'}`"
            :title="`Remove ${call.method || 'call'}`"
            @click="onRemove(index)"
          >
            <X aria-hidden="true" />
          </button>
        </li>
      </template>
    </ul>
    <button type="button" class="strudel-flow-calls__add nodrag" @click="onAdd">
      <Plus aria-hidden="true" />
      Add call
    </button>
  </section>
</template>
