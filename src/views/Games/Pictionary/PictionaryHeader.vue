<script setup lang="ts">
defineProps<{
  roomId: string
}>()

const emit = defineEmits<{
  copyLink: []
}>()
</script>

<template>
  <header class="pictionary-header">
    <div class="pictionary-header__room">
      <span class="pictionary-header__room-label">Room:</span>
      <code class="pictionary-header__room-id">{{ roomId.slice(0, 8) }}</code>
      <button class="pictionary-header__copy-btn" type="button" @click="emit('copyLink')">
        Copy link
      </button>
    </div>
  </header>
</template>

<style scoped>
.pictionary-header {
  grid-area: header;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-2);
}

.pictionary-header__room {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.pictionary-header__room-id {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  padding: var(--spacing-1) var(--spacing-2);
  background: var(--color-secondary);
  border-radius: var(--radius-sm);
}

.pictionary-header__room-label {
  color: #111;
  font-weight: 700;
}

.pictionary-header__copy-btn {
  padding: var(--spacing-2) var(--spacing-4, 1rem);
  border: 3px solid #111;
  border-radius: 999px;
  background: var(--pic-yellow);
  color: #111;
  font-size: var(--font-size-sm);
  font-weight: 700;
  cursor: pointer;
  box-shadow: 3px 3px 0 #111;
  transition: transform 0.1s ease;
}

.pictionary-header__copy-btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0 #111;
}

@media (max-width: 720px) {
  .pictionary-header__room-id {
    color: var(--color-foreground);
  }
}
</style>
