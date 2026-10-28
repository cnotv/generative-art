<script setup lang="ts">
import type { StrudelFlowEffectData } from '../../types'

const props = defineProps<{
  data: StrudelFlowEffectData
}>()

const emit = defineEmits<{
  update: [data: StrudelFlowEffectData]
}>()

const onFieldInput = (field: 'method' | 'argument', event: Event): void => {
  const input = event.target
  if (input instanceof HTMLInputElement) {
    emit('update', { ...props.data, [field]: input.value })
  }
}
</script>

<template>
  <div class="strudel-flow-effect">
    <label class="strudel-flow-field">
      <span class="strudel-flow-field__label">Call</span>
      <input
        class="input"
        :value="data.method"
        aria-label="Effect call name"
        spellcheck="false"
        @input="onFieldInput('method', $event)"
      />
    </label>
    <label class="strudel-flow-field">
      <span class="strudel-flow-field__label">Argument</span>
      <input
        class="input"
        :value="data.argument"
        aria-label="Effect call argument"
        spellcheck="false"
        @input="onFieldInput('argument', $event)"
      />
    </label>
  </div>
</template>
