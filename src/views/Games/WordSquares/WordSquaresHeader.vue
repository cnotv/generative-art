<script setup lang="ts">
defineProps<{
  roomId: string
}>()

const emit = defineEmits<{
  copyLink: []
}>()
</script>

<template>
  <header class="ws-header">
    <div class="ws-header__room">
      <span class="ws-header__room-label">Room:</span>
      <code class="ws-header__room-id">{{ roomId.slice(0, 8) }}</code>
      <button class="ws-header__copy-btn" type="button" @click="emit('copyLink')">Copy link</button>
      <details class="ws-header__rules">
        <summary class="ws-header__rules-btn" title="How points work">?</summary>
        <ul class="ws-header__rules-list">
          <li>Guess the secret word — all players guess simultaneously</li>
          <li>
            Green = correct letter in correct position, Yellow = letter in word but wrong position
          </li>
          <li>Fewer attempts and faster guesses earn more points</li>
          <li>First to solve gets a bonus</li>
          <li>Round ends when everyone finishes or time runs out</li>
        </ul>
      </details>
    </div>
  </header>
</template>

<style scoped>
.ws-header {
  grid-area: header;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-2);
  overflow: visible;
  position: relative;
  z-index: 10;
}

.ws-header__room {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.ws-header__room-label {
  color: #111;
  font-weight: 700;
}

.ws-header__room-id {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  padding: var(--spacing-1) var(--spacing-2);
  background: var(--ws-green);
  border-radius: var(--radius-sm);
}

.ws-header__copy-btn {
  padding: var(--spacing-2) var(--spacing-4, 1rem);
  border: 3px solid #111;
  border-radius: 999px;
  background: var(--ws-yellow);
  color: #111;
  font-size: var(--font-size-sm);
  font-weight: 700;
  cursor: pointer;
  box-shadow: 3px 3px 0 #111;
  transition: transform 0.1s ease;
}

.ws-header__copy-btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0 #111;
}

.ws-header__rules {
  position: relative;
}

.ws-header__rules-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border: 2px solid #111;
  border-radius: 50%;
  background: #fff;
  color: #111;
  font-size: 0.875rem;
  font-weight: 900;
  cursor: pointer;
  list-style: none;
  box-shadow: 2px 2px 0 #111;
  transition: transform 0.1s ease;
  user-select: none;
  font-family: inherit;
}

.ws-header__rules-btn::-webkit-details-marker {
  display: none;
}

.ws-header__rules-btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 #111;
}

.ws-header__rules-list {
  position: absolute;
  top: calc(100% + var(--spacing-2));
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  margin: 0;
  padding: var(--spacing-3) var(--spacing-3) var(--spacing-3) var(--spacing-5);
  background: #fff;
  border: 2px solid #111;
  border-radius: 0.75rem;
  box-shadow: 3px 3px 0 #111;
  width: 18rem;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  font-size: var(--font-size-sm);
  line-height: 1.4;
  color: #111;
}
</style>
