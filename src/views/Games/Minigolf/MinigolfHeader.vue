<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

defineProps<{
  roomId: string
}>()

const emit = defineEmits<{
  copyLink: []
}>()

const route = useRoute()
const router = useRouter()
const fromLobby = computed(() => !!route.query.game)
</script>

<template>
  <header class="mg-header">
    <div class="mg-header__room">
      <template v-if="fromLobby">
        <button class="mg-header__lobby-btn" type="button" @click="router.replace({ query: {} })">
          ← Lobby
        </button>
      </template>
      <template v-else>
        <span class="mg-header__room-label">Room:</span>
        <code class="mg-header__room-id">{{ roomId.slice(0, 8) }}</code>
        <button class="mg-header__copy-btn" type="button" @click="emit('copyLink')">
          Copy link
        </button>
      </template>
    </div>
  </header>
</template>

<style scoped>
.mg-header {
  grid-area: header;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-2);
  overflow: visible;
  position: relative;
  z-index: 10;
}

.mg-header__room {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.mg-header__lobby-btn {
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

.mg-header__lobby-btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 var(--game-border);
}

.mg-header__room-label {
  color: var(--game-ink);
  font-weight: 700;
}

.mg-header__room-id {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  padding: var(--spacing-1) var(--spacing-2);
  background: var(--mg-green);
  border-radius: var(--radius-sm);
}

.mg-header__copy-btn {
  padding: var(--spacing-2) var(--spacing-4, 1rem);
  border: 3px solid var(--game-border);
  border-radius: 999px;
  background: var(--mg-yellow);
  color: var(--game-ink);
  font-size: var(--font-size-sm);
  font-weight: 700;
  cursor: pointer;
  box-shadow: 3px 3px 0 var(--game-border);
  transition: transform 0.1s ease;
}

.mg-header__copy-btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0 var(--game-border);
}
</style>
