<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GameTabBar from '@/components/GameTabBar.vue'

defineProps<{
  phase: string
  showSidebar: boolean
  unreadCount?: number
}>()

defineEmits<{
  'update:showSidebar': [value: boolean]
}>()

const route = useRoute()
const router = useRouter()
const fromLobby = computed(() => !!route.query.game)
const backToLobby = (): void => {
  router.replace({ query: {} })
}
</script>

<template>
  <main
    class="mgl"
    :class="[`mgl--${phase}`, { 'mgl--show-sidebar': showSidebar, 'mgl--from-lobby': fromLobby }]"
  >
    <div v-if="fromLobby" class="mgl__topbar">
      <button class="mgl__back-btn" type="button" @click="backToLobby">← Lobby</button>
    </div>
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

.mgl--from-lobby {
  grid-template-areas: 'topbar topbar' 'main sidebar';
  grid-template-rows: auto minmax(0, 1fr);
}

.mgl--lobby {
  height: auto;
  min-height: 100dvh;
  overflow: auto;
}

.mgl--lobby.mgl--from-lobby {
  grid-template-rows: auto auto;
}

.mgl__topbar {
  grid-area: topbar;
  display: flex;
  align-items: center;
}

.mgl__back-btn {
  padding: var(--spacing-1) var(--spacing-2);
  border: 2px solid var(--game-border);
  border-radius: 999px;
  background: var(--game-surface-subtle);
  color: var(--game-ink);
  font-size: var(--font-size-sm);
  font-weight: 700;
  cursor: pointer;
  box-shadow: 2px 2px 0 var(--game-border);
  transition: transform 0.1s ease;
  font-family: inherit;
}

.mgl__back-btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 var(--game-border);
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

  .mgl--from-lobby {
    grid-template-areas: 'topbar' 'main';
    grid-template-rows: auto minmax(0, 1fr);
  }

  .mgl--lobby {
    height: auto;
    min-height: 100dvh;
    overflow: auto;
  }

  .mgl--lobby.mgl--from-lobby {
    grid-template-rows: auto auto;
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
