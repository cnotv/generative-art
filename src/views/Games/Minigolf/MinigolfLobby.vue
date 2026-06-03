<script setup lang="ts">
import { computed } from 'vue'
import { LobbyUIWizard } from '@/components/LobbyUI'
import '@/assets/styles/lobby-ui.scss'
import type { LobbyConfigField } from '@/types/lobbyWizard'
import type { MgPlayer } from '@/stores/minigolf'
import { MATCHMAKER_ROOM } from './constants'
import { HOLES } from './config'
import { holeToSvgPaths } from './helpers/holePreview'

const SVG_SIZE = 64

const props = defineProps<{
  playerName: string
  playerColor: string
  isHost: boolean
  playerList: MgPlayer[]
  roomId: string
  holeCount: number
  selectedHoles: number[]
}>()

const emit = defineEmits<{
  'update:playerName': [value: string]
  'update:playerColor': [value: string]
  'update:selectedHoles': [value: number[]]
  nameChange: []
  startGame: []
  matchFound: [roomId: string]
  leaveRoom: []
}>()

const configFields = computed((): LobbyConfigField[] => [])

const holePreviews = computed(() =>
  HOLES.map((hole, index) => ({
    index,
    svgData: holeToSvgPaths(hole, SVG_SIZE),
    par: hole.par,
    selected: props.selectedHoles.includes(index)
  }))
)

const toggleHole = (index: number): void => {
  if (!props.isHost) return
  const next = props.selectedHoles.includes(index)
    ? props.selectedHoles.filter((i) => i !== index)
    : [...props.selectedHoles, index].sort((a, b) => a - b)
  emit('update:selectedHoles', next.length > 0 ? next : [index])
}
</script>

<template>
  <LobbyUIWizard
    :player-name="playerName"
    :player-color="playerColor"
    :is-host="isHost"
    :player-list="playerList"
    :room-id="roomId"
    :matchmaker-room="MATCHMAKER_ROOM"
    :config-fields="configFields"
    @update:player-name="emit('update:playerName', $event)"
    @update:player-color="emit('update:playerColor', $event)"
    @name-change="emit('nameChange')"
    @start-game="emit('startGame')"
    @match-found="emit('matchFound', $event)"
    @leave-room="emit('leaveRoom')"
  >
    <template #config>
      <div class="mgl-hole-picker">
        <p class="mgl-hole-picker__label">
          Select holes to play
          <span class="mgl-hole-picker__count">({{ selectedHoles.length }} selected)</span>
        </p>
        <div class="mgl-hole-picker__grid">
          <button
            v-for="preview in holePreviews"
            :key="preview.index"
            class="mgl-hole-picker__item"
            :class="{ 'mgl-hole-picker__item--selected': preview.selected }"
            :disabled="!isHost"
            type="button"
            @click="toggleHole(preview.index)"
          >
            <svg
              :width="SVG_SIZE"
              :height="SVG_SIZE"
              :viewBox="`0 0 ${SVG_SIZE} ${SVG_SIZE}`"
              xmlns="http://www.w3.org/2000/svg"
              class="mgl-hole-picker__svg"
            >
              <path :d="preview.svgData.ground" fill="#4caf50" />
              <path
                v-for="(wall, wi) in preview.svgData.walls"
                :key="wi"
                :d="wall"
                fill="#eeeeee"
              />
              <path :d="preview.svgData.tee" fill="#ff9800" />
              <path :d="preview.svgData.pin" fill="#f44336" />
            </svg>
            <span class="mgl-hole-picker__hole-label"
              >H{{ preview.index + 1 }} · Par {{ preview.par }}</span
            >
          </button>
        </div>
      </div>
    </template>
  </LobbyUIWizard>
</template>

<style scoped>
.mgl-hole-picker {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.mgl-hole-picker__label {
  font-family: var(--lui-font);
  font-size: var(--lui-text-small);
  font-weight: 700;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
}

.mgl-hole-picker__count {
  font-weight: 600;
  opacity: 0.7;
  margin-left: var(--spacing-1);
}

.mgl-hole-picker__grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--spacing-1);
}

.mgl-hole-picker__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-1);
  padding: var(--spacing-1);
  border: 2px solid var(--lui-stroke-faint);
  border-radius: var(--radius-sm);
  background: transparent;
  box-shadow: var(--lui-border-shadow);
  cursor: pointer;
  transition:
    transform 0.1s ease,
    border-color 0.15s ease;
}

.mgl-hole-picker__item:disabled {
  cursor: default;
}

.mgl-hole-picker__item:hover:not(:disabled) {
  transform: translate(-1px, -1px);
}

.mgl-hole-picker__item--selected {
  border-color: var(--lui-stroke);
  box-shadow: var(--lui-border-shadow);
}

.mgl-hole-picker__svg {
  display: block;
  border-radius: var(--radius-xs);
  background: #2a5c2a;
  width: 100%;
  height: auto;
}

.mgl-hole-picker__hole-label {
  font-family: var(--lui-font);
  font-size: var(--lui-text-tiny);
  font-weight: 700;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  white-space: nowrap;
}
</style>
