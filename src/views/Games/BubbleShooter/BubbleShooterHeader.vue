<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const fromLobby = computed(() => !!route.query.game)

const emit = defineEmits<{ leaveRoom: [] }>()

const handleBack = (): void => {
  if (fromLobby.value) {
    router.replace({ query: {} })
  } else {
    emit('leaveRoom')
  }
}
</script>

<template>
  <header class="bs-header">
    <button class="bs-header__back" type="button" @click="handleBack">← Lobby</button>
  </header>
</template>

<style scoped>
.bs-header {
  grid-area: header;
  display: flex;
  align-items: center;
  padding: 0 var(--spacing-3);
  background: var(--game-surface-subtle);
  border-bottom: 2px solid var(--game-border);
  min-height: 2.5rem;
  flex-shrink: 0;
}

.bs-header__back {
  background: none;
  border: none;
  cursor: pointer;
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--game-ink-muted);
  padding: var(--spacing-1) var(--spacing-2);
  border-radius: var(--radius-sm);
  font-family: inherit;
}

.bs-header__back:hover {
  color: var(--game-ink);
  background: var(--game-surface-dim);
}
</style>
