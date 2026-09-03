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
  RotateCcw
} from 'lucide-vue-next'
import IconButton from '@/components/IconButton.vue'
import { Select } from '@/components/ui/select'
import { POSES_FILE_ACCEPT } from './config'
import { RIG_PRESETS } from './presets'
import { computeTimelineTicks } from './timelineTicks'

interface Properties {
  frame: number
  frameMax: number
  keyframeFrames: number[]
  isPlaying: boolean
  hasClipboard: boolean
}

const props = defineProps<Properties>()

const emit = defineEmits<{
  'update:frame': [frame: number]
  'update:frameMax': [frameMax: number]
  addKeyframe: []
  deleteKeyframe: []
  copyKeyframe: []
  pasteKeyframe: []
  moveKeyframe: [oldFrame: number, newFrame: number]
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
const presetOptions = RIG_PRESETS.map((preset) => ({ value: preset.url, label: preset.name }))
const ticks = computed(() => computeTimelineTicks(props.frameMax))

const percentFor = (frame: number): number =>
  props.frameMax > 0 ? (frame / props.frameMax) * 100 : 0

const frameFromClientX = (clientX: number): number => {
  const rect = trackElement.value?.getBoundingClientRect()
  if (!rect || rect.width <= 0) return props.frame
  const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
  return Math.round(ratio * props.frameMax)
}

type DragKind = 'scrub' | 'keyframe' | 'resize'
let dragKind: DragKind | null = null
let draggingKeyframeFrame = 0
let resizeStartClientX = 0
let resizeStartFrameMax = 0

const onWindowPointerMove = (event: PointerEvent): void => {
  if (dragKind === 'scrub') {
    emit('update:frame', frameFromClientX(event.clientX))
    return
  }
  if (dragKind === 'keyframe') {
    const newFrame = frameFromClientX(event.clientX)
    if (newFrame !== draggingKeyframeFrame) {
      emit('moveKeyframe', draggingKeyframeFrame, newFrame)
      draggingKeyframeFrame = newFrame
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
  dragKind = null
  window.removeEventListener('pointermove', onWindowPointerMove)
  window.removeEventListener('pointerup', stopDrag)
}

const startDrag = (kind: DragKind): void => {
  dragKind = kind
  window.addEventListener('pointermove', onWindowPointerMove)
  window.addEventListener('pointerup', stopDrag)
}

/** Click or drag anywhere on the track to scrub the playhead to that frame. */
const onTrackPointerDown = (event: PointerEvent): void => {
  emit('update:frame', frameFromClientX(event.clientX))
  startDrag('scrub')
}

/** Click a keyframe marker to jump there; drag it to reposition it. */
const onKeyframePointerDown = (frame: number, event: PointerEvent): void => {
  draggingKeyframeFrame = frame
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
    <IconButton size="sm" :title="isPlaying ? 'Pause' : 'Play'" @click="emit('togglePlayback')">
      <Pause v-if="isPlaying" />
      <Play v-else />
    </IconButton>
    <IconButton size="sm" title="Add keyframe at the current frame" @click="emit('addKeyframe')">
      <Plus />
    </IconButton>
    <IconButton
      size="sm"
      title="Delete the keyframe at the current frame"
      :disabled="!hasKeyframeAtCurrentFrame"
      @click="emit('deleteKeyframe')"
    >
      <Trash2 />
    </IconButton>
    <IconButton
      size="sm"
      title="Copy the pose at the current frame"
      :disabled="!hasKeyframeAtCurrentFrame"
      @click="emit('copyKeyframe')"
    >
      <Copy />
    </IconButton>
    <IconButton
      size="sm"
      title="Paste the copied pose at the current frame"
      :disabled="!hasClipboard"
      @click="emit('pasteKeyframe')"
    >
      <ClipboardPaste />
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
        <button
          v-for="keyframeFrame in keyframeFrames"
          :key="keyframeFrame"
          type="button"
          class="rig-timeline__keyframe"
          :class="{ 'rig-timeline__keyframe--current': keyframeFrame === frame }"
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
    <div class="rig-timeline__presets">
      <Select
        placeholder="Presets"
        :options="presetOptions"
        @update:model-value="emit('selectPreset', $event)"
      />
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
  </div>
</template>

<style scoped>
.rig-timeline {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-3);
  background-color: var(--color-background);
  border-top: 1px solid var(--color-border);
  z-index: calc(var(--z-overlay) + 1);
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

.rig-timeline__presets {
  width: 8rem;
  flex-shrink: 0;
}

.rig-timeline__hidden-file-input {
  display: none;
}
</style>
