<script setup lang="ts">
import { Chat } from '@/components/Chat'
import type { ChatMessage } from '@webgamekit/chat'
import type { PictionaryPlayer, PictionaryPhase } from '@/stores/pictionary'

defineProps<{
  playerList: PictionaryPlayer[]
  drawerId: string
  hostId: string
  messages: ChatMessage[]
  localPeerId: string
  isDrawer: boolean
  phase: PictionaryPhase
}>()

const emit = defineEmits<{
  send: [text: string]
}>()
</script>

<template>
  <aside class="pictionary-sidebar">
    <div class="pictionary-sidebar__players">
      <h3 class="pictionary-sidebar__title">Players</h3>
      <ul class="pictionary-sidebar__player-list">
        <li
          v-for="player in playerList"
          :key="player.id"
          class="pictionary-sidebar__player"
          :class="{ 'pictionary-sidebar__player--drawer': drawerId === player.id }"
        >
          <span class="pictionary-sidebar__player-swatch" :style="{ background: player.color }" />
          <span
            v-if="drawerId === player.id"
            class="pictionary-sidebar__player-icon"
            title="Drawing"
            aria-label="Drawing"
            >✏️</span
          >
          <span
            v-if="hostId === player.id"
            class="pictionary-sidebar__player-icon"
            title="Host"
            aria-label="Host"
            >👑</span
          >
          <span class="pictionary-sidebar__player-name">{{ player.name }}</span>
          <span class="pictionary-sidebar__player-score">{{ player.score }}</span>
        </li>
      </ul>
    </div>
    <div class="pictionary-sidebar__chat">
      <h3 class="pictionary-sidebar__title">Chat</h3>
      <Chat
        :messages="messages"
        :local-peer-id="localPeerId"
        :placeholder="isDrawer ? 'Drawer cannot chat' : 'Type a guess…'"
        :disabled="isDrawer && phase === 'drawing'"
        @send="emit('send', $event)"
      />
    </div>
  </aside>
</template>

<style scoped>
.pictionary-sidebar {
  grid-area: sidebar;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  min-height: 0;
}

.pictionary-sidebar__title {
  margin: 0 0 var(--spacing-2) 0;
  font-size: var(--font-size-sm);
  color: #111;
  font-weight: 700;
}

.pictionary-sidebar__players {
  display: flex;
  flex-direction: column;
}

.pictionary-sidebar__player-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.pictionary-sidebar__player {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-3);
  border: 2px solid #111;
  border-radius: 999px;
  background: #fff;
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: #111;
  box-shadow: 2px 2px 0 #111;
}

.pictionary-sidebar__player--drawer {
  background: var(--pic-yellow);
  transform: rotate(-1deg);
}

.pictionary-sidebar__player-icon {
  font-size: 1rem;
  line-height: 1;
}

.pictionary-sidebar__player-swatch {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
}

.pictionary-sidebar__player-name {
  flex: 1;
}

.pictionary-sidebar__player-score {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.pictionary-sidebar__chat {
  flex: 1;
  min-height: 280px;
  display: flex;
  flex-direction: column;
}

.pictionary-sidebar__chat :deep(.chat) {
  flex: 1;
  background: #fff;
  border: 3px solid #111;
  border-radius: 1.25rem;
  box-shadow: 3px 3px 0 #111;
  padding: var(--spacing-2);
  box-sizing: border-box;
}

.pictionary-sidebar__chat :deep(.chat__input),
.pictionary-sidebar__chat :deep(.chat__send-btn),
.pictionary-sidebar__chat :deep(.chat__zoom-btn) {
  border-radius: 999px;
  border: 2px solid #111;
}

.pictionary-sidebar__chat :deep(.chat__list) {
  border-radius: 1rem;
  border: 2px solid #111;
  background: #fff;
}

.pictionary-sidebar__chat :deep(.chat-message) {
  --chat-message-radius: var(--radius-xl);
  --chat-message-radius-adjacent: 4px;
  --chat-message-bg: #d7d8d9;
}

.pictionary-sidebar__chat :deep(.chat-message--success) {
  --chat-success-bg: var(--pic-yellow);
  --chat-success-color: #111;
  --chat-success-border: #111;
}

.pictionary-sidebar__chat :deep(.chat-message--system) {
  --chat-system-bg: #fff4c2;
  --chat-system-color: #111;
}

@media (max-width: 720px) {
  .pictionary-sidebar {
    flex-direction: column-reverse;
    min-height: 0;
    overflow: hidden;
  }

  .pictionary-sidebar__chat {
    flex: 0 0 200px;
    min-height: 0;
  }

  .pictionary-sidebar__players {
    flex-shrink: 0;
  }

  .pictionary-sidebar__title {
    display: none;
  }
}
</style>
