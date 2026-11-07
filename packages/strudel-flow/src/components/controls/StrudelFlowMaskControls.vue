<script setup lang="ts">
import { computed } from 'vue'
import { readStrudelFlowCallFields, writeStrudelFlowCallFields } from '../../callArguments'
import type { StrudelFlowMaskData } from '../../types'

const props = defineProps<{
  data: StrudelFlowMaskData
}>()

const emit = defineEmits<{
  update: [data: StrudelFlowMaskData]
}>()

// A plain run of ones and zeros shows as switches; anything else, such as `"<1!40 0!8>"` or a
// named constant, is edited as written.
const toggles = computed(() => {
  const [field] = readStrudelFlowCallFields({ method: 'mask', argument: props.data.argument }) ?? []
  return field?.kind === 'toggles' ? field : null
})

const setArgument = (argument: string): void => {
  emit('update', { ...props.data, argument })
}

const onStepToggle = (stepIndex: number): void => {
  if (toggles.value !== null) {
    setArgument(
      writeStrudelFlowCallFields([
        {
          ...toggles.value,
          steps: toggles.value.steps.map((step, index) => (index === stepIndex ? !step : step))
        }
      ])
    )
  }
}

const onArgumentInput = (event: Event): void => {
  if (event.target instanceof HTMLInputElement) {
    setArgument(event.target.value)
  }
}
</script>

<template>
  <div v-if="toggles !== null" class="strudel-flow-calls__control">
    <span class="strudel-flow-field__label">
      {{ toggles.perCycle ? 'Cycles that play' : 'Steps that play' }}
    </span>
    <div
      class="strudel-flow-calls__steps"
      role="group"
      :aria-label="`Mask ${toggles.perCycle ? 'cycles' : 'steps'}`"
    >
      <button
        v-for="(step, stepIndex) in toggles.steps"
        :key="stepIndex"
        type="button"
        class="strudel-flow-calls__step nodrag"
        :class="{ 'strudel-flow-calls__step--on': step }"
        :aria-pressed="step"
        :aria-label="`${toggles.perCycle ? 'Cycle' : 'Step'} ${stepIndex + 1}`"
        @click="onStepToggle(stepIndex)"
      />
    </div>
  </div>
  <label class="strudel-flow-field">
    <span class="strudel-flow-field__label">Mask pattern</span>
    <input
      class="strudel-flow-calls__text nodrag"
      :value="data.argument"
      aria-label="Mask pattern"
      spellcheck="false"
      @input="onArgumentInput"
    />
  </label>
</template>
