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
  font-family: var(--lui-font);
  font-size: var(--lui-text-tiny);
  font-weight: 700;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  opacity: 0.7;
}

.lb-chat__text {
  padding: var(--spacing-1) var(--spacing-2);
  border-radius: var(--radius-md);
  background: rgb(255 255 255 / 0.1);
  font-family: var(--lui-font);
  font-size: var(--lui-text-small);
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  line-height: 1.4;
  overflow-wrap: break-word;
}

.lb-chat__message--own .lb-chat__text {
  background: rgb(255 255 255 / 0.2);
}

.lb-chat__message--system .lb-chat__text {
  background: transparent;
  opacity: 0.6;
  font-style: italic;
  padding: 0;
}

.lb-chat__form {
  display: flex;
  gap: var(--spacing-2);
  padding: var(--spacing-3);
  background-image: var(--lui-squiggle-faint);
  background-repeat: repeat-x;
  background-position: left top;
  background-size: var(--lui-squiggle-size);
}

.lb-chat__input {
  flex: 1;
  padding: var(--spacing-1) 0;
  border: none;
  background-image: var(--lui-squiggle-faint);
  background-repeat: repeat-x;
  background-position: left bottom;
  background-size: var(--lui-squiggle-size);
  background-color: transparent;
  color: var(--lui-text-color);
  font-family: var(--lui-font);
  font-size: var(--lui-text-small);
  font-weight: 700;
  outline: none;
  caret-color: var(--lui-stroke);
}

.lb-chat__input:focus {
  background-image: var(--lui-squiggle);
}

.lb-chat__send {
  padding: var(--spacing-1) var(--spacing-3);
  border: 2px solid var(--lui-stroke-faint);
  border-radius: var(--lui-radius-sketch);
  background: transparent;
  color: var(--lui-text-color);
  font-family: var(--lui-font);
  font-size: var(--lui-text-small);
  font-weight: 700;
  text-shadow: var(--lui-text-shadow);
  cursor: pointer;
  box-shadow: var(--lui-border-shadow);
  transition: transform 0.1s ease;
}

.lb-chat__send:hover {
  transform: translate(-1px, -1px);
  border-color: var(--lui-stroke);
}
</style>
