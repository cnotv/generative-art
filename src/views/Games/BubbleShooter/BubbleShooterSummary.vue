<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { LobbyUIButton } from '@/components/LobbyUI'
import GameScores from '@/components/GameScores.vue'
import type { BsPlayer } from '@/stores/bubbleShooter'

const props = defineProps<{
  playerList: BsPlayer[]
  winnerId: string | null
  localPeerId: string
  isHost: boolean
  highScore?: number
}>()

const emit = defineEmits<{
  restart: []
}>()

const playAgainReference = ref<InstanceType<typeof LobbyUIButton> | null>(null)

onMounted(() => {
  if (!props.isHost) return
  ;(playAgainReference.value?.$el as HTMLElement | undefined)?.focus()
})
</script>

<template>
  <GameScores variant="transparent" :title="winnerId === localPeerId ? 'You win!' : 'Game over!'">
    <ul class="bs-summary__scores">
      <li
        v-for="(player, index) in playerList"
        :key="player.id"
        class="bs-summary__row"
        :class="{ 'bs-summary__row--winner': player.id === winnerId }"
      >
        <span class="bs-summary__rank">{{ index + 1 }}</span>
        <span class="bs-summary__dot" :style="{ background: player.color }" />
        <span class="bs-summary__name">{{ player.name }}</span>
        <span class="bs-summary__pts">{{ player.score }} pts</span>
      </li>
    </ul>

    <p v-if="highScore && highScore > 0" class="bs-summary__best">
      Personal best: {{ highScore }} pts
    </p>

    <template #actions>
      <LobbyUIButton v-if="isHost" ref="playAgainReference" variant="cta" @click="emit('restart')">
        Play again
      </LobbyUIButton>
      <p v-else class="bs-summary__waiting">Waiting for host to restart…</p>
    </template>
  </GameScores>
</template>

<style scoped>
.bs-summary__scores {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  width: 100%;
}

.bs-summary__row {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-3);
}

.bs-summary__row--winner .bs-summary__name,
.bs-summary__row--winner .bs-summary__pts {
  color: var(--lui-focus-color);
}

.bs-summary__rank {
  font-family: var(--lui-font);
  font-size: var(--lui-text-small);
  font-weight: 800;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  min-width: 1.25rem;
  text-align: center;
  opacity: 0.7;
}

.bs-summary__dot {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
  flex-shrink: 0;
}

.bs-summary__name {
  flex: 1;
  font-family: var(--lui-font);
  font-size: var(--lui-text-small);
  font-weight: 700;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  text-align: left;
}

.bs-summary__pts {
  font-family: var(--lui-font);
  font-size: var(--lui-text-medium);
  font-weight: 800;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
}

.bs-summary__waiting {
  font-family: var(--lui-font);
  font-size: var(--lui-text-tiny);
  font-weight: 600;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  opacity: 0.7;
  margin: 0;
}

.bs-summary__best {
  font-family: var(--lui-font);
  font-size: var(--lui-text-small);
  font-weight: 700;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  opacity: 0.7;
  margin: 0;
}
</style>
