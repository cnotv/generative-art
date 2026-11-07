<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ChevronDown, Search } from 'lucide-vue-next'
import { STRUDEL_FLOW_SAMPLE_FAMILIES } from '../../config'
import { findStrudelFlowSampleFamily, STRUDEL_FLOW_OTHER_SAMPLE_FAMILY } from '../../sampleFamilies'
import type { StrudelFlowSampleGroup } from '../../types'
import { STRUDEL_FLOW_OVERLAY_TARGET } from '../overlayTargetKey'
import { STRUDEL_FLOW_SAMPLE_FAMILY_ICONS } from '../sampleFamilyIcons'
import StrudelFlowSelect from './StrudelFlowSelect.vue'

const props = defineProps<{
  label: string
  modelValue: string
  groups: StrudelFlowSampleGroup[]
  /** Shown while nothing is picked; the picker then adds rather than replaces. */
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

type PickerEntry = { value: string; label: string; group: string; familyId: string }

const ALL_FAMILIES = 'all'
const POPOVER_WIDTH = 480
const POPOVER_HEIGHT = 360
const POPOVER_GAP = 4
// Typing narrows the list; past this many the grid stops drawing and asks for a search.
const MAX_SHOWN_ENTRIES = 240

const overlayTarget = inject(STRUDEL_FLOW_OVERLAY_TARGET, null)
// Fixed positioning breaks under the canvas's zoom transform, so the list draws beside it.
const teleportTarget = computed(() => overlayTarget?.value ?? 'body')
const trigger = ref<HTMLButtonElement | null>(null)
const popover = ref<HTMLElement | null>(null)
const searchField = ref<HTMLInputElement | null>(null)
const isFinePointer = ref(false)
const isOpen = ref(false)
const query = ref('')
const activeFamilyId = ref(ALL_FAMILIES)
const position = ref({ left: 0, top: 0 })

const familyIcon = (familyId: string) =>
  STRUDEL_FLOW_SAMPLE_FAMILY_ICONS[familyId] ?? STRUDEL_FLOW_SAMPLE_FAMILY_ICONS.other

// A sample read from code that the list does not name, such as "bd:3", stays selectable.
const shownGroups = computed<StrudelFlowSampleGroup[]>(() =>
  props.modelValue.length === 0 ||
  props.groups.some((group) => group.samples.some((sample) => sample.value === props.modelValue))
    ? props.groups
    : [
        {
          label: 'In this pattern',
          samples: [{ value: props.modelValue, label: props.modelValue }]
        },
        ...props.groups
      ]
)

const entries = computed<PickerEntry[]>(() => {
  const seen = new Set<string>()
  return shownGroups.value.flatMap((group) =>
    group.samples.flatMap((sample) => {
      if (seen.has(sample.value)) {
        return []
      }
      seen.add(sample.value)
      return [
        { ...sample, group: group.label, familyId: findStrudelFlowSampleFamily(sample.value).id }
      ]
    })
  )
})

const families = computed(() =>
  [...STRUDEL_FLOW_SAMPLE_FAMILIES, STRUDEL_FLOW_OTHER_SAMPLE_FAMILY]
    .map((family) => ({
      ...family,
      count: entries.value.filter((entry) => entry.familyId === family.id).length
    }))
    .filter((family) => family.count > 0)
)

const matchingEntries = computed(() => {
  const words = query.value.toLowerCase().split(/\s+/).filter(Boolean)
  return entries.value.filter(
    (entry) =>
      (activeFamilyId.value === ALL_FAMILIES || entry.familyId === activeFamilyId.value) &&
      words.every((word) =>
        `${entry.value} ${entry.label} ${entry.group}`.toLowerCase().includes(word)
      )
  )
})
const shownEntries = computed(() => matchingEntries.value.slice(0, MAX_SHOWN_ENTRIES))

const current = computed(() => entries.value.find((entry) => entry.value === props.modelValue))
const triggerText = computed(() =>
  props.modelValue.length === 0
    ? (props.placeholder ?? '')
    : (current.value?.label ?? props.modelValue)
)
const triggerFamilyId = computed(() => findStrudelFlowSampleFamily(props.modelValue).id)

const nativeGroups = computed(() =>
  shownGroups.value
    .filter((group) => group.samples.length > 0)
    .map((group) => ({ label: group.label, options: group.samples }))
)
const nativeOptions = computed(() =>
  props.placeholder === undefined ? [] : [{ value: '', label: props.placeholder }]
)

const placePopover = (): void => {
  const bounds = trigger.value?.getBoundingClientRect()
  if (bounds === undefined) {
    return
  }
  const fitsBelow = bounds.bottom + POPOVER_GAP + POPOVER_HEIGHT <= window.innerHeight
  position.value = {
    left: Math.max(
      POPOVER_GAP,
      Math.min(bounds.left, window.innerWidth - POPOVER_WIDTH - POPOVER_GAP)
    ),
    top: fitsBelow
      ? bounds.bottom + POPOVER_GAP
      : Math.max(POPOVER_GAP, bounds.top - POPOVER_GAP - POPOVER_HEIGHT)
  }
}

const close = (): void => {
  isOpen.value = false
}

const open = (): void => {
  query.value = ''
  activeFamilyId.value = ALL_FAMILIES
  placePopover()
  isOpen.value = true
  void nextTick(() => searchField.value?.focus())
}

const pick = (value: string): void => {
  emit('update:modelValue', value)
  close()
  trigger.value?.focus()
}

const pickFirstMatch = (): void => {
  const [first] = matchingEntries.value
  if (first !== undefined) {
    pick(first.value)
  }
}

const onWindowPointerDown = (event: PointerEvent): void => {
  const target = event.target
  if (
    isOpen.value &&
    target instanceof Node &&
    !popover.value?.contains(target) &&
    !trigger.value?.contains(target)
  ) {
    close()
  }
}

// A touch screen keeps the native list, which phones already present as a full-screen picker.
onMounted(() => {
  isFinePointer.value = window.matchMedia?.('(pointer: fine)').matches === true
  window.addEventListener('pointerdown', onWindowPointerDown)
})
onBeforeUnmount(() => window.removeEventListener('pointerdown', onWindowPointerDown))
</script>

<template>
  <StrudelFlowSelect
    v-if="!isFinePointer"
    :label="label"
    hide-label
    :model-value="modelValue"
    :options="nativeOptions"
    :groups="nativeGroups"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <button
    v-else
    ref="trigger"
    type="button"
    class="strudel-flow-sample-picker__trigger nodrag"
    :class="{ 'strudel-flow-sample-picker__trigger--empty': modelValue.length === 0 }"
    :aria-label="label"
    :title="modelValue"
    aria-haspopup="dialog"
    :aria-expanded="isOpen"
    @click="isOpen ? close() : open()"
  >
    <component
      :is="familyIcon(triggerFamilyId)"
      v-if="modelValue.length > 0"
      class="strudel-flow-sample-picker__icon"
      aria-hidden="true"
    />
    <span class="strudel-flow-sample-picker__trigger-text">{{ triggerText }}</span>
    <ChevronDown class="strudel-flow-sample-picker__chevron" aria-hidden="true" />
  </button>
  <Teleport v-if="isOpen" :to="teleportTarget">
    <div
      ref="popover"
      class="strudel-flow-sample-picker nodrag nowheel"
      role="dialog"
      :aria-label="label"
      :style="{ left: `${position.left}px`, top: `${position.top}px` }"
      @keydown.escape.stop="close"
    >
      <label class="strudel-flow-sample-picker__search">
        <Search class="strudel-flow-sample-picker__icon" aria-hidden="true" />
        <input
          ref="searchField"
          v-model="query"
          type="search"
          placeholder="Search samples"
          aria-label="Search samples"
          spellcheck="false"
          @keydown.enter.prevent="pickFirstMatch"
        />
      </label>
      <div class="strudel-flow-sample-picker__body">
        <ul class="strudel-flow-sample-picker__families" aria-label="Instrument families">
          <li>
            <button
              type="button"
              class="strudel-flow-sample-picker__family"
              :aria-pressed="activeFamilyId === ALL_FAMILIES"
              @click="activeFamilyId = ALL_FAMILIES"
            >
              <component
                :is="familyIcon('other')"
                class="strudel-flow-sample-picker__icon"
                aria-hidden="true"
              />
              <span>All</span>
              <span class="strudel-flow-sample-picker__count">{{ entries.length }}</span>
            </button>
          </li>
          <li v-for="family in families" :key="family.id">
            <button
              type="button"
              class="strudel-flow-sample-picker__family"
              :aria-pressed="activeFamilyId === family.id"
              @click="activeFamilyId = family.id"
            >
              <component
                :is="familyIcon(family.id)"
                class="strudel-flow-sample-picker__icon"
                aria-hidden="true"
              />
              <span>{{ family.label }}</span>
              <span class="strudel-flow-sample-picker__count">{{ family.count }}</span>
            </button>
          </li>
        </ul>
        <div class="strudel-flow-sample-picker__results">
          <p v-if="matchingEntries.length === 0" class="strudel-flow-sample-picker__note">
            No sample matches.
          </p>
          <ul v-else class="strudel-flow-sample-picker__grid" aria-label="Samples">
            <li v-for="entry in shownEntries" :key="entry.value">
              <button
                type="button"
                class="strudel-flow-sample-picker__option"
                :aria-pressed="entry.value === modelValue"
                :title="`${entry.value} · ${entry.group}`"
                @click="pick(entry.value)"
              >
                <component
                  :is="familyIcon(entry.familyId)"
                  class="strudel-flow-sample-picker__icon"
                  aria-hidden="true"
                />
                <span class="strudel-flow-sample-picker__option-text">
                  <span class="strudel-flow-sample-picker__option-label">{{ entry.label }}</span>
                  <span class="strudel-flow-sample-picker__option-group">{{ entry.group }}</span>
                </span>
              </button>
            </li>
          </ul>
          <p
            v-if="matchingEntries.length > shownEntries.length"
            class="strudel-flow-sample-picker__note"
          >
            {{ matchingEntries.length - shownEntries.length }} more; type to narrow the list.
          </p>
        </div>
      </div>
    </div>
  </Teleport>
</template>
