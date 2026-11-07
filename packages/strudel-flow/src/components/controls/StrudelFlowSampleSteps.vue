<script setup lang="ts">
import { Brackets, Layers, Pause, X } from 'lucide-vue-next'
import { STRUDEL_FLOW_SAMPLE_MODIFIER_OPTIONS } from '../../config'
import type {
  StrudelFlowSampleGroup,
  StrudelFlowSampleLayer,
  StrudelFlowSampleStep
} from '../../types'
import StrudelFlowSamplePicker from './StrudelFlowSamplePicker.vue'

const props = defineProps<{
  layers: StrudelFlowSampleLayer[]
  sampleGroups: StrudelFlowSampleGroup[]
  /** Nested inside a group; only the outermost line can add layers. */
  nested?: boolean
}>()

const emit = defineEmits<{
  'update:layers': [layers: StrudelFlowSampleLayer[]]
}>()

const BRACKET_OPTIONS = [
  { value: 'subdivide', label: 'Squeezed into one step' },
  { value: 'alternate', label: 'One per cycle' }
]

// A modifier read from code that the list does not name stays selectable.
const modifierOptions = (modifier: string): { value: string; label: string }[] =>
  STRUDEL_FLOW_SAMPLE_MODIFIER_OPTIONS.some((option) => option.value === modifier)
    ? STRUDEL_FLOW_SAMPLE_MODIFIER_OPTIONS
    : [...STRUDEL_FLOW_SAMPLE_MODIFIER_OPTIONS, { value: modifier, label: modifier }]

// A group left with no steps would write `[]`, which Strudel cannot read, so it goes too.
const isEmptyGroup = (step: StrudelFlowSampleStep): boolean =>
  step.kind === 'group' && step.layers.every((layer) => layer.length === 0)

const updateLayer = (layerIndex: number, steps: StrudelFlowSampleStep[]): void => {
  emit(
    'update:layers',
    props.layers.map((layer, index) =>
      index === layerIndex ? steps.filter((step) => !isEmptyGroup(step)) : layer
    )
  )
}

const replaceStep = (layerIndex: number, stepIndex: number, step: StrudelFlowSampleStep): void => {
  updateLayer(
    layerIndex,
    (props.layers[layerIndex] ?? []).map((current, index) => (index === stepIndex ? step : current))
  )
}

const removeStep = (layerIndex: number, stepIndex: number): void => {
  updateLayer(
    layerIndex,
    (props.layers[layerIndex] ?? []).filter((_step, index) => index !== stepIndex)
  )
}

const addStep = (layerIndex: number, step: StrudelFlowSampleStep): void => {
  updateLayer(layerIndex, [...(props.layers[layerIndex] ?? []), step])
}

const addSound = (layerIndex: number, sound: string): void => {
  if (sound.length > 0) {
    addStep(layerIndex, { kind: 'sound', sound, modifier: '' })
  }
}

const addLayer = (): void => {
  emit('update:layers', [...props.layers, [{ kind: 'rest' }]])
}

const selectValue = (event: Event): string =>
  event.target instanceof HTMLSelectElement ? event.target.value : ''

const inputValue = (event: Event): string =>
  event.target instanceof HTMLInputElement ? event.target.value : ''

const stepLabel = (step: StrudelFlowSampleStep): string => {
  if (step.kind === 'sound') {
    return step.sound
  }
  return step.kind === 'group' ? 'group' : step.kind
}
</script>

<template>
  <div class="strudel-flow-sample-steps" :class="{ 'strudel-flow-sample-steps--nested': nested }">
    <div
      v-for="(layer, layerIndex) in layers"
      :key="layerIndex"
      class="strudel-flow-sample-steps__layer"
      role="group"
      :aria-label="layers.length > 1 ? `Layer ${layerIndex + 1}` : 'Steps'"
    >
      <span v-if="layers.length > 1" class="strudel-flow-sample-steps__layer-label">
        Layer {{ layerIndex + 1 }}
      </span>
      <template v-for="(step, stepIndex) in layer" :key="stepIndex">
        <div v-if="step.kind === 'group'" class="strudel-flow-sample-steps__group">
          <div class="strudel-flow-sample-steps__group-header">
            <span class="strudel-flow-select strudel-flow-sample-steps__select">
              <select
                class="nodrag"
                :value="step.bracket"
                aria-label="Group plays"
                @change="
                  replaceStep(layerIndex, stepIndex, {
                    ...step,
                    bracket: selectValue($event) === 'alternate' ? 'alternate' : 'subdivide'
                  })
                "
              >
                <option v-for="option in BRACKET_OPTIONS" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </span>
            <span class="strudel-flow-select strudel-flow-sample-steps__select">
              <select
                class="nodrag"
                :value="step.modifier"
                aria-label="Group modifier"
                @change="
                  replaceStep(layerIndex, stepIndex, { ...step, modifier: selectValue($event) })
                "
              >
                <option
                  v-for="option in modifierOptions(step.modifier)"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </span>
            <button
              type="button"
              class="strudel-flow-calls__remove nodrag"
              aria-label="Remove group"
              title="Remove group"
              @click="removeStep(layerIndex, stepIndex)"
            >
              <X aria-hidden="true" />
            </button>
          </div>
          <StrudelFlowSampleSteps
            :layers="step.layers"
            :sample-groups="sampleGroups"
            nested
            @update:layers="replaceStep(layerIndex, stepIndex, { ...step, layers: $event })"
          />
        </div>
        <div
          v-else
          class="strudel-flow-sample-steps__step"
          :class="`strudel-flow-sample-steps__step--${step.kind}`"
        >
          <StrudelFlowSamplePicker
            v-if="step.kind === 'sound'"
            :label="`Step ${stepIndex + 1} sample`"
            :model-value="step.sound"
            :groups="sampleGroups"
            @update:model-value="replaceStep(layerIndex, stepIndex, { ...step, sound: $event })"
          />
          <span
            v-if="step.kind === 'sound'"
            class="strudel-flow-select strudel-flow-sample-steps__select"
          >
            <select
              class="nodrag"
              :value="step.modifier"
              :aria-label="`Step ${stepIndex + 1} plays`"
              @change="
                replaceStep(layerIndex, stepIndex, { ...step, modifier: selectValue($event) })
              "
            >
              <option
                v-for="option in modifierOptions(step.modifier)"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </span>
          <span v-else-if="step.kind === 'rest'" class="strudel-flow-sample-steps__rest">Rest</span>
          <input
            v-else-if="step.kind === 'text'"
            class="strudel-flow-calls__text nodrag"
            :value="step.text"
            :aria-label="`Step ${stepIndex + 1} mini notation`"
            spellcheck="false"
            @change="replaceStep(layerIndex, stepIndex, { kind: 'text', text: inputValue($event) })"
          />
          <button
            type="button"
            class="strudel-flow-calls__remove nodrag"
            :aria-label="`Remove ${stepLabel(step)} step ${stepIndex + 1}`"
            :title="`Remove ${stepLabel(step)}`"
            @click="removeStep(layerIndex, stepIndex)"
          >
            <X aria-hidden="true" />
          </button>
        </div>
      </template>
      <div class="strudel-flow-sample-steps__add">
        <StrudelFlowSamplePicker
          v-if="sampleGroups.length > 0"
          label="Add sample"
          model-value=""
          placeholder="+ Sample"
          :groups="sampleGroups"
          @update:model-value="addSound(layerIndex, $event)"
        />
        <button
          type="button"
          class="strudel-flow-calls__add nodrag"
          title="Add a rest"
          @click="addStep(layerIndex, { kind: 'rest' })"
        >
          <Pause aria-hidden="true" />
          Rest
        </button>
        <button
          type="button"
          class="strudel-flow-calls__add nodrag"
          title="Add a group of steps"
          @click="
            addStep(layerIndex, {
              kind: 'group',
              bracket: 'subdivide',
              layers: [[{ kind: 'rest' }]],
              modifier: ''
            })
          "
        >
          <Brackets aria-hidden="true" />
          Group
        </button>
      </div>
    </div>
    <button
      v-if="!nested"
      type="button"
      class="strudel-flow-calls__add nodrag"
      title="Add a layer that plays alongside"
      @click="addLayer"
    >
      <Layers aria-hidden="true" />
      Layer
    </button>
  </div>
</template>
