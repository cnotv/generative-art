<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const props = defineProps<{
  roomId?: string
}>()

const emit = defineEmits<{
  leaveRoom: []
  copyLink: []
}>()

const route = useRoute()
const router = useRouter()
const fromLobby = computed(() => !!route.query.game)

const handleBack = (): void => {
  if (fromLobby.value) {
    router.replace({ query: {} })
  } else {
    emit('leaveRoom')
  }
}
</script>

<template>
  <header class="game-header">
    <div class="game-header__left">
      <button v-if="fromLobby" class="game-header__back" type="button" @click="handleBack">
        ← Lobby
      </button>
    </div>
    <div v-if="!fromLobby && roomId" class="game-header__room">
      <span class="game-header__room-label">Room:</span>
      <code class="game-header__room-id">{{ roomId.slice(0, 8) }}</code>
      <button class="game-header__copy-btn" type="button" @click="emit('copyLink')">
        Copy link
      </button>
    </div>
  </header>
</template>

<style scoped>
.game-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-2);
}

.game-header__left,
.game-header__room {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.game-header__back {
  padding: var(--spacing-1) var(--spacing-3);
  border: 2px solid var(--game-border);
  border-radius: 999px;
  background: var(--game-surface-subtle);
  color: var(--game-ink);
  font-size: var(--font-size-sm);
  font-weight: 700;
  cursor: pointer;
  box-shadow: 2px 2px 0 var(--game-border);
  transition: transform 0.1s ease;
  font-family: inherit;
}

.game-header__back:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 var(--game-border);
}

.game-header__room-label {
  color: var(--game-ink);
  font-weight: 700;
}

.game-header__room-id {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  padding: var(--spacing-1) var(--spacing-2);
  background: var(--color-secondary);
  border-radius: var(--radius-sm);
}

.game-header__copy-btn {
  padding: var(--spacing-2) var(--spacing-4, 1rem);
  border: 3px solid var(--game-border);
  border-radius: 999px;
  background: var(--game-accent, var(--color-primary));
  color: var(--game-ink);
  font-size: var(--font-size-sm);
  font-weight: 700;
  cursor: pointer;
  box-shadow: 3px 3px 0 var(--game-border);
  transition: transform 0.1s ease;
  font-family: inherit;
}

.game-header__copy-btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0 var(--game-border);
}
</style>
