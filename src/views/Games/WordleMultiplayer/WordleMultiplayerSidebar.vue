<script setup lang="ts">
import { ref } from 'vue'
import type { WlPlayer } from '@/stores/wordleMultiplayer'
import type { ChatMessage } from '@webgamekit/chat'

defineProps<{
  playerList: WlPlayer[]
  localPeerId: string
  hostId: string
  messages: ChatMessage[]
  solvedPlayers: Record<string, number>
  showChat: boolean
}>()

const emit = defineEmits<{
  send: [text: string]
  'update:showChat': [value: boolean]
}>()

const chatInput = ref('')

const handleSend = (): void => {
  const text = chatInput.value.trim()
  if (!text) return
  emit('send', text)
  chatInput.value = ''
}
</script>

<template>
  <aside class="wl-sidebar" :class="{ 'wl-sidebar--chat-open': showChat }">
    <div class="wl-sidebar__players">
      <h3 class="wl-sidebar__section-title">Players</h3>
      <ul class="wl-sidebar__player-list">
        <li
          v-for="player in playerList"
          :key="player.id"
          class="wl-sidebar__player"
          :class="{ 'wl-sidebar__player--local': player.id === localPeerId }"
        >
          <span class="wl-sidebar__player-dot" :style="{ background: player.color }" />
          <span class="wl-sidebar__player-name">
            {{ player.name }}
            <span v-if="player.id === hostId" class="wl-sidebar__player-host">host</span>
          </span>
          <span v-if="solvedPlayers[player.id]" class="wl-sidebar__player-solved">✓</span>
          <span class="wl-sidebar__player-score">{{ player.score }}</span>
        </li>
      </ul>
    </div>

    <div class="wl-sidebar__chat">
      <h3 class="wl-sidebar__section-title">Chat</h3>
      <ul class="wl-sidebar__messages">
        <li
          v-for="message in messages"
          :key="message.id"
          class="wl-sidebar__message"
          :class="`wl-sidebar__message--${message.kind ?? 'chat'}`"
        >
          <span v-if="message.kind !== 'system'" class="wl-sidebar__message-sender">
            {{ message.senderName }}:
          </span>
          {{ message.text }}
        </li>
      </ul>
      <form class="wl-sidebar__chat-form" @submit.prevent="handleSend">
        <input
          v-model="chatInput"
          class="wl-sidebar__chat-input"
          type="text"
          placeholder="Say something…"
          maxlength="200"
        />
        <button class="wl-sidebar__chat-send" type="submit">Send</button>
      </form>
    </div>

    <!-- Mobile chat toggle -->
    <button
      class="wl-sidebar__chat-toggle"
      type="button"
      :title="showChat ? 'Show game' : 'Open chat'"
      @click="emit('update:showChat', !showChat)"
    >
      {{ showChat ? '🎮' : '💬' }}
      <span v-if="messages.length && !showChat" class="wl-sidebar__chat-badge">
        {{ messages.length }}
      </span>
    </button>
  </aside>
</template>

<style scoped>
.wl-sidebar {
  grid-area: sidebar;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  min-height: 0;
  overflow: visible;
  padding: 4px;
}

.wl-sidebar__section-title {
  margin: 0 0 var(--spacing-2);
  font-size: var(--font-size-sm);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--game-ink-medium);
}

.wl-sidebar__players {
  background: var(--game-surface-subtle);
  border: 3px solid var(--game-border);
  border-radius: 1.25rem;
  box-shadow: 3px 3px 0 var(--game-border);
  padding: var(--spacing-3);
}

.wl-sidebar__player-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.wl-sidebar__player {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-1) var(--spacing-2);
  border-radius: 999px;
}

.wl-sidebar__player--local {
  background: var(--game-surface-subtle);
}

.wl-sidebar__player-dot {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
  border: 2px solid var(--game-border);
  flex-shrink: 0;
}

.wl-sidebar__player-name {
  flex: 1;
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--game-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
}

.wl-sidebar__player-host {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--game-ink-muted);
  border: 1px solid var(--game-border-secondary);
  border-radius: 999px;
  padding: 0 var(--spacing-1);
}

.wl-sidebar__player-solved {
  color: #2e7d32;
  font-weight: 900;
  font-size: var(--font-size-sm);
}

.wl-sidebar__player-score {
  font-size: var(--font-size-sm);
  font-weight: 800;
  color: var(--game-ink);
  min-width: 2.5rem;
  text-align: right;
}

.wl-sidebar__chat {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--game-surface-subtle);
  border: 3px solid var(--game-border);
  border-radius: 1.25rem;
  box-shadow: 3px 3px 0 var(--game-border);
  padding: var(--spacing-3);
  overflow: hidden;
}

.wl-sidebar__messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.wl-sidebar__message {
  font-size: var(--font-size-xs);
  line-height: 1.4;
  color: var(--game-ink);
  padding: var(--spacing-1) 0;
  border-bottom: 1px solid var(--game-surface-dim);
}

.wl-sidebar__message--system {
  color: var(--game-ink-muted);
  font-style: italic;
}

.wl-sidebar__message--success {
  color: #2e7d32;
  font-weight: 700;
}

.wl-sidebar__message-sender {
  font-weight: 700;
}

.wl-sidebar__chat-form {
  display: flex;
  gap: var(--spacing-1);
  margin-top: var(--spacing-2);
}

.wl-sidebar__chat-input {
  flex: 1;
  padding: var(--spacing-1) var(--spacing-2);
  border: 2px solid var(--game-border);
  border-radius: 999px;
  font-size: var(--font-size-sm);
  background: var(--game-surface-subtle);
  color: var(--game-ink);
  outline: none;
}

.wl-sidebar__chat-send {
  padding: var(--spacing-1) var(--spacing-3);
  border: 2px solid var(--game-border);
  border-radius: 999px;
  background: var(--wl-green);
  color: #fff;
  font-size: var(--font-size-sm);
  font-weight: 700;
  cursor: pointer;
  box-shadow: 2px 2px 0 var(--game-border);
  transition: transform 0.1s ease;
}

.wl-sidebar__chat-send:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 var(--game-border);
}

/* Mobile chat toggle button — hidden on desktop */
.wl-sidebar__chat-toggle {
  display: none;
}

.wl-sidebar__chat-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #d32f2f;
  color: #fff;
  font-size: 0.6rem;
  font-weight: 800;
  border-radius: 50%;
  width: 1rem;
  height: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 720px) {
  .wl-sidebar {
    display: none;
    grid-area: main;
    position: relative;
  }

  .wl-sidebar--chat-open {
    display: flex;
    max-height: none;
    overflow: auto;
  }

  .wl-sidebar__chat-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    position: fixed;
    bottom: var(--spacing-4);
    right: var(--spacing-4);
    width: 3rem;
    height: 3rem;
    border: 3px solid var(--game-border);
    border-radius: 50%;
    background: var(--wl-green);
    font-size: 1.25rem;
    cursor: pointer;
    box-shadow: 3px 3px 0 var(--game-border);
    z-index: 100;
    touch-action: manipulation;
    position: relative;
  }
}
</style>
