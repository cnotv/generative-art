<script setup lang="ts">
import type { LobbyPlayer } from '@/types/lobbyWizard'

defineProps<{
  players: LobbyPlayer[]
  isHost: boolean
}>()
</script>

<template>
  <div class="lui-players">
    <span class="lui-players__count">
      {{ players.length }} {{ isHost ? 'ready' : 'in room' }}
    </span>
    <span
      v-for="player in players"
      :key="player.id"
      class="lui-players__dot"
      :style="{ background: player.color }"
      :title="player.name"
    />
  </div>
</template>

<style scoped>
.lui-players {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.lui-players__count {
  font-family: var(--lui-font);
  font-weight: 900;
  font-size: var(--lui-text-medium);
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.lui-players__dot {
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 50%;
  border: 2px solid var(--lui-stroke);
  flex-shrink: 0;
}
</style>
