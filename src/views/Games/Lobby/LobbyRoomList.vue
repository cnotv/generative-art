<script setup lang="ts">
import { ref, computed } from 'vue'
import { useLobbyStore } from '@/stores/lobby'
import type { LobbyRoom } from '@/types/lobby'
import type { GameType } from '@/types/lobby'
import { GAME_LABELS, GAME_TYPES } from './constants'
import LobbyRoomCard from './LobbyRoomCard.vue'

const props = defineProps<{ localPeerId: string; ownRoomId: string | null }>()
const emit = defineEmits<{ join: [room: LobbyRoom]; close: [room: LobbyRoom] }>()

const store = useLobbyStore()
const filter = ref<GameType | 'all'>('all')

const rooms = computed(() => {
  const list = Object.values(store.rooms)
  return filter.value === 'all' ? list : list.filter((r) => r.game === filter.value)
})
</script>

<template>
  <div class="lb-rooms">
    <div class="lb-rooms__header">
      <h3 class="lb-rooms__title">Rooms</h3>
      <div class="lb-rooms__filters">
        <button
          class="lb-rooms__filter"
          :class="{ 'lb-rooms__filter--active': filter === 'all' }"
          type="button"
          @click="filter = 'all'"
        >
          All
        </button>
        <button
          v-for="game in GAME_TYPES"
          :key="game"
          class="lb-rooms__filter"
          :class="{ 'lb-rooms__filter--active': filter === game }"
          type="button"
          @click="filter = game"
        >
          {{ GAME_LABELS[game] }}
        </button>
      </div>
    </div>
    <ul v-if="rooms.length" class="lb-rooms__list">
      <li v-for="room in rooms" :key="room.id">
        <LobbyRoomCard
          :room="room"
          :is-own="room.id === ownRoomId"
          @join="emit('join', $event)"
          @close="emit('close', $event)"
        />
      </li>
    </ul>
    <p v-else class="lb-rooms__empty">No open rooms yet.</p>
  </div>
</template>

<style scoped>
.lb-rooms {
  padding: var(--spacing-3);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  overflow-y: auto;
  flex: 1;
}

.lb-rooms__header {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.lb-rooms__title {
  margin: 0;
  font-size: var(--font-size-xs);
  font-weight: 800;
  color: var(--color-muted-foreground);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.lb-rooms__filters {
  display: flex;
  gap: var(--spacing-1);
  flex-wrap: wrap;
}

.lb-rooms__filter {
  padding: 2px var(--spacing-2);
  border: 2px solid #ccc;
  border-radius: 999px;
  background: #fff;
  color: #555;
  font-size: var(--font-size-xs);
  font-weight: 700;
  cursor: pointer;
  transition: all 0.1s ease;
}

.lb-rooms__filter--active {
  border-color: #111;
  background: #111;
  color: #fff;
}

.lb-rooms__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.lb-rooms__empty {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--color-muted-foreground);
}
</style>
