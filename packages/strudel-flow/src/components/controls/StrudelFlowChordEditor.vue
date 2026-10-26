<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'

const props = defineProps<{
  notes: number[]
  noteSlots: number
  noteName: (note: number) => string
  noteLabel: (note: number) => string
}>()

const emit = defineEmits<{
  update: [notes: number[]]
}>()

type DragState = {
  pointerId: number
  startX: number
  degree: number
  target: number
  moved: boolean
  notes: number[]
  slots: number
}

const container = ref<HTMLElement | null>(null)
const drag = ref<DragState | null>(null)
const dragPreview = ref<{ from: number; target: number; position: number } | null>(null)
const noteSlotsArray = computed(() => Array.from({ length: props.noteSlots }, (_, note) => note))

const toggleNote = (note: number): void => {
  emit(
    'update',
    props.notes.includes(note)
      ? props.notes.filter((value) => value !== note)
      : [...props.notes, note].sort((left, right) => left - right)
  )
}

const moveNote = (notes: number[], from: number, to: number): number[] =>
  [...new Set([...notes.filter((note) => note !== from), to])].sort((left, right) => left - right)

const cancelDrag = (): void => {
  drag.value = null
  dragPreview.value = null
}

const onPointerDown = (event: PointerEvent): void => {
  if (!event.isPrimary || event.button !== 0) {
    return
  }
  const target = event.target
  if (!(target instanceof Element)) {
    return
  }
  const button = target.closest<HTMLButtonElement>('button[data-degree]')
  if (button === null) {
    return
  }
  event.preventDefault()
  button.focus()
  const degree = Number(button.dataset.degree)
  drag.value = {
    pointerId: event.pointerId,
    startX: event.clientX,
    degree,
    target: degree,
    moved: false,
    notes: [...props.notes],
    slots: props.noteSlots
  }
  container.value?.setPointerCapture(event.pointerId)
}

const onPointerMove = (event: PointerEvent): void => {
  const current = drag.value
  if (current === null || current.pointerId !== event.pointerId) {
    return
  }
  if (!current.moved && Math.abs(event.clientX - current.startX) < 4) {
    return
  }
  current.moved = true
  const bounds = container.value?.getBoundingClientRect()
  if (bounds === undefined || bounds.width === 0) {
    return
  }
  const position = Math.max(
    0,
    Math.min(
      current.slots - 1,
      current.degree + ((event.clientX - current.startX) / bounds.width) * current.slots
    )
  )
  current.target = Math.round(position)
  dragPreview.value = {
    from: current.degree,
    target: current.target,
    position: ((position + 0.5) / current.slots) * 100
  }
}

const onPointerUp = (event: PointerEvent): void => {
  const current = drag.value
  if (current === null || current.pointerId !== event.pointerId) {
    return
  }
  drag.value = null
  dragPreview.value = null
  if (current.moved) {
    emit('update', moveNote(current.notes, current.degree, current.target))
  } else {
    toggleNote(current.degree)
  }
  container.value?.releasePointerCapture(event.pointerId)
}

const onSlotClick = (note: number, event: MouseEvent): void => {
  if (event.detail === 0) {
    toggleNote(note)
  }
}

const onSlotKeydown = async (event: KeyboardEvent, note: number): Promise<void> => {
  if (!props.notes.includes(note) || !['ArrowLeft', 'ArrowRight'].includes(event.key)) {
    return
  }
  event.preventDefault()
  const target = Math.max(
    0,
    Math.min(props.noteSlots - 1, note + (event.key === 'ArrowRight' ? 1 : -1))
  )
  emit('update', moveNote(props.notes, note, target))
  await nextTick()
  container.value?.querySelector<HTMLButtonElement>(`[data-degree="${target}"]`)?.focus()
}
</script>

<template>
  <div class="strudel-flow-chord-editor">
    <div
      ref="container"
      class="strudel-flow-chord-editor__grid"
      role="group"
      aria-label="Edit chord notes"
      :style="{ gridTemplateColumns: `repeat(${noteSlots}, minmax(0, 1fr))` }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="cancelDrag"
      @lostpointercapture="cancelDrag"
    >
      <button
        v-for="note in noteSlotsArray"
        :key="note"
        type="button"
        class="strudel-flow-chord-editor__slot nodrag"
        :data-degree="note"
        :aria-label="`Scale degree ${note}: ${noteLabel(note)}`"
        :aria-pressed="notes.includes(note)"
        :title="`${note}: ${noteName(note)} · Click to ${
          notes.includes(note) ? 'remove' : 'add'
        }${notes.includes(note) ? ', drag to move' : ''}`"
        @click="onSlotClick(note, $event)"
        @keydown="onSlotKeydown($event, note)"
      >
        <span class="strudel-flow-chord-editor__degree">{{ note }}</span>
        <span
          class="strudel-flow-chord-editor__lane"
          :class="{ 'strudel-flow-chord-editor__lane--target': dragPreview?.target === note }"
        >
          <span
            v-if="notes.includes(note) && dragPreview?.from !== note"
            class="strudel-flow-chord-editor__bar"
          >
            <span class="strudel-flow-chord-editor__bar-dot" />
          </span>
        </span>
        <span class="strudel-flow-chord-editor__name">{{ noteName(note) }}</span>
      </button>
      <span
        v-if="dragPreview !== null"
        class="strudel-flow-chord-editor__preview"
        :style="{ left: `${dragPreview.position}%` }"
        aria-hidden="true"
      >
        <span class="strudel-flow-chord-editor__bar-dot" />
      </span>
    </div>
  </div>
</template>
