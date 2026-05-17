<script setup lang="ts">
defineProps<{
  showSidebar: boolean
  unreadCount?: number
}>()

const emit = defineEmits<{
  'update:showSidebar': [value: boolean]
}>()
</script>

<template>
  <nav class="game-tab-bar">
    <button
      class="game-tab-bar__tab"
      :class="{ 'game-tab-bar__tab--active': !showSidebar }"
      type="button"
      @click="emit('update:showSidebar', false)"
    >
      Game
    </button>
    <button
      class="game-tab-bar__tab"
      :class="{ 'game-tab-bar__tab--active': showSidebar }"
      type="button"
      @click="emit('update:showSidebar', true)"
    >
      Chat
      <span v-if="unreadCount && unreadCount > 0 && !showSidebar" class="game-tab-bar__badge">
        {{ unreadCount > 99 ? '99+' : unreadCount }}
      </span>
    </button>
  </nav>
</template>

<style scoped>
.game-tab-bar {
  display: none;
}

@media (max-width: 720px) {
  .game-tab-bar {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3rem;
    z-index: var(--z-overlay);
    background: var(--game-surface-subtle);
    border-top: 2px solid var(--game-border);
  }

  .game-tab-bar__tab {
    flex: 1;
    font-size: var(--font-size-sm);
    font-weight: 700;
    color: var(--game-ink-muted);
    border: none;
    background: transparent;
    cursor: pointer;
    touch-action: manipulation;
    transition: color 0.15s ease;
  }

  .game-tab-bar__tab--active {
    color: var(--game-ink);
    border-top: 3px solid var(--game-accent, var(--game-border));
    margin-top: -2px;
  }

  .game-tab-bar__tab {
    position: relative;
  }

  .game-tab-bar__badge {
    position: absolute;
    top: 4px;
    right: calc(50% - 1.5rem);
    background: #d32f2f;
    color: #fff;
    font-size: 0.6rem;
    font-weight: 800;
    line-height: 1;
    padding: 2px 4px;
    border-radius: 999px;
    min-width: 1rem;
    text-align: center;
  }
}
</style>
