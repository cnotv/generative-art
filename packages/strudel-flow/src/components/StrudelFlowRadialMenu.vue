<script setup lang="ts">
import { computed, markRaw, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  Activity,
  AudioLines,
  AudioWaveform,
  Clock,
  Code,
  Disc3,
  Drum,
  Grid3x3,
  Music,
  Music2,
  Piano,
  Plus,
  SlidersHorizontal,
  Volume1,
  Wand2,
  Waves,
  X
} from 'lucide-vue-next'
import { STRUDEL_FLOW_NODE_DEFINITIONS } from '../nodeDefinitions'
import type { StrudelFlowNodeKind } from '../types'
import type { Component } from 'vue'

const emit = defineEmits<{
  add: [kind: StrudelFlowNodeKind]
}>()

const MENU_SIZE = 380
const CENTER = MENU_SIZE / 2
const CATEGORY_RADIUS = 146
const ITEM_RADIUS = 76
const ITEM_START_ANGLE = 150
const CATEGORY_META = [
  { label: 'Instruments', category: 'Instruments', icon: markRaw(Piano) },
  { label: 'Effects', category: 'Effects', icon: markRaw(SlidersHorizontal) },
  { label: 'Sounds', category: 'Sounds', icon: markRaw(AudioLines) }
] as const
const NODE_ICONS: Record<StrudelFlowNodeKind, Component> = {
  pad: markRaw(Grid3x3),
  beats: markRaw(Drum),
  chords: markRaw(Music2),
  notes: markRaw(Music),
  samples: markRaw(Disc3),
  code: markRaw(Code),
  voice: markRaw(AudioLines),
  filter: markRaw(SlidersHorizontal),
  delay: markRaw(Clock),
  space: markRaw(Waves),
  level: markRaw(Volume1),
  envelope: markRaw(Activity),
  scope: markRaw(AudioWaveform),
  effect: markRaw(Wand2)
}

const isOpen = ref(false)
const activeCategory = ref(0)
const categories = computed(() =>
  CATEGORY_META.map((meta) => ({
    ...meta,
    items: STRUDEL_FLOW_NODE_DEFINITIONS.filter(
      (definition) => definition.category === meta.category
    )
  }))
)
const activeCategoryData = computed(() => categories.value[activeCategory.value] ?? null)
// The first category sits at the top, as in the reference menu, and the rest follow clockwise.
const categoryStartAngle = computed(() => 90 + 180 / categories.value.length)
const categoryPositions = computed(() =>
  categories.value.map((_, index) =>
    polar(
      CATEGORY_RADIUS,
      categoryStartAngle.value - ((index + 0.5) * 360) / categories.value.length
    )
  )
)
const itemPositions = computed(() => {
  const items = activeCategoryData.value?.items ?? []
  return items.map((_, index) =>
    polar(ITEM_RADIUS, ITEM_START_ANGLE - ((index + 0.5) * 360) / items.length)
  )
})

const polar = (radius: number, angle: number): { x: number; y: number } => {
  const radians = (angle * Math.PI) / 180
  return {
    x: CENTER + radius * Math.cos(radians),
    y: CENTER - radius * Math.sin(radians)
  }
}

const sectorPath = (
  index: number,
  count: number,
  outer: number,
  inner: number,
  startAngle = 180
): string => {
  const slice = 360 / count
  const start = startAngle - index * slice
  const end = start - slice
  const outerStart = polar(outer, start)
  const outerEnd = polar(outer, end)
  const innerStart = polar(inner, start)
  const innerEnd = polar(inner, end)
  const largeArc = slice > 180 ? 1 : 0
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outer} ${outer} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${inner} ${inner} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z'
  ].join(' ')
}

const categorySector = (index: number): string =>
  sectorPath(index, categories.value.length, 178, 112, categoryStartAngle.value)
const itemSector = (index: number): string =>
  activeCategoryData.value === null
    ? ''
    : sectorPath(index, activeCategoryData.value.items.length, 110, 36, ITEM_START_ANGLE)

const positionStyle = (position: { x: number; y: number }): Record<string, string> => ({
  left: `${(position.x / MENU_SIZE) * 100}%`,
  top: `${(position.y / MENU_SIZE) * 100}%`
})

const open = (): void => {
  activeCategory.value = 0
  isOpen.value = true
}

const close = (): void => {
  isOpen.value = false
}

const addNode = (kind: StrudelFlowNodeKind): void => {
  emit('add', kind)
  close()
}

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape' && isOpen.value) {
    close()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

defineExpose({ open })
</script>

<template>
  <button
    v-if="!isOpen"
    type="button"
    class="strudel-flow-radial__trigger nodrag"
    aria-label="Add node"
    title="Add node"
    @click.stop="open"
  >
    <Plus aria-hidden="true" />
  </button>
  <div v-else class="strudel-flow-radial__overlay" @click.self="close">
    <div class="strudel-flow-radial" role="dialog" aria-modal="true" aria-label="Add node">
      <svg
        class="strudel-flow-radial__sectors"
        :viewBox="`0 0 ${MENU_SIZE} ${MENU_SIZE}`"
        aria-hidden="true"
      >
        <path
          v-for="(_, index) in categories"
          :key="`category-${index}`"
          :d="categorySector(index)"
          class="strudel-flow-radial__sector"
          :class="{ 'strudel-flow-radial__sector--active': activeCategory === index }"
        />
        <path
          v-for="(_, index) in activeCategoryData?.items ?? []"
          :key="`item-${index}`"
          :d="itemSector(index)"
          class="strudel-flow-radial__sector strudel-flow-radial__sector--item"
        />
      </svg>
      <button
        v-for="(category, index) in categories"
        :key="category.label"
        type="button"
        class="strudel-flow-radial__category nodrag"
        :class="{ 'strudel-flow-radial__category--active': activeCategory === index }"
        :style="positionStyle(categoryPositions[index] ?? { x: CENTER, y: CENTER })"
        :aria-label="category.label"
        :aria-expanded="activeCategory === index"
        @click="activeCategory = index"
      >
        <component :is="category.icon" class="strudel-flow-radial__icon" aria-hidden="true" />
        <span>{{ category.label }}</span>
      </button>
      <button
        v-for="(item, index) in activeCategoryData?.items ?? []"
        :key="item.kind"
        type="button"
        class="strudel-flow-radial__item nodrag"
        :style="positionStyle(itemPositions[index] ?? { x: CENTER, y: CENTER })"
        :aria-label="`Add ${item.title} node`"
        @click="addNode(item.kind)"
      >
        <component
          :is="NODE_ICONS[item.kind]"
          class="strudel-flow-radial__icon"
          aria-hidden="true"
        />
        <span>{{ item.title }}</span>
      </button>
      <button
        type="button"
        class="strudel-flow-radial__close nodrag"
        aria-label="Close menu"
        title="Close menu"
        @click="close"
      >
        <X aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
