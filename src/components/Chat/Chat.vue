<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import { Send, Plus, Minus } from 'lucide-vue-next'
import type { ChatMessage } from '@webgamekit/chat'
import ChatMessageItem from './ChatMessage.vue'

const FONT_SCALE_MIN = 0.75
const FONT_SCALE_MAX = 2
const FONT_SCALE_STEP = 0.15

const props = defineProps<{
  messages: ChatMessage[]
  localPeerId: string
  placeholder?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  send: [text: string]
}>()

const draft = ref('')
const listReference = ref<HTMLDivElement | null>(null)
const fontScale = ref(1)

const fontScaleStyle = computed(() => ({ '--chat-font-scale': String(fontScale.value) }))

const zoomIn = (): void => {
  fontScale.value = Math.min(FONT_SCALE_MAX, +(fontScale.value + FONT_SCALE_STEP).toFixed(2))
}

const zoomOut = (): void => {
  fontScale.value = Math.max(FONT_SCALE_MIN, +(fontScale.value - FONT_SCALE_STEP).toFixed(2))
}

const submit = (): void => {
  const value = draft.value.trim()
  if (!value) return
  emit('send', value)
  draft.value = ''
}

const scrollToBottom = async (): Promise<void> => {
  await nextTick()
  const element = listReference.value
  if (element) element.scrollTop = element.scrollHeight
}

watch(() => props.messages.length, scrollToBottom)
</script>

<template>
  <div class="chat" :style="fontScaleStyle">
    <div class="chat__zoom">
      <button
        class="chat__zoom-btn"
        type="button"
        title="Decrease chat font"
        :disabled="fontScale <= FONT_SCALE_MIN"
        @click="zoomOut"
      >
        <Minus class="chat__zoom-icon" />
      </button>
      <button
        class="chat__zoom-btn"
        type="button"
        title="Increase chat font"
        :disabled="fontScale >= FONT_SCALE_MAX"
        @click="zoomIn"
      >
        <Plus class="chat__zoom-icon" />
      </button>
    </div>
    <div ref="listReference" class="chat__list">
      <ChatMessageItem
        v-for="message in messages"
        :key="message.id"
        :message="message"
        :is-own="message.senderId === localPeerId"
      />
    </div>
    <form class="chat__form" @submit.prevent="submit">
      <input
        v-model="draft"
        class="chat__input"
        type="text"
        :placeholder="placeholder ?? 'Type a message…'"
        :disabled="disabled"
      />
      <button
        class="chat__send-btn"
        type="submit"
        title="Send message"
        :disabled="disabled || !draft.trim()"
      >
        <Send class="chat__send-icon" />
      </button>
    </form>
  </div>
</template>

<style scoped>
.chat {
  --chat-font-scale: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  height: 100%;
  min-height: 0;
  font-size: calc(var(--font-size-md, 1rem) * var(--chat-font-scale));
}

.chat__zoom {
  display: flex;
  gap: var(--spacing-1);
  justify-content: flex-end;
}

.chat__zoom-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-1);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-secondary);
  color: var(--color-foreground);
  cursor: pointer;
}

.chat__zoom-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.chat__zoom-icon {
  width: 0.875rem;
  height: 0.875rem;
}

.chat__list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  padding: var(--spacing-1);
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.chat__form {
  display: flex;
  gap: var(--spacing-1);
}

.chat__input {
  flex: 1;
  padding: var(--spacing-1) var(--spacing-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-background);
  color: var(--color-foreground);
  font-size: inherit;
}

.chat__input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chat__send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-1) var(--spacing-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: var(--color-primary-foreground);
  cursor: pointer;
}

.chat__send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.chat__send-icon {
  width: 1rem;
  height: 1rem;
}
</style>
