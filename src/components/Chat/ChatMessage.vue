<script setup lang="ts">
import type { ChatMessage } from '@webgamekit/chat'

defineProps<{
  message: ChatMessage
  isOwn: boolean
  groupedWithPrevious?: boolean
  groupedWithNext?: boolean
}>()
</script>

<template>
  <div
    class="chat-message"
    :class="{
      'chat-message--own': isOwn,
      'chat-message--system': message.kind === 'system',
      'chat-message--success': message.kind === 'success',
      'chat-message--grouped': groupedWithPrevious,
      'chat-message--group-top': !groupedWithPrevious && groupedWithNext,
      'chat-message--group-middle': groupedWithPrevious && groupedWithNext,
      'chat-message--group-bottom': groupedWithPrevious && !groupedWithNext
    }"
  >
    <span v-if="!groupedWithPrevious" class="chat-message__sender">{{ message.senderName }}</span>
    <span class="chat-message__text">{{ message.text }}</span>
  </div>
</template>

<style scoped>
.chat-message {
  --chat-message-radius: var(--radius-sm);
  --chat-message-radius-adjacent: var(--radius-sm);
  --chat-message-bg: var(--color-secondary);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-0);
  padding: var(--spacing-1) var(--spacing-2);
  border-radius: var(--chat-message-radius);
  background: var(--chat-message-bg);
  font-size: inherit;
  color: #111;
  word-break: break-word;
}

.chat-message--own {
  background: var(--color-primary);
  color: var(--color-primary-foreground);
  align-self: flex-end;
}

.chat-message--grouped {
  margin-top: calc(var(--spacing-1) * -1 + 2px);
}

.chat-message--group-top {
  border-bottom-left-radius: var(--chat-message-radius-adjacent);
  border-bottom-right-radius: var(--chat-message-radius-adjacent);
}

.chat-message--group-middle {
  border-radius: var(--chat-message-radius-adjacent);
}

.chat-message--group-bottom {
  border-top-left-radius: var(--chat-message-radius-adjacent);
  border-top-right-radius: var(--chat-message-radius-adjacent);
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
