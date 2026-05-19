<script setup lang="ts">
import { computed } from 'vue'
import GameLobbyWizard from '@/components/GameLobbyWizard.vue'
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
  <GameLobbyWizard
    :player-name="playerName"
    :player-color="playerColor"
    :is-host="isHost"
    :player-list="playerList"
    :room-id="roomId"
    :matchmaker-room="MATCHMAKER_ROOM"
    accent-color="var(--mg-green)"
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
  </GameLobbyWizard>
</template>

<style scoped>
.mgl-hole-picker {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.mgl-hole-picker__label {
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--game-ink);
  margin: 0;
}

.mgl-hole-picker__count {
  font-weight: 600;
  color: var(--game-ink-muted);
  margin-left: var(--spacing-1);
}

.mgl-hole-picker__grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--spacing-1);
  overflow: hidden;
}

.mgl-hole-picker__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-1);
  padding: var(--spacing-1);
  border: 2px solid var(--game-border);
  border-radius: var(--radius-sm);
  background: var(--game-surface-subtle);
  box-shadow: 2px 2px 0 var(--game-border);
  cursor: pointer;
  transition:
    transform 0.1s ease,
    box-shadow 0.1s ease;
}

.mgl-hole-picker__item:disabled {
  cursor: default;
}

.mgl-hole-picker__item:hover:not(:disabled) {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 var(--game-border);
}

.mgl-hole-picker__item--selected {
  border-color: var(--mg-green, #4caf50);
  background: color-mix(in srgb, var(--mg-green, #4caf50) 20%, var(--game-surface-subtle));
  box-shadow: 2px 2px 0 var(--mg-green, #4caf50);
}

.mgl-hole-picker__svg {
  display: block;
  border-radius: var(--radius-xs);
  background: #2a5c2a;
  width: 100%;
  height: auto;
}

.mgl-hole-picker__hole-label {
  font-size: var(--font-size-xs);
  font-weight: 700;
  color: var(--game-ink);
  white-space: nowrap;
}
</style>
