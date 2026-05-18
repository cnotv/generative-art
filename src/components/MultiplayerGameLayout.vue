<script setup lang="ts">
import GameTabBar from '@/components/GameTabBar.vue'

defineProps<{
  phase: string
  showSidebar: boolean
  unreadCount?: number
}>()

defineEmits<{
  'update:showSidebar': [value: boolean]
}>()
</script>

<template>
  <main class="mgl" :class="[`mgl--${phase}`, { 'mgl--show-sidebar': showSidebar }]">
    <div class="mgl__main">
      <slot />
    </div>
    <aside class="mgl__sidebar">
      <slot name="sidebar" />
    </aside>
    <GameTabBar
      :show-sidebar="showSidebar"
      :unread-count="unreadCount"
      @update:show-sidebar="$emit('update:showSidebar', $event)"
    />
  </main>
</template>

<style scoped>
.mgl {
  display: grid;
  grid-template-columns: 1fr var(--mgl-sidebar-width, 280px);
  grid-template-areas: 'main sidebar';
  grid-template-rows: minmax(0, 1fr);
  height: 100dvh;
  box-sizing: border-box;
  overflow: hidden;
  padding: var(--spacing-3);
  padding-top: calc(var(--nav-height) + var(--spacing-3));
  gap: var(--spacing-3);
}

.mgl--lobby {
  height: auto;
  min-height: 100dvh;
  overflow: auto;
  grid-template-rows: auto;
}

.mgl__main {
  grid-area: main;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.mgl__sidebar {
  grid-area: sidebar;
  min-height: 0;
}

@media (max-width: 720px) {
  .mgl {
    grid-template-columns: 1fr;
    grid-template-areas: 'main';
    grid-template-rows: minmax(0, 1fr);
    padding: 0 var(--spacing-2);
    padding-top: var(--nav-height);
    padding-bottom: 3rem;
    gap: 0;
  }

  .mgl--lobby {
    height: auto;
    min-height: 100dvh;
    overflow: auto;
    grid-template-rows: auto;
  }

  .mgl__sidebar {
    display: none;
  }

  .mgl--show-sidebar .mgl__main {
    display: none;
  }

  .mgl--show-sidebar .mgl__sidebar {
    display: flex;
    flex-direction: column;
    position: fixed;
    inset: var(--nav-height) 0 3rem 0;
    background: var(--game-surface);
    z-index: var(--z-overlay);
    overflow-y: auto;
  }
}
</style>
