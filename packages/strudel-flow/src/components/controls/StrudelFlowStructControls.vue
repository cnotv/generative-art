<script setup lang="ts">
import { computed } from 'vue'
import { STRUDEL_FLOW_STEP_COUNT } from '../../config'
import { readStrudelFlowStructSteps, writeStrudelFlowStructSteps } from '../../structSteps'
import type { StrudelFlowStructData } from '../../types'
import StrudelFlowStepper from './StrudelFlowStepper.vue'

const props = defineProps<{
  data: StrudelFlowStructData
}>()

const emit = defineEmits<{
  update: [data: StrudelFlowStructData]
}>()

// A plain run of hits and rests shows as switches; anything else, such as `"x(3,8)"` or a named
// constant, is edited as written.
const steps = computed(() => readStrudelFlowStructSteps(props.data.argument))

const setArgument = (argument: string): void => {
  emit('update', { ...props.data, argument })
}

const setSteps = (nextSteps: boolean[]): void => {
  setArgument(writeStrudelFlowStructSteps(nextSteps))
}

const onStepToggle = (stepIndex: number): void => {
  if (steps.value !== null) {
    setSteps(steps.value.map((step, index) => (index === stepIndex ? !step : step)))
  }
}

// New steps start as rests, so lengthening a pattern never adds a hit.
const onStepCountChange = (stepCount: number): void => {
  if (steps.value !== null) {
    setSteps(Array.from({ length: stepCount }, (_, index) => steps.value?.[index] ?? false))
  }
}

const onArgumentInput = (event: Event): void => {
  if (event.target instanceof HTMLInputElement) {
    setArgument(event.target.value)
  }
}
</script>

<template>
  <template v-if="steps !== null">
    <StrudelFlowStepper
      label="Steps"
      :model-value="steps.length"
      :min="1"
      :max="STRUDEL_FLOW_STEP_COUNT"
      @update:model-value="onStepCountChange"
    />
    <div class="strudel-flow-calls__steps" role="group" aria-label="Struct steps">
      <button
        v-for="(step, stepIndex) in steps"
        :key="stepIndex"
        type="button"
        class="strudel-flow-calls__step nodrag"
        :class="{ 'strudel-flow-calls__step--on': step }"
        :aria-pressed="step"
        :aria-label="`Step ${stepIndex + 1}`"
        @click="onStepToggle(stepIndex)"
      />
    </div>
  </template>
  <label class="strudel-flow-field">
    <span class="strudel-flow-field__label">Struct pattern</span>
    <input
      class="strudel-flow-calls__text nodrag"
      :value="data.argument"
      aria-label="Struct pattern"
      spellcheck="false"
      @input="onArgumentInput"
    />
  </label>
</template>
