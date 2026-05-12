<script setup lang="ts">
import { computed } from 'vue'
import { useLobbyStore } from '@/stores/lobby'
import type { LobbyRoom } from '@/types/lobby'
import LobbyRoomCard from './LobbyRoomCard.vue'

const props = defineProps<{ localPeerId: string; ownRoomId: string | null }>()
const emit = defineEmits<{ join: [room: LobbyRoom]; toggle: [room: LobbyRoom] }>()

const store = useLobbyStore()
const rooms = computed(() => Object.values(store.rooms))
</script>

<template>
  <div class="lb-rooms">
    <p class="lb-rooms__label">Rooms</p>
    <ul v-if="rooms.length" class="lb-rooms__list">
      <li v-for="room in rooms" :key="room.id">
        <LobbyRoomCard
          :room="room"
          :is-own="room.id === ownRoomId"
          @join="emit('join', $event)"
          @toggle="emit('toggle', $event)"
        />
      </li>
    </ul>
    <p v-else class="lb-rooms__empty">No open rooms.</p>
  </div>
</template>

<style scoped>
.lb-rooms {
  padding: var(--spacing-2) var(--spacing-3);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.lb-rooms__label {
  margin: 0;
  font-size: var(--font-size-xs);
  font-weight: 800;
  color: var(--color-muted-foreground);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.lb-rooms__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.lb-rooms__empty {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-muted-foreground);
}
</style>
