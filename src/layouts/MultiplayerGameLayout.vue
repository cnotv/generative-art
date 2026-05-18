<script setup lang="ts">
import { computed, useSlots } from 'vue'
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
const slots = useSlots()
const fromLobby = computed(() => !!route.query.game)
const hasHeader = computed(() => !!slots.header)
const backToLobby = (): void => {
  router.replace({ query: {} })
}

const gridAreas = computed(() => {
  if (fromLobby.value && hasHeader.value) return "'nav nav' 'header header' 'main sidebar'"
  if (fromLobby.value) return "'nav nav' 'main sidebar'"
  if (hasHeader.value) return "'header header' 'main sidebar'"
  return "'main sidebar'"
})

const gridRows = computed(() => {
  if (fromLobby.value && hasHeader.value) return 'auto auto minmax(0, 1fr)'
  if (fromLobby.value || hasHeader.value) return 'auto minmax(0, 1fr)'
  return 'minmax(0, 1fr)'
})

const mobileGridAreas = computed(() => {
  if (fromLobby.value && hasHeader.value) return "'nav' 'header' 'main'"
  if (fromLobby.value) return "'nav' 'main'"
  if (hasHeader.value) return "'header' 'main'"
  return "'main'"
})

const mobileGridRows = computed(() => {
  if (fromLobby.value && hasHeader.value) return 'auto auto minmax(0, 1fr)'
  if (fromLobby.value || hasHeader.value) return 'auto minmax(0, 1fr)'
  return 'minmax(0, 1fr)'
})
</script>

<template>
  <main
    class="mgl"
    :class="[`mgl--${phase}`, { 'mgl--show-sidebar': showSidebar }]"
    :style="{
      gridTemplateAreas: gridAreas,
      gridTemplateRows: gridRows,
      '--mgl-mobile-areas': mobileGridAreas,
      '--mgl-mobile-rows': mobileGridRows
    }"
  >
    <div v-if="fromLobby" class="mgl__nav">
      <button class="mgl__back-btn" type="button" @click="backToLobby">← Lobby</button>
    </div>
    <div v-if="hasHeader" class="mgl__header">
      <slot name="header" />
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
}

.mgl__nav {
  grid-area: nav;
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

.mgl__header {
  grid-area: header;
  display: flex;
  align-items: center;
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
    grid-template-areas: var(--mgl-mobile-areas, 'main');
    grid-template-rows: var(--mgl-mobile-rows, minmax(0, 1fr));
    padding: 0 var(--spacing-2);
    padding-top: var(--nav-height);
    padding-bottom: 3rem;
    gap: var(--spacing-2);
    overflow: hidden;
  }

  .mgl--lobby {
    height: auto;
    min-height: 100dvh;
    overflow: auto;
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
