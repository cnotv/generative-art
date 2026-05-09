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
  <header class="wm-header">
    <div class="wm-header__room">
      <span class="wm-header__room-label">Room:</span>
      <code class="wm-header__room-id">{{ roomId.slice(0, 8) }}</code>
      <button class="wm-header__copy-btn" type="button" @click="emit('copyLink')">Copy link</button>
      <div class="wm-header__rules">
        <button
          class="wm-header__rules-btn"
          type="button"
          title="How to play"
          @click="rulesOpen = !rulesOpen"
        >
          ?
        </button>
        <div v-if="rulesOpen" class="wm-header__rules-panel">
          <button class="wm-header__rules-close" type="button" @click="closeRules">×</button>
          <ul class="wm-header__rules-list">
            <li>A grid of letters hides several target words — grouped by length</li>
            <li>
              <strong>Click and drag</strong> through adjacent letters (diagonals OK) to trace a
              word
            </li>
            <li>Release to submit — if the word is in the list, you claim it</li>
            <li>First to claim a word gets the points</li>
            <li>3–4 letters = 1 pt · 5 = 2 pt · 6 = 3 pt · 7 = 5 pt · 8+ = 11 pt</li>
            <li>Round ends when all words are found or time runs out</li>
          </ul>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.wm-header {
  grid-area: header;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-2);
  overflow: visible;
  position: relative;
  z-index: 10;
}

.wm-header__room {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.wm-header__room-label {
  color: #111;
  font-weight: 700;
}

.wm-header__room-id {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  padding: var(--spacing-1) var(--spacing-2);
  background: var(--ws-green);
  border-radius: var(--radius-sm);
}

.wm-header__copy-btn {
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

.wm-header__copy-btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0 #111;
}

.wm-header__rules {
  position: relative;
}

.wm-header__rules-btn {
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

.wm-header__rules-btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 #111;
}

.wm-header__rules-panel {
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

.wm-header__rules-close {
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

.wm-header__rules-close:hover {
  color: #111;
}

.wm-header__rules-list {
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
