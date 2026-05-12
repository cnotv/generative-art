<script setup lang="ts">
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
      <button
        v-if="isOwn"
        class="lb-room-card__toggle"
        type="button"
        :title="room.isHidden ? 'Make public' : 'Hide room'"
        @click="emit('toggle', room)"
      >
        {{ room.isHidden ? 'Show' : 'Hide' }}
      </button>
      <button v-else class="lb-room-card__join" type="button" @click="emit('join', room)">
        Join
      </button>
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
  transition: background 0.1s ease;
}

.lb-room-card:hover {
  background: #ffefc0;
}

.lb-room-card--own {
  border-color: #ccc;
}

.lb-room-card__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.lb-room-card__game {
  font-size: var(--font-size-xs);
  font-weight: 800;
  color: #111;
  white-space: nowrap;
}

.lb-room-card__host {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: #555;
}

.lb-room-card__dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  border: 1.5px solid #111;
  flex-shrink: 0;
}

.lb-room-card__count {
  color: var(--color-muted-foreground);
}

.lb-room-card__actions {
  flex-shrink: 0;
}

.lb-room-card__join {
  padding: 2px var(--spacing-2);
  border: 2px solid #111;
  border-radius: 999px;
  background: #111;
  color: #fff;
  font-size: var(--font-size-xs);
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.1s ease;
}

.lb-room-card__join:hover {
  transform: translate(-1px, -1px);
}

.lb-room-card__toggle {
  padding: 2px var(--spacing-1);
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: var(--font-size-sm);
  line-height: 1;
}
</style>
