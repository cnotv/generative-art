<script setup lang="ts">
import { ref, onMounted } from 'vue'

const RULES_SEEN_KEY = 'game-rules-seen'

defineProps<{
  roomId: string
}>()

const emit = defineEmits<{
  copyLink: []
}>()

const rulesOpen = ref(false)

onMounted(() => {
  if (!localStorage.getItem(RULES_SEEN_KEY)) {
    rulesOpen.value = true
    localStorage.setItem(RULES_SEEN_KEY, '1')
  }
})

const closeRules = (): void => {
  rulesOpen.value = false
}
</script>

<template>
  <header class="wl-header">
    <div class="wl-header__room">
      <span class="wl-header__room-label">Room:</span>
      <code class="wl-header__room-id">{{ roomId.slice(0, 8) }}</code>
      <button class="wl-header__copy-btn" type="button" @click="emit('copyLink')">Copy link</button>
      <div class="wl-header__rules">
        <button
          class="wl-header__rules-btn"
          type="button"
          title="How to play"
          @click="rulesOpen = !rulesOpen"
        >
          ?
        </button>
        <div v-if="rulesOpen" class="wl-header__rules-panel">
          <button class="wl-header__rules-close" type="button" @click="closeRules">×</button>
          <ul class="wl-header__rules-list">
            <li>Guess the secret word — all players guess simultaneously</li>
            <li>
              Green = correct letter and position · Yellow = letter in word but wrong position
            </li>
            <li>Fewer attempts and faster guesses earn more points</li>
            <li>First to solve gets a bonus</li>
            <li>Round ends when everyone finishes or time runs out</li>
          </ul>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.wl-header {
  grid-area: header;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-2);
  overflow: visible;
  position: relative;
  z-index: 10;
}

.wl-header__room {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.wl-header__room-label {
  color: #111;
  font-weight: 700;
}

.wl-header__room-id {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  padding: var(--spacing-1) var(--spacing-2);
  background: var(--wl-green);
  border-radius: var(--radius-sm);
}

.wl-header__copy-btn {
  padding: var(--spacing-2) var(--spacing-4, 1rem);
  border: 3px solid #111;
  border-radius: 999px;
  background: var(--wl-yellow);
  color: #111;
  font-size: var(--font-size-sm);
  font-weight: 700;
  cursor: pointer;
  box-shadow: 3px 3px 0 #111;
  transition: transform 0.1s ease;
}

.wl-header__copy-btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0 #111;
}

.wl-header__rules {
  position: relative;
}

.wl-header__rules-btn {
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
  box-shadow: 2px 2px 0 #111;
  transition: transform 0.1s ease;
  user-select: none;
  font-family: inherit;
}

.wl-header__rules-btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 #111;
}

.wl-header__rules-panel {
  position: absolute;
  top: calc(100% + var(--spacing-2));
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  background: #fff;
  border: 2px solid #111;
  border-radius: 0.75rem;
  box-shadow: 3px 3px 0 #111;
  width: 18rem;
  padding: var(--spacing-3) var(--spacing-3) var(--spacing-3) var(--spacing-5);
}

.wl-header__rules-close {
  position: absolute;
  top: var(--spacing-2);
  right: var(--spacing-2);
  width: 1.25rem;
  height: 1.25rem;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: #888;
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-family: inherit;
}

.wl-header__rules-close:hover {
  color: #111;
}

.wl-header__rules-list {
  margin: 0;
  padding: 0 0 0 var(--spacing-2);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  font-size: var(--font-size-sm);
  line-height: 1.4;
  color: #111;
}
</style>
