<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { LobbyUIButton } from '@/components/LobbyUI'
import '@/assets/styles/lobby-ui.scss'
import type { MgPlayer } from '@/stores/minigolf'
import type { HoleConfig } from './config'

const props = defineProps<{
  playerList: MgPlayer[]
  activeHoles: HoleConfig[]
  isHost: boolean
}>()

const emit = defineEmits<{
  'play-again': []
}>()

const playAgainReference = ref<InstanceType<typeof LobbyUIButton> | null>(null)

onMounted(() => {
  if (!props.isHost) return
  ;(playAgainReference.value?.$el as HTMLElement | undefined)?.focus()
})

const totalScore = (scores: number[]): number => scores.reduce((a, b) => a + b, 0)

const bestTotal = (players: MgPlayer[]): number =>
  Math.min(...players.map((p) => totalScore(p.scores)))
</script>

<template>
  <div class="mg-summary">
    <div class="mg-summary__card">
      <h2 class="mg-summary__title">Final Scores</h2>
      <table class="mg-summary__table">
        <thead>
          <tr>
            <th class="mg-summary__th">Player</th>
            <th v-for="(_, n) in activeHoles" :key="n" class="mg-summary__th">H{{ n + 1 }}</th>
            <th class="mg-summary__th">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="player in playerList"
            :key="player.id"
            class="mg-summary__row"
            :class="{
              'mg-summary__row--winner': totalScore(player.scores) === bestTotal(playerList)
            }"
          >
            <td class="mg-summary__td mg-summary__td--name">
              <span class="mg-summary__dot" :style="{ background: player.color }" />
              {{ player.name }}
            </td>
            <td v-for="(score, i) in player.scores" :key="i" class="mg-summary__td">{{ score }}</td>
            <td class="mg-summary__td mg-summary__td--total">{{ totalScore(player.scores) }}</td>
          </tr>
        </tbody>
      </table>
      <LobbyUIButton v-if="isHost" ref="playAgainReference" @click="emit('play-again')"
        >Play again</LobbyUIButton
      >
      <p v-else class="mg-summary__hint">Waiting for host to restart…</p>
    </div>
  </div>
</template>

<style scoped>
.mg-summary {
  position: absolute;
  inset: 0;
  z-index: var(--z-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(0 0 0 / 0.55);
  padding: var(--spacing-4);
}

.mg-summary__card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  padding: var(--spacing-5) var(--spacing-6);
  align-items: center;
  width: min(560px, 100%);
}

.mg-summary__title {
  font-family: var(--lui-font);
  font-size: var(--lui-text-important);
  font-weight: 900;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.mg-summary__table {
  width: 100%;
  border-collapse: collapse;
}

.mg-summary__th {
  font-family: var(--lui-font);
  font-size: var(--lui-text-tiny);
  font-weight: 700;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: var(--spacing-1) var(--spacing-2);
  text-align: center;
  opacity: 0.7;
}

.mg-summary__td {
  font-family: var(--lui-font);
  font-size: var(--lui-text-small);
  font-weight: 700;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  padding: var(--spacing-1) var(--spacing-2);
  text-align: center;
}

.mg-summary__td--name {
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-1);
}

.mg-summary__row--winner .mg-summary__td {
  color: var(--lui-focus-color);
}

.mg-summary__dot {
  display: inline-block;
  width: 0.65em;
  height: 0.65em;
  border-radius: 50%;
  flex-shrink: 0;
}

.mg-summary__hint {
  font-family: var(--lui-font);
  font-size: var(--lui-text-tiny);
  font-weight: 600;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  opacity: 0.7;
  margin: 0;
}
</style>
