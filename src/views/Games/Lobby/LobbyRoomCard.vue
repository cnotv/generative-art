<script setup lang="ts">
import { LobbyUIButton } from '@/components/LobbyUI'
import type { LobbyRoom } from '@/types/lobby'
import { GAME_LABELS } from './constants'

defineProps<{ room: LobbyRoom; isOwn: boolean }>()
const emit = defineEmits<{
  join: [room: LobbyRoom]
  toggle: [room: LobbyRoom]
}>()
</script>

<template>
  <div class="lb-room-card" :class="{ 'lb-room-card--own': isOwn }">
    <div class="lb-room-card__info">
      <span class="lb-room-card__game">{{ GAME_LABELS[room.game] }}</span>
      <span class="lb-room-card__host">
        <span class="lb-room-card__dot" :style="{ background: room.players[0]?.color ?? '#888' }" />
        {{ room.hostName }}
        <span class="lb-room-card__count">· {{ room.players.length }}</span>
      </span>
    </div>
    <div class="lb-room-card__actions">
      <LobbyUIButton
        v-if="isOwn"
        variant="ghost"
        :title="room.isHidden ? 'Make public' : 'Hide room'"
        @click="emit('toggle', room)"
      >
        {{ room.isHidden ? 'Show' : 'Hide' }}
      </LobbyUIButton>
      <LobbyUIButton v-else variant="primary" @click="emit('join', room)"> Join </LobbyUIButton>
    </div>
  </div>
</template>

<style scoped>
.lb-room-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-2);
  padding: var(--spacing-2);
  border-radius: var(--radius-md);
  border: 2px solid transparent;
  transition: opacity 0.1s ease;
}

.lb-room-card--own {
  border-color: var(--lui-stroke-faint);
}

.lb-room-card__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.lb-room-card__game {
  font-family: var(--lui-font);
  font-size: var(--lui-text-small);
  font-weight: 800;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.lb-room-card__host {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  font-family: var(--lui-font);
  font-size: var(--lui-text-tiny);
  font-weight: 600;
  color: var(--lui-text-color);
  opacity: 0.7;
}

.lb-room-card__dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  border: 1.5px solid var(--lui-stroke-faint);
  flex-shrink: 0;
}

.lb-room-card__count {
  opacity: 0.7;
}

.lb-room-card__actions {
  flex-shrink: 0;
}
</style>
