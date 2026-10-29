<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Maximize, Minimize } from 'lucide-vue-next'
import { LobbyUIButton, LobbyUIConfirm, LobbyUIIconButton } from '@/components/LobbyUI'
import { useFullscreen } from '@/composables/useFullscreen'
import { useMenuNavigation } from '@/composables/useMenuNavigation'
import '@/assets/styles/lobby-ui.scss'

const props = defineProps<{
  roomId?: string
  phase?: string
  /**
   * Where the back button goes from inside a running game. 'picker' leaves for
   * the games list; 'wizard' stays put and asks the game to return to its own
   * lobby, which is the screen a player who has just finished a run wants next.
   */
  backTo?: 'picker' | 'wizard'
}>()

const emit = defineEmits<{
  copyLink: []
  backToWizard: []
}>()

const route = useRoute()
const router = useRouter()
const fromLobby = computed(() => !!route.query.game)
const confirmOpen = ref(false)
const { isSupported: fullscreenSupported, isFullscreen, toggleFullscreen } = useFullscreen()

// Embedded in the Lobby view: clearing the query returns to it. Standalone
// route: navigate to the Lobby view, so every game always has a way back.
const navigateBack = (): void => {
  confirmOpen.value = false
  // Asked to stay in the game: the view drops back to its own wizard rather
  // than the route changing at all, so nothing is torn down and rebuilt.
  if (props.backTo === 'wizard' && props.phase && props.phase !== 'lobby') {
    emit('backToWizard')
    return
  }
  if (fromLobby.value) {
    router.replace({ query: {} })
    return
  }
  router.push('/games/Lobby')
}

// Mid-game (any phase but the lobby wizard) leaving is destructive, so the
// button asks first; from the wizard it navigates straight away.
const handleBack = (): void => {
  if (props.phase && props.phase !== 'lobby') {
    confirmOpen.value = true
    return
  }
  navigateBack()
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
    <LobbyUIIconButton
      v-if="fullscreenSupported"
      size="md"
      :title="isFullscreen ? 'Leave fullscreen' : 'Enter fullscreen'"
      :aria-label="isFullscreen ? 'Leave fullscreen' : 'Enter fullscreen'"
      :aria-pressed="isFullscreen"
      @click="toggleFullscreen"
    >
      <Minimize v-if="isFullscreen" class="game-header__icon" aria-hidden="true" />
      <Maximize v-else class="game-header__icon" aria-hidden="true" />
    </LobbyUIIconButton>
    <LobbyUIConfirm
      v-if="confirmOpen"
      message="Leave the game?"
      confirm-label="Leave"
      cancel-label="Stay"
      @confirm="navigateBack"
      @cancel="confirmOpen = false"
    />
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

.game-header__icon {
  width: 1.5em;
  height: 1.5em;
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
