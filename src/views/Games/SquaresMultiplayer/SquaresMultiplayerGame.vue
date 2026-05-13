<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { WmClaimedWord } from '@/stores/squaresMultiplayer'
import { dictionaryGetDefinition } from '@webgamekit/dictionary'
import { GRID_SIZE } from './constants'
import { scoreWord } from './squaresMultiplayerUtilities'

type WordSlot = { word: string; claim: WmClaimedWord | null }
type WordGroup = { length: number; slots: WordSlot[]; foundCount: number }

const props = defineProps<{
  grid: string[][]
  validWords: string[]
  claimedWords: WmClaimedWord[]
  players: Record<string, { name: string; color: string }>
  localPeerId: string
  roundNumber: number
  totalRounds: number
  timeLeft: number | null
}>()

const emit = defineEmits<{
  submitWord: [word: string]
}>()

const collapsedGroups = ref(new Set<number>())

const toggleGroup = (length: number): void => {
  const next = new Set(collapsedGroups.value)
  if (next.has(length)) next.delete(length)
  else next.add(length)
  collapsedGroups.value = next
}

const TOOLTIP_MAX_WIDTH = 288
const TOOLTIP_MARGIN = 8

const clampTooltip = (event: PointerEvent): void => {
  const slot = event.currentTarget as HTMLElement
  const rect = slot.getBoundingClientRect()
  const center = rect.left + rect.width / 2
  const halfTooltip = Math.min(TOOLTIP_MAX_WIDTH, window.innerWidth - TOOLTIP_MARGIN * 2) / 2
  const overflow =
    center - halfTooltip < TOOLTIP_MARGIN
      ? TOOLTIP_MARGIN - (center - halfTooltip)
      : center + halfTooltip > window.innerWidth - TOOLTIP_MARGIN
        ? window.innerWidth - TOOLTIP_MARGIN - (center + halfTooltip)
        : 0
  slot.style.setProperty('--tt-offset', `${overflow}px`)
}

const selectedPath = ref<Array<[number, number]>>([])
const isSelecting = ref(false)
const lastFlash = ref<{ word: string; found: boolean } | null>(null)
const gridReference = ref<HTMLElement | null>(null)
const cellElements = ref<(HTMLElement | null)[][]>(
  Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null))
)

const claimedSet = computed(() => new Set(props.claimedWords.map((cw) => cw.word.toUpperCase())))

const wordGroups = computed((): WordGroup[] => {
  const grouped = props.validWords.reduce<Record<number, WordSlot[]>>((accumulator, word) => {
    const length_ = word.length
    const claim =
      props.claimedWords.find((cw) => cw.word.toUpperCase() === word.toUpperCase()) ?? null
    return { ...accumulator, [length_]: [...(accumulator[length_] ?? []), { word, claim }] }
  }, {})
  return Object.entries(grouped)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([length, slots]) => ({
      length: Number(length),
      slots,
      foundCount: slots.filter((s) => s.claim !== null).length
    }))
})

const remainingCount = computed(() =>
  wordGroups.value.reduce((sum, group) => sum + group.slots.length - group.foundCount, 0)
)

const currentWord = computed(() =>
  selectedPath.value.map(([r, c]) => props.grid[r]?.[c] ?? '').join('')
)

const isInPath = (row: number, col: number): boolean =>
  selectedPath.value.some(([r, c]) => r === row && c === col)

const pathIndex = (row: number, col: number): number =>
  selectedPath.value.findIndex(([r, c]) => r === row && c === col)

const isAdjacent = (r1: number, c1: number, r2: number, c2: number): boolean =>
  Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1 && !(r1 === r2 && c1 === c2)

const setCellReference = (element: Element | null, row: number, col: number): void => {
  if (!cellElements.value[row]) return
  cellElements.value[row][col] = element as HTMLElement | null
}

const getCellCenter = (row: number, col: number): { x: number; y: number } | null => {
  const grid = gridReference.value
  const cell = cellElements.value[row]?.[col]
  if (!grid || !cell) return null
  const gridRect = grid.getBoundingClientRect()
  const cellRect = cell.getBoundingClientRect()
  return {
    x: cellRect.left - gridRect.left + cellRect.width / 2,
    y: cellRect.top - gridRect.top + cellRect.height / 2
  }
}

const svgLines = computed(() => {
  const path = selectedPath.value
  if (path.length < 2) return []
  return path.slice(0, -1).flatMap((_, i) => {
    const from = getCellCenter(path[i][0], path[i][1])
    const to = getCellCenter(path[i + 1][0], path[i + 1][1])
    if (!from || !to) return []
    return [{ x1: from.x, y1: from.y, x2: to.x, y2: to.y, key: String(i) }]
  })
})

const startSelection = (row: number, col: number): void => {
  isSelecting.value = true
  selectedPath.value = [[row, col]]
}

const extendSelection = (row: number, col: number): void => {
  if (!isSelecting.value) return
  if (isInPath(row, col)) return
  const last = selectedPath.value[selectedPath.value.length - 1]
  if (!last || !isAdjacent(last[0], last[1], row, col)) return
  selectedPath.value = [...selectedPath.value, [row, col]]
}

let flashTimer: ReturnType<typeof setTimeout> | null = null

const endSelection = (): void => {
  if (!isSelecting.value) return
  isSelecting.value = false
  const word = currentWord.value.toUpperCase()

  if (word.length >= 3) {
    const isValid = props.validWords.some((w) => w.toUpperCase() === word)
    const alreadyClaimed = claimedSet.value.has(word)

    if (isValid && !alreadyClaimed) {
      lastFlash.value = { word, found: true }
      emit('submitWord', word)
    } else {
      lastFlash.value = { word: isValid ? `${word} already found` : word, found: false }
    }

    if (flashTimer) clearTimeout(flashTimer)
    flashTimer = setTimeout(() => {
      lastFlash.value = null
    }, 1200)
  }

  selectedPath.value = []
}

const handlePointerDown = (event: PointerEvent, row: number, col: number): void => {
  event.preventDefault()
  startSelection(row, col)
}

const handlePointerEnter = (row: number, col: number): void => {
  extendSelection(row, col)
}

const handleTouchMove = (event: TouchEvent): void => {
  event.preventDefault()
  const touch = event.touches[0]
  const element = document.elementFromPoint(touch.clientX, touch.clientY)
  if (!element) return
  const row = Number((element as HTMLElement).dataset['row'])
  const col = Number((element as HTMLElement).dataset['col'])
  if (Number.isNaN(row) || Number.isNaN(col)) return
  extendSelection(row, col)
}

onMounted(() => {
  window.addEventListener('pointerup', endSelection)
  gridReference.value?.addEventListener('touchmove', handleTouchMove, { passive: false })
})

onUnmounted(() => {
  window.removeEventListener('pointerup', endSelection)
  gridReference.value?.removeEventListener('touchmove', handleTouchMove)
  if (flashTimer) clearTimeout(flashTimer)
})
</script>

<template>
  <section class="wm-game">
    <div class="wm-game__banner">
      <span class="wm-game__banner-meta">Round {{ roundNumber }} / {{ totalRounds }}</span>
      <span
        v-if="timeLeft !== null"
        class="wm-game__banner-timer"
        :class="{ 'wm-game__banner-timer--urgent': timeLeft <= 10 }"
      >
        ⏱ {{ timeLeft }}s
      </span>
    </div>

    <div class="wm-game__groups">
      <div v-for="group in wordGroups" :key="group.length" class="wm-game__group">
        <button class="wm-game__group-label" type="button" @click="toggleGroup(group.length)">
          <span
            class="wm-game__group-chevron"
            :class="{ 'wm-game__group-chevron--open': !collapsedGroups.has(group.length) }"
            >›</span
          >
          {{ group.length }} letters
          <span class="wm-game__group-count">{{ group.foundCount }}/{{ group.slots.length }}</span>
          <span class="wm-game__group-pts">{{ scoreWord('_'.repeat(group.length)) }}pt</span>
        </button>
        <div v-if="!collapsedGroups.has(group.length)" class="wm-game__group-slots">
          <div
            v-for="slot in group.slots.filter((s) => s.claim !== null)"
            :key="slot.word"
            class="wm-game__slot wm-game__slot--found"
            @pointerenter="clampTooltip"
          >
            <span
              class="wm-game__slot-dot"
              :style="{ background: players[slot.claim!.playerId]?.color ?? '#888' }"
            />
            <span class="wm-game__slot-word">{{ slot.word.toLowerCase() }}</span>
            <span v-if="dictionaryGetDefinition(slot.word)" class="wm-game__slot-tooltip">{{
              dictionaryGetDefinition(slot.word)
            }}</span>
          </div>
          <span v-if="group.foundCount === 0" class="wm-game__group-empty">no words found yet</span>
        </div>
      </div>
    </div>

    <div class="wm-game__grid-wrapper" ref="gridReference">
      <svg class="wm-game__svg" aria-hidden="true">
        <line
          v-for="line in svgLines"
          :key="line.key"
          :x1="line.x1"
          :y1="line.y1"
          :x2="line.x2"
          :y2="line.y2"
          class="wm-game__svg-line"
        />
      </svg>

      <div class="wm-game__grid">
        <div v-for="(row, rowIndex) in grid" :key="rowIndex" class="wm-game__grid-row">
          <div
            v-for="(letter, colIndex) in row"
            :key="colIndex"
            :ref="(el) => setCellReference(el as Element, rowIndex, colIndex)"
            class="wm-game__grid-cell"
            :class="{
              'wm-game__grid-cell--selected': isInPath(rowIndex, colIndex),
              'wm-game__grid-cell--first': pathIndex(rowIndex, colIndex) === 0
            }"
          >
            {{ letter }}
            <span
              class="wm-game__grid-cell-hit"
              :data-row="rowIndex"
              :data-col="colIndex"
              @pointerdown="handlePointerDown($event, rowIndex, colIndex)"
              @pointerenter="handlePointerEnter(rowIndex, colIndex)"
              @touchstart.prevent="startSelection(rowIndex, colIndex)"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="wm-game__current-word">
      <span v-if="currentWord" class="wm-game__current-word-text">{{ currentWord }}</span>
      <span v-else class="wm-game__current-word-hint">drag letters to form a word</span>
    </div>

    <div
      v-if="lastFlash"
      class="wm-game__flash"
      :class="lastFlash.found ? 'wm-game__flash--found' : 'wm-game__flash--miss'"
    >
      {{ lastFlash.found ? `✓ ${lastFlash.word}` : `✗ ${lastFlash.word}` }}
    </div>
  </section>
</template>

<style scoped>
.wm-game {
  grid-area: main;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-3);
  min-height: 0;
  overflow: auto;
  user-select: none;
}

.wm-game__banner {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-2) var(--spacing-4);
  background: var(--game-surface-subtle);
  border: 3px solid var(--game-border);
  border-radius: 999px;
  box-shadow: 3px 3px 0 var(--game-border);
  font-weight: 700;
  color: var(--game-ink);
}

.wm-game__banner-meta {
  font-size: var(--font-size-sm);
}

.wm-game__banner-timer {
  font-size: var(--font-size-sm);
  font-weight: 800;
}

.wm-game__banner-timer--urgent {
  color: #d32f2f;
  animation: wm-pulse 0.5s ease-in-out infinite alternate;
}

@keyframes wm-pulse {
  from {
    opacity: 1;
  }
  to {
    opacity: 0.5;
  }
}

.wm-game__grid-wrapper {
  position: relative;
  display: inline-block;
}

.wm-game__svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
}

.wm-game__svg-line {
  stroke: var(--ws-green);
  stroke-width: 6;
  stroke-linecap: round;
  opacity: 0.7;
}

.wm-game__grid {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  position: relative;
}

.wm-game__grid-row {
  display: flex;
  gap: var(--spacing-3);
}

.wm-game__grid-cell {
  width: 3rem;
  height: 3rem;
  border: 3px solid var(--game-border);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: 900;
  color: var(--game-ink);
  background: var(--game-surface-subtle);
  box-shadow: 2px 2px 0 var(--game-border);
  text-transform: uppercase;
  touch-action: none;
  transition:
    background 0.08s ease,
    transform 0.08s ease;
  position: relative;
}

/* Invisible hit zone — smaller than the tile to create dead space between adjacent cells */
.wm-game__grid-cell-hit {
  position: absolute;
  inset: 20%;
  cursor: pointer;
  touch-action: none;
}

.wm-game__grid-cell--selected {
  background: var(--ws-green);
  color: #fff;
  border-color: #2e7d32;
  box-shadow: 2px 2px 0 #2e7d32;
  transform: scale(1.05);
}

.wm-game__grid-cell--first {
  background: #2e7d32;
  color: #fff;
  border-color: #1b5e20;
  box-shadow: 2px 2px 0 #1b5e20;
}

.wm-game__current-word {
  min-height: 2.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wm-game__current-word-text {
  font-size: 1.5rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  color: var(--game-ink);
  text-transform: uppercase;
  padding: var(--spacing-1) var(--spacing-3);
  background: var(--game-surface-subtle);
  border: 3px solid var(--game-border);
  border-radius: 999px;
  box-shadow: 3px 3px 0 var(--game-border);
}

.wm-game__current-word-hint {
  font-size: var(--font-size-sm);
  color: var(--game-border-secondary);
  font-style: italic;
}

.wm-game__flash {
  font-size: var(--font-size-sm);
  font-weight: 700;
  padding: var(--spacing-1) var(--spacing-3);
  border-radius: 999px;
  border: 2px solid var(--game-border);
  animation: wm-fade-in 0.1s ease;
}

@keyframes wm-fade-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.wm-game__flash--found {
  background: var(--ws-green);
  color: #fff;
}

.wm-game__flash--miss {
  background: var(--game-msg-error-bg);
  color: #d32f2f;
}

.wm-game__groups {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  width: 100%;
}

.wm-game__group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.wm-game__group-label {
  font-size: var(--font-size-xs);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--game-ink-medium);
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  background: var(--game-surface-subtle);
  border: 2px solid var(--game-border-light);
  border-radius: var(--radius-sm);
  padding: var(--spacing-1) var(--spacing-2);
  cursor: pointer;
  width: 100%;
  text-align: left;
  font-family: inherit;
  transition: background 0.1s ease;
}

.wm-game__group-label:hover {
  background: var(--game-surface-dim);
}

.wm-game__group-chevron {
  font-size: 1rem;
  line-height: 1;
  transition: transform 0.15s ease;
  display: inline-block;
  transform: rotate(0deg);
}

.wm-game__group-chevron--open {
  transform: rotate(90deg);
}

.wm-game__group-count {
  font-size: var(--font-size-xs);
  font-weight: 700;
  background: var(--game-surface-dim);
  border-radius: 999px;
  padding: 0 var(--spacing-1);
  color: var(--game-ink-medium);
}

.wm-game__group-pts {
  font-size: var(--font-size-xs);
  font-weight: 700;
  background: var(--ws-green);
  color: #fff;
  border-radius: 999px;
  padding: 0 var(--spacing-1);
  margin-left: auto;
}

.wm-game__group-slots {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-1);
  padding: var(--spacing-1) 0;
}

.wm-game__group-empty {
  font-size: var(--font-size-xs);
  color: var(--game-border-secondary);
  font-style: italic;
  padding: var(--spacing-1) var(--spacing-2);
}

.wm-game__slot {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-1);
  padding: var(--spacing-1) var(--spacing-2);
  border: 2px solid var(--ws-green);
  border-radius: 999px;
  font-size: var(--font-size-sm);
  font-weight: 700;
  background: var(--wm-bg);
}

.wm-game__slot-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  flex-shrink: 0;
  border: 1.5px solid var(--game-border);
}

.wm-game__slot-word {
  color: var(--game-ink);
  letter-spacing: 0.04em;
}

.wm-game__slot-tooltip {
  display: none;
  position: absolute;
  bottom: calc(100% + 6px);
  left: calc(50% + var(--tt-offset, 0px));
  transform: translateX(-50%);
  background: var(--game-ink);
  color: #fff;
  font-size: var(--font-size-xs);
  font-weight: 500;
  font-style: italic;
  line-height: 1.4;
  padding: var(--spacing-1) var(--spacing-2);
  border-radius: var(--radius-sm);
  white-space: normal;
  width: max-content;
  max-width: 18rem;
  text-align: center;
  pointer-events: none;
  z-index: 10;
}

.wm-game__slot-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: calc(50% - var(--tt-offset, 0px));
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: var(--game-border);
}

.wm-game__slot:hover .wm-game__slot-tooltip,
.wm-game__slot:focus-within .wm-game__slot-tooltip {
  display: block;
}

@media (max-width: 720px) {
  .wm-game__grid-cell {
    width: 2.5rem;
    height: 2.5rem;
    font-size: 1rem;
  }

  .wm-game__current-word-text {
    font-size: 1.25rem;
  }
}
</style>
