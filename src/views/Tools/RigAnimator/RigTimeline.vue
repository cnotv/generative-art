<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import {
  Play,
  Pause,
  Plus,
  Trash2,
  Copy,
  ClipboardPaste,
  Upload,
  Download,
  Package,
  RotateCcw,
  PersonStanding,
  FoldHorizontal,
  UnfoldHorizontal,
  ChevronDown,
  ChevronUp
} from 'lucide-vue-next'
import IconButton from '@/components/IconButton.vue'
import { Select } from '@/components/ui/select'
import { POSES_FILE_ACCEPT } from './config'
import { RIG_PRESETS } from './presets'
import { computeTimelineTicks } from './timelineTicks'
import { computeSelectionRange, keyframesInRange } from './frameSelection'
import { HAND_POSE_PRESETS } from '@webgamekit/rig'
import type { RecordedPreset } from './useRigRecordedPresets'

interface Properties {
  frame: number
  frameMax: number
  keyframeFrames: number[]
  isPlaying: boolean
  hasClipboard: boolean
  canApplyHandPose: boolean
  recordedPresets: RecordedPreset[]
}

const props = defineProps<Properties>()

const emit = defineEmits<{
  'update:frame': [frame: number]
  'update:frameMax': [frameMax: number]
  addKeyframe: []
  deleteKeyframes: [frames: number[]]
  copyKeyframes: [frames: number[]]
  pasteKeyframes: []
  selectHandPose: [presetName: string]
  moveKeyframes: [frames: number[], deltaFrames: number]
  removeFrameRange: [startFrame: number, endFrame: number]
  insertFrameRange: [atFrame: number, span: number]
  togglePlayback: []
  importPoses: [url: string]
  exportGlb: []
  exportJson: []
  selectPreset: [url: string]
  resetAll: []
}>()

const trackElement = ref<HTMLDivElement | null>(null)
const fileInputElement = ref<HTMLInputElement | null>(null)
const hasKeyframeAtCurrentFrame = computed(() => props.keyframeFrames.includes(props.frame))
const bundledPresetOptions = RIG_PRESETS.map((preset) => ({
  value: preset.url,
  label: preset.name
}))
/** A finished Record Motion take is offered here too, prefixed so `selectPreset` can tell a
 * session recording apart from a bundled preset's URL without a second event. */
const presetOptions = computed(() => [
  ...bundledPresetOptions,
  ...props.recordedPresets.map((preset, index) => ({
    value: `recording:${index}`,
    label: preset.name
  }))
])
const handPoseOptions = Object.keys(HAND_POSE_PRESETS).map((name) => ({ value: name, label: name }))
const ticks = computed(() => computeTimelineTicks(props.frameMax))

const percentFor = (frame: number): number =>
  props.frameMax > 0 ? (frame / props.frameMax) * 100 : 0

const frameFromClientX = (clientX: number): number => {
  const rect = trackElement.value?.getBoundingClientRect()
  if (!rect || rect.width <= 0) return props.frame
  const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
  return Math.round(ratio * props.frameMax)
}

/** The two ends of a drag-select, shift-click or shift-arrow range selection; either being
 * `null` means nothing is selected. `anchor` is whichever end stays put while `active` moves. */
const selectionAnchorFrame = ref<number | null>(null)
const selectionActiveFrame = ref<number | null>(null)
const selectionRange = computed(() =>
  computeSelectionRange(selectionAnchorFrame.value, selectionActiveFrame.value)
)
const selectedKeyframeFrames = computed(() =>
  keyframesInRange(selectionRange.value, props.keyframeFrames)
)
/** What Copy and Delete act on: the current multi-select when it covers any real keyframes,
 * otherwise just the one at the current frame, if there is one. */
const targetFrames = computed(() =>
  selectedKeyframeFrames.value.length > 0
    ? selectedKeyframeFrames.value
    : hasKeyframeAtCurrentFrame.value
      ? [props.frame]
      : []
)

const clearSelection = (): void => {
  selectionAnchorFrame.value = null
  selectionActiveFrame.value = null
}

/** Cut the selected range out of the timeline entirely, shifting everything after it back to
 * close the gap — unlike Delete, which only clears the poses inside the range and leaves the
 * timeline's own length untouched. The selection itself no longer means anything once the
 * frames it covered are gone, so it clears along with the cut. */
const handleRemoveFrameRange = (): void => {
  if (!selectionRange.value) return
  emit('removeFrameRange', selectionRange.value.start, selectionRange.value.end)
  clearSelection()
}

/** Open up blank room the size of the selection at its own start, shifting everything after it
 * later and growing the timeline's own length to fit. */
const handleInsertFrameRange = (): void => {
  if (!selectionRange.value) return
  const span = selectionRange.value.end - selectionRange.value.start + 1
  emit('insertFrameRange', selectionRange.value.start, span)
  clearSelection()
}

/** Hand Pose and Presets sit in a second row, collapsed by default: they are used far less
 * often than the always-visible transport and edit actions, and hiding them keeps the main row
 * from crowding out the track itself. */
const showExtraControls = ref(false)

/** Extend the selection by one frame via Shift+Arrow, starting a new one-frame selection from
 * the current playhead if nothing is selected yet. */
const extendSelectionByFrames = (deltaFrames: number): void => {
  selectionAnchorFrame.value ??= props.frame
  const next = (selectionActiveFrame.value ?? props.frame) + deltaFrames
  selectionActiveFrame.value = Math.min(Math.max(next, 0), props.frameMax)
}

defineExpose({ extendSelectionByFrames })

type DragKind = 'select' | 'keyframe' | 'resize'
let dragKind: DragKind | null = null
/** Whether the current 'select' drag actually moved the pointer: a plain click never does, and
 * releases as a seek-and-clear instead of freezing a (zero-width) selection. */
let selectDragMoved = false
let draggingKeyframeFrame = 0
/** Every frame being dragged along with the marker the pointer actually grabbed: just that one
 * marker normally, or the whole active selection when the drag started on a selected marker. */
let draggingSelectionFrames: number[] = []
let resizeStartClientX = 0
let resizeStartFrameMax = 0

const onWindowPointerMove = (event: PointerEvent): void => {
  if (dragKind === 'select') {
    const frame = frameFromClientX(event.clientX)
    if (frame !== selectionActiveFrame.value) selectDragMoved = true
    selectionActiveFrame.value = frame
    return
  }
  if (dragKind === 'keyframe') {
    const rawNewFrame = frameFromClientX(event.clientX)
    // Clamp so the block's own earliest member never drags past 0, even if the marker the
    // pointer actually grabbed still has room to move further left.
    const minMemberFrame = Math.min(...draggingSelectionFrames)
    const deltaFrames = Math.max(rawNewFrame - draggingKeyframeFrame, -minMemberFrame)
    if (deltaFrames !== 0) {
      emit('moveKeyframes', draggingSelectionFrames, deltaFrames)
      draggingSelectionFrames = draggingSelectionFrames.map((frame) => frame + deltaFrames)
      draggingKeyframeFrame += deltaFrames
    }
    return
  }
  if (dragKind === 'resize') {
    const rect = trackElement.value?.getBoundingClientRect()
    if (!rect) return
    const pixelsPerFrame = rect.width / resizeStartFrameMax
    const deltaFrames = Math.round((event.clientX - resizeStartClientX) / pixelsPerFrame)
    emit('update:frameMax', resizeStartFrameMax + deltaFrames)
  }
}

const stopDrag = (): void => {
  // A 'select' drag that never actually moved was just a plain click: seek there, the same as
  // every click always has, and drop the zero-width selection it would otherwise leave behind.
  if (dragKind === 'select' && !selectDragMoved) {
    if (selectionActiveFrame.value !== null) emit('update:frame', selectionActiveFrame.value)
    clearSelection()
  }
  dragKind = null
  selectDragMoved = false
  window.removeEventListener('pointermove', onWindowPointerMove)
  window.removeEventListener('pointerup', stopDrag)
}

const startDrag = (kind: DragKind): void => {
  dragKind = kind
  window.addEventListener('pointermove', onWindowPointerMove)
  window.addEventListener('pointerup', stopDrag)
}

/**
 * Press and drag anywhere on the ruler or track to grow a range selection live from here to
 * wherever the pointer ends up; releasing without ever moving is a plain click instead, which
 * seeks the playhead there and clears any existing selection — see `stopDrag`. Holding Shift
 * extends the existing selection (or, if none is active yet, one anchored at the current
 * playhead frame) to the clicked frame instead, never seeking and never clearing.
 */
const onTrackPointerDown = (event: PointerEvent): void => {
  const frame = frameFromClientX(event.clientX)
  if (event.shiftKey) {
    selectionAnchorFrame.value ??= props.frame
    selectionActiveFrame.value = frame
    selectDragMoved = true
    startDrag('select')
    return
  }
  selectionAnchorFrame.value = frame
  selectionActiveFrame.value = frame
  selectDragMoved = false
  startDrag('select')
}

/** Click a keyframe marker to jump there; drag it to reposition it, taking the rest of the
 * active selection along when the grabbed marker is part of it. Grabbing one outside the
 * current selection drops that selection first, the same as it always dragged alone. */
const onKeyframePointerDown = (frame: number, event: PointerEvent): void => {
  const isPartOfSelection = selectedKeyframeFrames.value.includes(frame)
  if (!isPartOfSelection) clearSelection()
  draggingKeyframeFrame = frame
  draggingSelectionFrames = isPartOfSelection ? selectedKeyframeFrames.value : [frame]
  emit('update:frame', frame)
  startDrag('keyframe')
  event.stopPropagation()
}

const onResizePointerDown = (event: PointerEvent): void => {
  resizeStartClientX = event.clientX
  resizeStartFrameMax = props.frameMax
  startDrag('resize')
  event.stopPropagation()
}

const onFileChange = (event: Event): void => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('importPoses', URL.createObjectURL(file))
  input.value = ''
}

onUnmounted(stopDrag)
</script>

<template>
  <div class="rig-timeline">
    <div class="rig-timeline__row">
      <IconButton size="sm" :title="isPlaying ? 'Pause' : 'Play'" @click="emit('togglePlayback')">
        <Pause v-if="isPlaying" />
        <Play v-else />
      </IconButton>
      <IconButton size="sm" title="Add keyframe at the current frame" @click="emit('addKeyframe')">
        <Plus />
      </IconButton>
      <IconButton
        size="sm"
        title="Delete the selected keyframes, or the one at the current frame"
        :disabled="targetFrames.length === 0"
        @click="emit('deleteKeyframes', targetFrames)"
      >
        <Trash2 />
      </IconButton>
      <IconButton
        size="sm"
        title="Copy the selected keyframes, or the one at the current frame"
        :disabled="targetFrames.length === 0"
        @click="emit('copyKeyframes', targetFrames)"
      >
        <Copy />
      </IconButton>
      <IconButton
        size="sm"
        title="Paste the copied keyframe(s) starting at the current frame"
        :disabled="!hasClipboard"
        @click="emit('pasteKeyframes')"
      >
        <ClipboardPaste />
      </IconButton>
      <IconButton
        size="sm"
        title="Remove the selected frames entirely, shifting later frames back to close the gap"
        :disabled="!selectionRange"
        @click="handleRemoveFrameRange"
      >
        <FoldHorizontal />
      </IconButton>
      <IconButton
        size="sm"
        title="Insert blank frames the size of the selection, shifting later frames forward"
        :disabled="!selectionRange"
        @click="handleInsertFrameRange"
      >
        <UnfoldHorizontal />
      </IconButton>
      <div class="rig-timeline__scrubber">
        <div class="rig-timeline__ruler" @pointerdown="onTrackPointerDown">
          <span
            v-for="tick in ticks"
            :key="tick"
            class="rig-timeline__tick"
            :style="{ left: `${percentFor(tick)}%` }"
          >
            <span class="rig-timeline__tick-mark" />
            <span class="rig-timeline__tick-label">{{ tick }}</span>
          </span>
        </div>
        <div ref="trackElement" class="rig-timeline__track" @pointerdown="onTrackPointerDown">
          <div
            v-if="selectionRange"
            class="rig-timeline__selection"
            :style="{
              left: `${percentFor(selectionRange.start)}%`,
              width: `${percentFor(selectionRange.end) - percentFor(selectionRange.start)}%`
            }"
          />
          <button
            v-for="keyframeFrame in keyframeFrames"
            :key="keyframeFrame"
            type="button"
            class="rig-timeline__keyframe"
            :class="{
              'rig-timeline__keyframe--current': keyframeFrame === frame,
              'rig-timeline__keyframe--selected': selectedKeyframeFrames.includes(keyframeFrame)
            }"
            :style="{ left: `${percentFor(keyframeFrame)}%` }"
            :title="`Pose @ frame ${keyframeFrame}`"
            @pointerdown="onKeyframePointerDown(keyframeFrame, $event)"
          />
          <div class="rig-timeline__playhead" :style="{ left: `${percentFor(frame)}%` }" />
          <div
            class="rig-timeline__resize-handle"
            title="Drag to extend or shrink the frame range"
            @pointerdown="onResizePointerDown"
          />
        </div>
      </div>
      <input
        ref="fileInputElement"
        type="file"
        :accept="POSES_FILE_ACCEPT"
        class="rig-timeline__hidden-file-input"
        @change="onFileChange"
      />
      <IconButton size="sm" title="Import poses (JSON)" @click="fileInputElement?.click()">
        <Upload />
      </IconButton>
      <IconButton size="sm" title="Export poses (JSON)" @click="emit('exportJson')">
        <Download />
      </IconButton>
      <IconButton size="sm" title="Export animated model (GLB)" @click="emit('exportGlb')">
        <Package />
      </IconButton>
      <IconButton size="sm" title="Reset every keyframe" @click="emit('resetAll')">
        <RotateCcw />
      </IconButton>
      <IconButton
        size="sm"
        :title="showExtraControls ? 'Hide hand pose and presets' : 'Show hand pose and presets'"
        :active="showExtraControls"
        @click="showExtraControls = !showExtraControls"
      >
        <ChevronUp v-if="showExtraControls" />
        <ChevronDown v-else />
      </IconButton>
    </div>
    <div v-if="showExtraControls" class="rig-timeline__row rig-timeline__row--extra">
      <div class="rig-timeline__hand-pose">
        <Select
          placeholder="Hand Pose"
          :options="handPoseOptions"
          :disabled="!canApplyHandPose"
          @update:model-value="emit('selectHandPose', $event)"
        />
      </div>
      <div class="rig-timeline__presets">
        <Select
          placeholder="Presets"
          :options="presetOptions"
          @update:model-value="emit('selectPreset', $event)"
        >
          <template #icon>
            <PersonStanding class="h-4 w-4" />
          </template>
        </Select>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rig-timeline {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  min-height: var(--rig-timeline-height);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-3);
  background-color: var(--color-background);
  border-top: 1px solid var(--color-border);
  z-index: calc(var(--z-overlay) + 1);

  /* Dragging the ruler, the track or a keyframe marker sweeps across the ticks and their
     text labels; without this every drag also selects that text like a click-drag on a
     paragraph would. */
  user-select: none;
}

.rig-timeline__row {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

/* Hand Pose and Presets, toggled open on demand rather than always taking up room in the
   main row: a thin rule separates it from the transport/edit row above it. */
.rig-timeline__row--extra {
  padding-top: var(--spacing-2);
  border-top: 1px solid var(--color-border);
}

.rig-timeline__scrubber {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.rig-timeline__ruler {
  position: relative;
  height: var(--spacing-4);
  cursor: pointer;
}

.rig-timeline__tick {
  position: absolute;
  top: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  transform: translateX(-50%);
  pointer-events: none;
}

.rig-timeline__tick-mark {
  width: 1px;
  height: var(--spacing-1);
  background: var(--color-border);
}

.rig-timeline__tick-label {
  font-size: var(--font-size-xs);
  color: var(--color-muted-foreground);
  font-family: var(--font-mono);
  line-height: 1;
}

.rig-timeline__track {
  position: relative;
  height: var(--spacing-6);
  background: var(--color-secondary);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

/* Painted first in the track, so every keyframe marker, the playhead and the resize handle —
   all later siblings in the same stacking context — sit visibly on top of it. */
.rig-timeline__selection {
  position: absolute;
  top: 0;
  height: 100%;
  background: var(--color-perf-bad);
  opacity: 0.25;
  pointer-events: none;
}

.rig-timeline__keyframe {
  position: absolute;
  top: 50%;
  width: var(--spacing-2);
  height: var(--spacing-2);
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  transform: translate(-50%, -50%) rotate(45deg);
  cursor: grab;
}

.rig-timeline__keyframe:active {
  cursor: grabbing;
}

.rig-timeline__keyframe--current {
  background: var(--color-perf-bad);
}

.rig-timeline__keyframe--selected {
  box-shadow: 0 0 0 2px var(--color-perf-bad);
}

.rig-timeline__playhead {
  position: absolute;
  top: 0;
  left: 0;
  width: 2px;
  height: 100%;
  background: var(--color-perf-bad);
  pointer-events: none;
}

.rig-timeline__resize-handle {
  position: absolute;
  top: 0;
  right: calc(var(--spacing-1) * -1);
  width: var(--spacing-2);
  height: 100%;
  cursor: ew-resize;
}

.rig-timeline__hand-pose {
  width: 8rem;
  flex-shrink: 0;
}

.rig-timeline__presets {
  flex-shrink: 0;
}

.rig-timeline__hidden-file-input {
  display: none;
}
</style>
