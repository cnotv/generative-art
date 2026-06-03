<script setup lang="ts">
import { computed } from 'vue'
import { LobbyUIPlayerList } from '@/components/LobbyUI'
import { useLobbyStore } from '@/stores/lobby'

const props = defineProps<{ localPeerId: string }>()
const store = useLobbyStore()
const playerList = computed(() =>
  Object.values(store.players).map((p) => ({
    ...p,
    name: p.id === props.localPeerId ? `${p.name} (you)` : p.name
  }))
)
</script>

<template>
  <div class="lb-presence">
    <LobbyUIPlayerList :players="playerList" :is-host="false" />
  </div>
</template>

<style scoped>
.lb-presence {
  padding: var(--spacing-1) var(--spacing-3) var(--spacing-2);
}
</style>
