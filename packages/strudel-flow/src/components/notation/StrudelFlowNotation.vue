<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { useNodeId } from '@vue-flow/core'
import StrudelFlowSelect from '../controls/StrudelFlowSelect.vue'
import StrudelFlowNoteNames from './StrudelFlowNoteNames.vue'
import StrudelFlowPianoRoll from './StrudelFlowPianoRoll.vue'
import StrudelFlowTabStaff from './StrudelFlowTabStaff.vue'
import { STRUDEL_FLOW_NOTATION_CONTEXT } from './notationContextKey'
import { STRUDEL_FLOW_DEFAULT_BEATS_PER_CYCLE, STRUDEL_FLOW_NOTATION_OPTIONS } from '../../config'
import { pickStrudelFlowNotation, resolveStrudelFlowNotation } from '../../notationPick'
import type { StrudelFlowNoteBar, StrudelFlowNotesData } from '../../types'

const props = defineProps<{
  data: StrudelFlowNotesData
}>()

const emit = defineEmits<{
  update: [data: StrudelFlowNotesData]
}>()

const context = inject(STRUDEL_FLOW_NOTATION_CONTEXT, null)
const nodeId = useNodeId()
const bars = ref<StrudelFlowNoteBar[]>([])

const beatsPerCycle = computed(
  () => context?.value.beatsPerCycle ?? STRUDEL_FLOW_DEFAULT_BEATS_PER_CYCLE
)
const sound = computed(() => context?.value.soundOf(nodeId) ?? '')
const view = computed(() => resolveStrudelFlowNotation(props.data.notation, sound.value))

const labelOf = (value: string): string =>
  STRUDEL_FLOW_NOTATION_OPTIONS.find((option) => option.value === value)?.label ?? value

const options = computed(() =>
  STRUDEL_FLOW_NOTATION_OPTIONS.map((option) =>
    option.value === 'auto'
      ? { ...option, label: `Auto: ${labelOf(pickStrudelFlowNotation(sound.value))}` }
      : option
  )
)

// Reading goes through Strudel and finishes later; an answer for an older pattern is dropped.
watch(
  [() => props.data.pattern, beatsPerCycle, () => context?.value.readNoteBars],
  async ([pattern, cycleBeats, readNoteBars]) => {
    const read =
      readNoteBars === undefined || readNoteBars === null
        ? []
        : await readNoteBars(pattern, cycleBeats)
    if (pattern === props.data.pattern) {
      bars.value = read
    }
  },
  { immediate: true }
)

const onNotationChange = (value: string): void => {
  const notation = STRUDEL_FLOW_NOTATION_OPTIONS.find((option) => option.value === value)?.value
  if (notation !== undefined) {
    emit('update', { ...props.data, notation })
  }
}
</script>

<template>
  <StrudelFlowSelect
    label="Notation"
    :model-value="data.notation"
    :options="options"
    @update:model-value="onNotationChange"
  />
  <template v-if="bars.length > 0">
    <StrudelFlowTabStaff
      v-if="view === 'bass' || view === 'guitar'"
      :bars="bars"
      :instrument="view"
      :beats-per-bar="beatsPerCycle"
    />
    <StrudelFlowPianoRoll
      v-else-if="view === 'piano'"
      :bars="bars"
      :beats-per-bar="beatsPerCycle"
    />
    <StrudelFlowNoteNames v-else :bars="bars" :beats-per-bar="beatsPerCycle" />
  </template>
</template>
