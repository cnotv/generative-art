<script setup lang="ts">
import { computed } from 'vue'
import { Plus, X } from 'lucide-vue-next'
import type { StrudelFlowCall, StrudelFlowNodeData } from '../../types'

const props = defineProps<{
  data: StrudelFlowNodeData
}>()

const emit = defineEmits<{
  update: [data: StrudelFlowNodeData]
}>()

const calls = computed(() => props.data.calls ?? [])

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
      <li v-for="(call, index) in calls" :key="index" class="strudel-flow-calls__row">
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
    </ul>
    <button type="button" class="strudel-flow-calls__add nodrag" @click="onAdd">
      <Plus aria-hidden="true" />
      Add call
    </button>
  </section>
</template>
