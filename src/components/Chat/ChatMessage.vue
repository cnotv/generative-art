<script setup lang="ts">
import type { ChatMessage } from '@webgamekit/chat'

defineProps<{
  message: ChatMessage
  isOwn: boolean
  groupedWithPrevious?: boolean
  groupedWithNext?: boolean
  variant?: 'game' | 'lobby-ui'
}>()
</script>

<template>
  <div
    class="chat-message"
    :class="{
      'chat-message--game': variant === 'game',
      'chat-message--lobby-ui': variant === 'lobby-ui',
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
  display: flex;
  flex-direction: column;
  gap: var(--spacing-0);
  padding: var(--spacing-1) var(--spacing-2);
  border-radius: var(--radius-sm);
  background: var(--color-secondary);
  font-size: inherit;
  color: #111;
  overflow-wrap: break-word;
}

.chat-message--game {
  border-radius: var(--radius-xl);
  background: #d7d8d9;
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
  border-bottom-left-radius: var(--radius-sm);
  border-bottom-right-radius: var(--radius-sm);
}

.chat-message--game.chat-message--group-top {
  border-bottom-left-radius: 4px;
  border-bottom-right-radius: 4px;
}

.chat-message--group-middle {
  border-radius: var(--radius-sm);
}

.chat-message--game.chat-message--group-middle {
  border-radius: 4px;
}

.chat-message--group-bottom {
  border-top-left-radius: var(--radius-sm);
  border-top-right-radius: var(--radius-sm);
}

.chat-message--game.chat-message--group-bottom {
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
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

/* lobby-ui theme */
.chat-message--lobby-ui {
  background: rgb(255 255 255 / 0.08);
  color: var(--lui-text-color);
  font-family: var(--lui-font);
  font-size: var(--lui-text-small);
  border-radius: var(--radius-xl);
}

.chat-message--lobby-ui .chat-message__sender {
  text-shadow: var(--lui-text-shadow);
}

.chat-message--lobby-ui .chat-message__text {
  text-shadow: var(--lui-text-shadow);
}

.chat-message--lobby-ui.chat-message--own {
  background: rgb(255 255 255 / 0.18);
  color: var(--lui-text-color);
  align-self: flex-end;
}

.chat-message--lobby-ui.chat-message--system {
  background: transparent;
  opacity: 0.6;
}
</style>
