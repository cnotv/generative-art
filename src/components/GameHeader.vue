<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LobbyUIButton } from '@/components/LobbyUI'
import { useMenuNavigation } from '@/composables/useMenuNavigation'
import '@/assets/styles/lobby-ui.scss'

const props = defineProps<{
  roomId?: string
}>()

const emit = defineEmits<{
  copyLink: []
}>()

const route = useRoute()
const router = useRouter()
const fromLobby = computed(() => !!route.query.game)

// Embedded in the Lobby view: clearing the query returns to it. Standalone
// route: navigate to the Lobby view, so every game always has a way back.
const handleBack = (): void => {
  if (fromLobby.value) {
    router.replace({ query: {} })
    return
  }
  router.push('/games/Lobby')
}

useMenuNavigation((action) => {
  if (action === 'cancel' && fromLobby.value) handleBack()
})
</script>

<template>
  <header class="game-header">
    <div class="game-header__left">
      <LobbyUIButton variant="ghost" title="Return to the lobby" @click="handleBack">
        ← Lobby
      </LobbyUIButton>
    </div>
    <div v-if="!fromLobby && roomId" class="game-header__room">
      <span class="game-header__room-label">Room:</span>
      <code class="game-header__room-id">{{ roomId.slice(0, 8) }}</code>
      <LobbyUIButton variant="primary" @click="emit('copyLink')">Copy link</LobbyUIButton>
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

.game-header__room-label {
  font-family: var(--lui-font);
  font-size: var(--lui-text-small);
  font-weight: 700;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
}

.game-header__room-id {
  font-family: var(--font-mono);
  font-size: var(--lui-text-tiny);
  padding: var(--spacing-1) var(--spacing-2);
  border: 1px solid var(--lui-stroke-faint);
  border-radius: var(--radius-sm);
  color: var(--lui-text-color);
  opacity: 0.8;
}
</style>
