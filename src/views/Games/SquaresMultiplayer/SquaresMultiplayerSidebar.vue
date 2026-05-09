<script setup lang="ts">
import { ref } from 'vue'
import type { WmPlayer, WmClaimedWord } from '@/stores/squaresMultiplayer'
import type { ChatMessage } from '@webgamekit/chat'

defineProps<{
  playerList: WmPlayer[]
  localPeerId: string
  hostId: string
  messages: ChatMessage[]
  claimedWords: WmClaimedWord[]
}>()

const emit = defineEmits<{
  send: [text: string]
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
  <aside class="ws-sidebar">
    <div class="ws-sidebar__players">
      <h3 class="ws-sidebar__section-title">Players</h3>
      <ul class="ws-sidebar__player-list">
        <li
          v-for="player in playerList"
          :key="player.id"
          class="ws-sidebar__player"
          :class="{ 'ws-sidebar__player--local': player.id === localPeerId }"
        >
          <span class="ws-sidebar__player-dot" :style="{ background: player.color }" />
          <span class="ws-sidebar__player-name">
            {{ player.name }}
            <span v-if="player.id === hostId" class="ws-sidebar__player-host">host</span>
          </span>
          <span
            v-if="claimedWords.some((cw) => cw.playerId === player.id)"
            class="ws-sidebar__player-solved"
            >✓</span
          >
          <span class="ws-sidebar__player-score">{{ player.score }}</span>
        </li>
      </ul>
    </div>

    <div class="ws-sidebar__chat">
      <h3 class="ws-sidebar__section-title">Chat</h3>
      <ul class="ws-sidebar__messages">
        <li
          v-for="message in messages"
          :key="message.id"
          class="ws-sidebar__message"
          :class="`ws-sidebar__message--${message.kind ?? 'chat'}`"
        >
          <span v-if="message.kind !== 'system'" class="ws-sidebar__message-sender">
            {{ message.senderName }}:
          </span>
          {{ message.text }}
        </li>
      </ul>
      <form class="ws-sidebar__chat-form" @submit.prevent="handleSend">
        <input
          v-model="chatInput"
          class="ws-sidebar__chat-input"
          type="text"
          placeholder="Say something…"
          maxlength="200"
        />
        <button class="ws-sidebar__chat-send" type="submit">Send</button>
      </form>
    </div>
  </aside>
</template>

<style scoped>
.ws-sidebar {
  grid-area: sidebar;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  min-height: 0;
  overflow: hidden;
}

.ws-sidebar__section-title {
  margin: 0 0 var(--spacing-2);
  font-size: var(--font-size-sm);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #555;
}

.ws-sidebar__players {
  background: #fff;
  border: 3px solid #111;
  border-radius: 1.25rem;
  box-shadow: 3px 3px 0 #111;
  padding: var(--spacing-3);
}

.ws-sidebar__player-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.ws-sidebar__player {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-1) var(--spacing-2);
  border-radius: 999px;
}

.ws-sidebar__player--local {
  background: #f5f5f5;
}

.ws-sidebar__player-dot {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
  border: 2px solid #111;
  flex-shrink: 0;
}

.ws-sidebar__player-name {
  flex: 1;
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: #111;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
}

.ws-sidebar__player-host {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: #888;
  border: 1px solid #ccc;
  border-radius: 999px;
  padding: 0 var(--spacing-1);
}

.ws-sidebar__player-solved {
  color: #2e7d32;
  font-weight: 900;
  font-size: var(--font-size-sm);
}

.ws-sidebar__player-score {
  font-size: var(--font-size-sm);
  font-weight: 800;
  color: #111;
  min-width: 2.5rem;
  text-align: right;
}

.ws-sidebar__chat {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 3px solid #111;
  border-radius: 1.25rem;
  box-shadow: 3px 3px 0 #111;
  padding: var(--spacing-3);
  overflow: hidden;
}

.ws-sidebar__messages {
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

.ws-sidebar__message {
  font-size: var(--font-size-xs);
  line-height: 1.4;
  color: #111;
  padding: var(--spacing-1) 0;
  border-bottom: 1px solid #f0f0f0;
}

.ws-sidebar__message--system {
  color: #888;
  font-style: italic;
}

.ws-sidebar__message--success {
  color: #2e7d32;
  font-weight: 700;
}

.ws-sidebar__message-sender {
  font-weight: 700;
}

.ws-sidebar__chat-form {
  display: flex;
  gap: var(--spacing-1);
  margin-top: var(--spacing-2);
}

.ws-sidebar__chat-input {
  flex: 1;
  padding: var(--spacing-1) var(--spacing-2);
  border: 2px solid #111;
  border-radius: 999px;
  font-size: var(--font-size-sm);
  background: #fff;
  color: #111;
  outline: none;
}

.ws-sidebar__chat-send {
  padding: var(--spacing-1) var(--spacing-3);
  border: 2px solid #111;
  border-radius: 999px;
  background: var(--ws-green);
  color: #fff;
  font-size: var(--font-size-sm);
  font-weight: 700;
  cursor: pointer;
  box-shadow: 2px 2px 0 #111;
  transition: transform 0.1s ease;
}

.ws-sidebar__chat-send:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 #111;
}

@media (max-width: 720px) {
  .ws-sidebar {
    max-height: 40vh;
  }

  .ws-sidebar__chat {
    flex: none;
    max-height: 20vh;
  }
}
</style>
