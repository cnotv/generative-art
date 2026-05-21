<script setup lang="ts">
import { ref, nextTick, watch, computed } from 'vue'
import { useLobbyStore } from '@/stores/lobby'

const props = defineProps<{ localPeerId: string }>()
const emit = defineEmits<{ send: [text: string] }>()

const store = useLobbyStore()
const input = ref('')
const listReference = ref<HTMLElement | null>(null)

const messages = computed(() => store.messages)

const scrollToBottom = (): void => {
  nextTick(() => {
    if (listReference.value) listReference.value.scrollTop = listReference.value.scrollHeight
  })
}

watch(messages, scrollToBottom, { deep: true })

const handleSend = (): void => {
  const text = input.value.trim()
  if (!text) return
  emit('send', text)
  input.value = ''
}
</script>

<template>
  <div class="lb-chat">
    <ul ref="listReference" class="lb-chat__messages">
      <li
        v-for="msg in messages"
        :key="msg.id"
        class="lb-chat__message"
        :class="{
          'lb-chat__message--own': msg.senderId === localPeerId,
          'lb-chat__message--system': msg.kind === 'system'
        }"
      >
        <span v-if="msg.kind !== 'system'" class="lb-chat__sender">{{ msg.senderName }}</span>
        <span class="lb-chat__text">{{ msg.text }}</span>
      </li>
    </ul>
    <form class="lb-chat__form" @submit.prevent="handleSend">
      <input
        v-model="input"
        class="lb-chat__input"
        type="text"
        placeholder="Say something..."
        maxlength="300"
        autocomplete="off"
      />
      <button class="lb-chat__send" type="submit">→</button>
    </form>
  </div>
</template>

<style scoped>
.lb-chat {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}

.lb-chat__messages {
  flex: 1;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: var(--spacing-3);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.lb-chat__message {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-width: 80%;
}

.lb-chat__message--own {
  align-self: flex-end;
  align-items: flex-end;
}

.lb-chat__message--system {
  align-self: center;
  align-items: center;
  max-width: 100%;
}

.lb-chat__sender {
  font-size: var(--font-size-xs);
  font-weight: 700;
  color: var(--color-muted-foreground);
}

.lb-chat__text {
  padding: var(--spacing-1) var(--spacing-2);
  border-radius: var(--radius-md);
  background: var(--color-muted);
  font-size: var(--font-size-sm);
  line-height: 1.4;
  overflow-wrap: break-word;
}

.lb-chat__message--own .lb-chat__text {
  background: var(--game-own-msg-bg, var(--game-ink));
  color: #fff;
}

.lb-chat__message--system .lb-chat__text {
  background: transparent;
  color: var(--color-muted-foreground);
  font-size: var(--font-size-xs);
  font-style: italic;
  padding: 0;
}

.lb-chat__form {
  display: flex;
  gap: var(--spacing-2);
  padding: var(--spacing-3);
  border-top: 3px solid var(--game-border);
}

.lb-chat__input {
  flex: 1;
  padding: var(--spacing-2) var(--spacing-3);
  border: 2px solid var(--game-border);
  border-radius: 999px;
  background: var(--game-surface-subtle);
  color: var(--game-ink);
  font-size: var(--font-size-sm);
  font-weight: 600;
  outline: none;
}

.lb-chat__send {
  padding: var(--spacing-2) var(--spacing-3);
  border: 2px solid var(--game-border);
  border-radius: 999px;
  background: var(--game-ink);
  color: var(--game-surface);
  font-size: var(--font-size-sm);
  font-weight: 700;
  cursor: pointer;
  box-shadow: 2px 2px 0 var(--game-ink-medium);
  transition: transform 0.1s ease;
}

.lb-chat__send:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 var(--game-ink-medium);
}
</style>
