<script setup lang="ts">
import type { LobbyRoom } from '@/types/lobby'
import { GAME_EMOJI, GAME_LABELS } from './constants'

defineProps<{ room: LobbyRoom; isOwn: boolean }>()
const emit = defineEmits<{ join: [room: LobbyRoom]; close: [room: LobbyRoom] }>()
</script>

<template>
  <div class="lb-room-card">
    <div class="lb-room-card__header">
      <span class="lb-room-card__badge">
        {{ GAME_EMOJI[room.game] }} {{ GAME_LABELS[room.game] }}
      </span>
      <span v-if="room.isHidden" class="lb-room-card__hidden">hidden</span>
    </div>
    <p class="lb-room-card__name">{{ room.name }}</p>
    <div class="lb-room-card__footer">
      <div class="lb-room-card__players">
        <span
          v-for="player in room.players"
          :key="player.id"
          class="lb-room-card__dot"
          :style="{ background: player.color }"
          :title="player.name"
        />
        <span class="lb-room-card__count">{{ room.players.length }}</span>
      </div>
      <button
        v-if="isOwn"
        class="lb-room-card__btn lb-room-card__btn--ghost"
        type="button"
        @click="emit('close', room)"
      >
        Close
      </button>
      <button v-else class="lb-room-card__btn" type="button" @click="emit('join', room)">
        Join
      </button>
    </div>
  </div>
</template>

<style scoped>
.lb-room-card {
  border: 2px solid #111;
  border-radius: var(--radius-md);
  padding: var(--spacing-2) var(--spacing-3);
  background: #fff;
  box-shadow: 2px 2px 0 #111;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.lb-room-card__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.lb-room-card__badge {
  font-size: var(--font-size-xs);
  font-weight: 700;
  color: var(--color-muted-foreground);
}

.lb-room-card__hidden {
  font-size: var(--font-size-xs);
  font-weight: 700;
  color: #888;
  padding: 1px var(--spacing-1);
  border: 1px solid #ccc;
  border-radius: 999px;
}

.lb-room-card__name {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: 800;
  color: #111;
}

.lb-room-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-2);
}

.lb-room-card__players {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
}

.lb-room-card__dot {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 50%;
  border: 2px solid #111;
  display: inline-block;
}

.lb-room-card__count {
  font-size: var(--font-size-xs);
  font-weight: 700;
  color: var(--color-muted-foreground);
}

.lb-room-card__btn {
  padding: var(--spacing-1) var(--spacing-2);
  border: 2px solid #111;
  border-radius: 999px;
  background: #111;
  color: #fff;
  font-size: var(--font-size-xs);
  font-weight: 700;
  cursor: pointer;
  box-shadow: 1px 1px 0 #444;
  transition: transform 0.1s ease;
  white-space: nowrap;
}

.lb-room-card__btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 2px 2px 0 #444;
}

.lb-room-card__btn--ghost {
  background: #fff;
  color: #111;
}
</style>
