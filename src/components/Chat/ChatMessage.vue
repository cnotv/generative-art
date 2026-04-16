<script setup lang="ts">
import type { ChatMessage } from '@webgamekit/chat'

defineProps<{
  message: ChatMessage
  isOwn: boolean
}>()
</script>

<template>
  <div
    class="chat-message"
    :class="{
      'chat-message--own': isOwn,
      'chat-message--system': message.kind === 'system',
      'chat-message--success': message.kind === 'success'
    }"
  >
    <span class="chat-message__sender">{{ message.senderName }}</span>
    <span class="chat-message__text">{{ message.text }}</span>
  </div>
</template>

<style scoped>
.chat-message {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-0);
  padding: var(--spacing-1) var(--spacing-2);
  border-radius: var(--radius-sm);
  background: var(--color-secondary);
  font-size: inherit;
  color: var(--color-foreground);
  word-break: break-word;
}

.chat-message--own {
  background: var(--color-primary);
  color: var(--color-primary-foreground);
  align-self: flex-end;
}

.chat-message--system {
  background: var(--chat-system-bg, var(--color-muted));
  color: var(--chat-system-color, var(--color-foreground));
  font-style: italic;
}

.chat-message--success {
  background: var(--chat-success-bg, var(--color-primary));
  color: var(--chat-success-color, var(--color-primary-foreground));
  font-weight: 700;
  border: 2px solid var(--chat-success-border, transparent);
}

.chat-message__sender {
  font-weight: 600;
  opacity: 0.8;
}

.chat-message__text {
  line-height: 1.3;
}
</style>
