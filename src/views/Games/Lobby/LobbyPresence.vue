<script setup lang="ts">
import { computed } from 'vue'
import { useLobbyStore } from '@/stores/lobby'

const props = defineProps<{ localPeerId: string }>()
const store = useLobbyStore()
const playerList = computed(() => Object.values(store.players))
</script>

<template>
  <div class="lb-presence">
    <h3 class="lb-presence__title">Online ({{ playerList.length }})</h3>
    <ul class="lb-presence__list">
      <li v-for="player in playerList" :key="player.id" class="lb-presence__player">
        <span class="lb-presence__dot" :style="{ background: player.color }" />
        <span class="lb-presence__name">
          {{ player.name }}
          <span v-if="player.id === localPeerId" class="lb-presence__you">(you)</span>
        </span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.lb-presence {
  padding: var(--spacing-3);
  border-bottom: 3px solid #111;
}

.lb-presence__title {
  margin: 0 0 var(--spacing-2);
  font-size: var(--font-size-xs);
  font-weight: 800;
  color: var(--color-muted-foreground);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.lb-presence__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.lb-presence__player {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.lb-presence__dot {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 50%;
  border: 2px solid #111;
  flex-shrink: 0;
}

.lb-presence__name {
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: #111;
}

.lb-presence__you {
  font-weight: 400;
  color: var(--color-muted-foreground);
}
</style>
