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
  <header class="pictionary-header">
    <div class="pictionary-header__room">
      <template v-if="fromLobby">
        <button
          class="pictionary-header__lobby-btn"
          type="button"
          @click="router.replace({ query: {} })"
        >
          ← Lobby
        </button>
      </template>
      <template v-else>
        <span class="pictionary-header__room-label">Room:</span>
        <code class="pictionary-header__room-id">{{ roomId.slice(0, 8) }}</code>
        <button class="pictionary-header__copy-btn" type="button" @click="emit('copyLink')">
          Copy link
        </button>
      </template>
    </div>
  </header>
</template>

<style scoped>
.pictionary-header {
  grid-area: header;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-2);
  overflow: visible;
  position: relative;
  z-index: 10;
}

.pictionary-header__room {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.pictionary-header__lobby-btn {
  padding: var(--spacing-1) var(--spacing-3);
  border: 2px solid #111;
  border-radius: 999px;
  background: #fff7e6;
  color: #111;
  font-size: var(--font-size-sm);
  font-weight: 700;
  cursor: pointer;
  box-shadow: 2px 2px 0 #111;
  transition: transform 0.1s ease;
  font-family: inherit;
}

.pictionary-header__lobby-btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 #111;
}

.pictionary-header__room-id {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  padding: var(--spacing-1) var(--spacing-2);
  background: var(--color-secondary);
  border-radius: var(--radius-sm);
}

.pictionary-header__room-label {
  color: #111;
  font-weight: 700;
}

.pictionary-header__copy-btn {
  padding: var(--spacing-2) var(--spacing-4, 1rem);
  border: 3px solid #111;
  border-radius: 999px;
  background: var(--pic-yellow);
  color: #111;
  font-size: var(--font-size-sm);
  font-weight: 700;
  cursor: pointer;
  box-shadow: 3px 3px 0 #111;
  transition: transform 0.1s ease;
}

.pictionary-header__copy-btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0 #111;
}

.pictionary-header__rules {
  position: relative;
}

.pictionary-header__rules-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border: 2px solid #111;
  border-radius: 50%;
  background: #fff;
  color: #111;
  font-size: 0.875rem;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 2px 2px 0 #111;
  transition: transform 0.1s ease;
  user-select: none;
  font-family: inherit;
}

.pictionary-header__rules-btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 #111;
}

.pictionary-header__rules-panel {
  position: absolute;
  top: calc(100% + var(--spacing-2));
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  background: #fff;
  border: 2px solid #111;
  border-radius: 0.75rem;
  box-shadow: 3px 3px 0 #111;
  width: 18rem;
  padding: var(--spacing-3) var(--spacing-3) var(--spacing-3) var(--spacing-5);
}

.pictionary-header__rules-close {
  position: absolute;
  top: var(--spacing-2);
  right: var(--spacing-2);
  width: 1.25rem;
  height: 1.25rem;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: #888;
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-family: inherit;
}

.pictionary-header__rules-close:hover {
  color: #111;
}

.pictionary-header__rules-list {
  margin: 0;
  padding: 0 0 0 var(--spacing-2);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  font-size: var(--font-size-sm);
  line-height: 1.4;
  color: #111;
}

@media (max-width: 720px) {
  .pictionary-header__room-id {
    color: var(--color-foreground);
  }
}
</style>
