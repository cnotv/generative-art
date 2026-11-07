<script setup lang="ts">
import { markRaw } from 'vue'
import { ArrowLeftRight, Brackets, Code, Layers, Pause, Plus, X } from 'lucide-vue-next'
import {
  STRUDEL_FLOW_SAMPLE_MODIFIER_KINDS,
  STRUDEL_FLOW_SAMPLE_MODIFIER_OPTIONS
} from '../../config'
import type {
  StrudelFlowSampleGroup,
  StrudelFlowSampleLayer,
  StrudelFlowSampleModifierKind,
  StrudelFlowSampleStep
} from '../../types'
import { STRUDEL_FLOW_SAMPLE_MODIFIER_ICONS } from '../sampleFamilyIcons'
import StrudelFlowSamplePicker from './StrudelFlowSamplePicker.vue'
import StrudelFlowSelect from './StrudelFlowSelect.vue'

const props = defineProps<{
  layers: StrudelFlowSampleLayer[]
  sampleGroups: StrudelFlowSampleGroup[]
  /** Nested inside a group; only the outermost line can add layers. */
  nested?: boolean
}>()

const emit = defineEmits<{
  'update:layers': [layers: StrudelFlowSampleLayer[]]
}>()

type Bracket = 'subdivide' | 'alternate'

const BRACKET_OPTIONS = [
  { value: 'subdivide', label: 'Fit in one step', icon: markRaw(Brackets) },
  { value: 'alternate', label: 'One per cycle', icon: markRaw(ArrowLeftRight) }
] as const satisfies readonly { value: Bracket; label: string; icon: unknown }[]

const PLUS_ICON = markRaw(Plus)
const REST_ICON = markRaw(Pause)
const UNKNOWN_MODIFIER_ICON = markRaw(Code)

const modifierKind = (modifier: string): StrudelFlowSampleModifierKind | undefined =>
  STRUDEL_FLOW_SAMPLE_MODIFIER_OPTIONS.find((option) => option.value === modifier)?.kind

const modifierIcon = (modifier: string) => {
  const kind = modifierKind(modifier)
  return kind === undefined ? UNKNOWN_MODIFIER_ICON : STRUDEL_FLOW_SAMPLE_MODIFIER_ICONS[kind]
}

// A modifier read from code that the list does not name stays selectable, under its own group.
const modifierGroups = (modifier: string) => {
  const known = STRUDEL_FLOW_SAMPLE_MODIFIER_KINDS.map((kind) => ({
    label: kind.label,
    options: STRUDEL_FLOW_SAMPLE_MODIFIER_OPTIONS.filter((option) => option.kind === kind.id)
  }))
  return modifierKind(modifier) === undefined
    ? [{ label: 'In this pattern', options: [{ value: modifier, label: modifier }] }, ...known]
    : known
}

// A group left with no steps would write `[]`, which Strudel cannot read, so it goes too.
const isEmptyGroup = (step: StrudelFlowSampleStep): boolean =>
  step.kind === 'group' && step.layers.every((layer) => layer.length === 0)

const emitLayers = (layers: StrudelFlowSampleLayer[]): void => {
  emit('update:layers', layers)
}

const updateLayer = (layerIndex: number, steps: StrudelFlowSampleStep[]): void => {
  emitLayers(
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

// Picking a sample on a rest fills that step; it keeps its place in the line.
const fillRest = (layerIndex: number, stepIndex: number, sound: string): void => {
  if (sound.length > 0) {
    replaceStep(layerIndex, stepIndex, { kind: 'sound', sound, modifier: '' })
  }
}

const addGroup = (layerIndex: number): void => {
  addStep(layerIndex, {
    kind: 'group',
    bracket: 'subdivide',
    layers: [[{ kind: 'rest' }]],
    modifier: ''
  })
}

const addLayer = (): void => {
  emitLayers([...props.layers, [{ kind: 'rest' }]])
}

const removeLayer = (layerIndex: number): void => {
  emitLayers(props.layers.filter((_layer, index) => index !== layerIndex))
}

const inputValue = (event: Event): string =>
  event.target instanceof HTMLInputElement ? event.target.value : ''

const stepLabel = (step: StrudelFlowSampleStep): string => {
  if (step.kind === 'sound') {
    return step.sound
  }
  return step.kind === 'text' ? 'notation' : step.kind
}
</script>

<template>
  <div class="strudel-flow-sample-steps" :class="{ 'strudel-flow-sample-steps--nested': nested }">
    <p v-if="!nested" class="strudel-flow-sample-steps__hint">
      Steps share one cycle, left to right. Layers play together.
    </p>
    <div
      v-for="(layer, layerIndex) in layers"
      :key="layerIndex"
      class="strudel-flow-sample-steps__layer"
      role="group"
      :aria-label="layers.length > 1 ? `Layer ${layerIndex + 1}` : 'Steps'"
    >
      <div v-if="layers.length > 1" class="strudel-flow-sample-steps__layer-label">
        <Layers aria-hidden="true" />
        <span>Layer {{ layerIndex + 1 }}</span>
        <button
          type="button"
          class="strudel-flow-calls__remove nodrag"
          :aria-label="`Remove layer ${layerIndex + 1}`"
          title="Remove layer"
          @click="removeLayer(layerIndex)"
        >
          <X aria-hidden="true" />
        </button>
      </div>
      <ol class="strudel-flow-sample-steps__sequence">
        <li
          v-for="(step, stepIndex) in layer"
          :key="stepIndex"
          class="strudel-flow-sample-steps__tile"
          :class="`strudel-flow-sample-steps__tile--${step.kind}`"
        >
          <div class="strudel-flow-sample-steps__tile-header">
            <span class="strudel-flow-sample-steps__index" aria-hidden="true">
              {{ stepIndex + 1 }}
            </span>
            <div
              v-if="step.kind === 'group'"
              class="strudel-flow-sample-steps__bracket"
              role="group"
              aria-label="Group timing"
            >
              <button
                v-for="option in BRACKET_OPTIONS"
                :key="option.value"
                type="button"
                class="strudel-flow-sample-steps__bracket-button nodrag"
                :class="{
                  'strudel-flow-sample-steps__bracket-button--active': step.bracket === option.value
                }"
                :aria-pressed="step.bracket === option.value"
                :aria-label="option.label"
                :title="option.label"
                @click="replaceStep(layerIndex, stepIndex, { ...step, bracket: option.value })"
              >
                <component :is="option.icon" aria-hidden="true" />
              </button>
            </div>
            <button
              type="button"
              class="strudel-flow-calls__remove strudel-flow-sample-steps__remove nodrag"
              :aria-label="`Remove ${stepLabel(step)} step ${stepIndex + 1}`"
              :title="`Remove ${stepLabel(step)}`"
              @click="removeStep(layerIndex, stepIndex)"
            >
              <X aria-hidden="true" />
            </button>
          </div>
          <StrudelFlowSampleSteps
            v-if="step.kind === 'group'"
            :layers="step.layers"
            :sample-groups="sampleGroups"
            nested
            @update:layers="replaceStep(layerIndex, stepIndex, { ...step, layers: $event })"
          />
          <StrudelFlowSamplePicker
            v-else-if="step.kind === 'sound'"
            :label="`Step ${stepIndex + 1} sample`"
            :model-value="step.sound"
            :groups="sampleGroups"
            @update:model-value="replaceStep(layerIndex, stepIndex, { ...step, sound: $event })"
          />
          <StrudelFlowSamplePicker
            v-else-if="step.kind === 'rest'"
            :label="`Step ${stepIndex + 1} sample`"
            model-value=""
            placeholder="Rest"
            :empty-icon="REST_ICON"
            :groups="sampleGroups"
            @update:model-value="fillRest(layerIndex, stepIndex, $event)"
          />
          <input
            v-else
            class="strudel-flow-calls__text nodrag"
            :value="step.text"
            :aria-label="`Step ${stepIndex + 1} mini notation`"
            spellcheck="false"
            @change="replaceStep(layerIndex, stepIndex, { kind: 'text', text: inputValue($event) })"
          />
          <div
            v-if="step.kind === 'sound' || step.kind === 'group'"
            class="strudel-flow-sample-steps__modifier"
          >
            <component
              :is="modifierIcon(step.modifier)"
              class="strudel-flow-sample-steps__modifier-icon"
              aria-hidden="true"
            />
            <StrudelFlowSelect
              :label="step.kind === 'group' ? 'Group plays' : `Step ${stepIndex + 1} plays`"
              hide-label
              :model-value="step.modifier"
              :groups="modifierGroups(step.modifier)"
              @update:model-value="
                replaceStep(layerIndex, stepIndex, { ...step, modifier: $event })
              "
            />
          </div>
        </li>
        <li class="strudel-flow-sample-steps__add">
          <StrudelFlowSamplePicker
            v-if="sampleGroups.length > 0"
            label="Add sample"
            model-value=""
            placeholder="Sample"
            :empty-icon="PLUS_ICON"
            :groups="sampleGroups"
            @update:model-value="addSound(layerIndex, $event)"
          />
          <button
            type="button"
            class="strudel-flow-sample-steps__add-button nodrag"
            aria-label="Add rest"
            title="Add a rest"
            @click="addStep(layerIndex, { kind: 'rest' })"
          >
            <Pause aria-hidden="true" />
          </button>
          <button
            type="button"
            class="strudel-flow-sample-steps__add-button nodrag"
            aria-label="Add group"
            title="Add a group of steps that share one step"
            @click="addGroup(layerIndex)"
          >
            <Brackets aria-hidden="true" />
          </button>
        </li>
      </ol>
    </div>
    <button
      v-if="!nested"
      type="button"
      class="strudel-flow-calls__add nodrag"
      title="Add a layer that plays alongside"
      @click="addLayer"
    >
      <Layers aria-hidden="true" />
      Add layer
    </button>
  </div>
</template>
