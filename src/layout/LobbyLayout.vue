<script setup lang="ts">
import { ref, computed, useSlots } from 'vue'
import { LobbyUIButton } from '@/components/LobbyUI'
import { useMenuNavigation } from '@/composables/useMenuNavigation'
import '@/assets/styles/lobby-ui.scss'

const props = withDefaults(
  defineProps<{
    phase: string
    showSidebar?: boolean
    sidebarWidth?: string
    mainPlacement?: 'fill' | 'center'
    hideHeaderOnMobile?: boolean
    sidebarVisible?: boolean
  }>(),
  {
    showSidebar: false,
    sidebarWidth: '280px',
    mainPlacement: 'center',
    hideHeaderOnMobile: false,
    sidebarVisible: undefined
  }
)

const slots = useSlots()
const hasSidebar = computed(() => (props.sidebarVisible ?? true) && !!slots.sidebar)
const hasRules = computed(() => !!slots.rules)
const rulesOpen = ref(false)

const emit = defineEmits<{ leaveRoom: [] }>()

useMenuNavigation((action) => {
  if (action === 'cancel') {
    if (rulesOpen.value) {
      rulesOpen.value = false
    } else {
      emit('leaveRoom')
    }
  }
})

const layoutStyle = computed(() => ({
  '--ll-columns': hasSidebar.value ? `1fr ${props.sidebarWidth}` : '1fr',
  '--ll-areas': hasSidebar.value ? "'header header' 'main sidebar'" : "'header' 'main'"
}))
</script>

<template>
  <main
    class="lobby-layout"
    :class="[`lobby-layout--${phase}`, { 'lobby-layout--show-sidebar': showSidebar }]"
    :style="layoutStyle"
  >
    <div
      class="lobby-layout__header"
      :class="{ 'lobby-layout__header--hide-mobile': hideHeaderOnMobile }"
    >
      <slot name="header" />
      <LobbyUIButton
        v-if="hasRules"
        variant="ghost"
        :aria-expanded="rulesOpen"
        @click="rulesOpen = !rulesOpen"
      >
        ?
      </LobbyUIButton>
      <Transition name="ll-rules">
        <div v-if="rulesOpen" class="lobby-layout__rules-panel">
          <LobbyUIButton
            variant="ghost"
            class="lobby-layout__rules-close"
            @click="rulesOpen = false"
          >
            ×
          </LobbyUIButton>
          <slot name="rules" />
        </div>
      </Transition>
    </div>
    <div
      class="lobby-layout__main"
      :class="{ 'lobby-layout__main--center': mainPlacement === 'center' }"
    >
      <slot />
    </div>
    <div v-if="hasSidebar" class="lobby-layout__sidebar">
      <slot name="sidebar" />
    </div>
    <slot name="tabbar" />
  </main>
</template>

<style scoped>
.lobby-layout {
  touch-action: manipulation;
  display: grid;
  grid-template-columns: var(--ll-columns);
  grid-template-areas: var(--ll-areas);
  grid-template-rows: auto minmax(0, 1fr);
  padding: var(--spacing-3);
  padding-top: calc(var(--nav-height) + var(--spacing-3));
  gap: var(--spacing-3);
  height: 100dvh;
  box-sizing: border-box;
  overflow: hidden;
}

.lobby-layout--lobby {
  overflow-y: auto;
}

.lobby-layout__header {
  grid-area: header;
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  position: relative;
}

.lobby-layout__rules-panel {
  position: absolute;
  top: calc(100% + var(--spacing-2));
  left: 0;
  z-index: var(--z-overlay, 100);
  background: rgb(0 0 0 / 0.85);
  border: 2px solid var(--lui-stroke-faint);
  border-radius: var(--radius-md, 0.75rem);
  box-shadow: var(--lui-border-shadow);
  padding: var(--spacing-3);
  min-width: 18rem;
  max-width: 24rem;
}

.lobby-layout__rules-close {
  position: absolute;
  top: var(--spacing-1);
  right: var(--spacing-1);
}

.lobby-layout__main {
  grid-area: main;
  min-height: 0;
  animation: slide-up 0.28s ease both;
}

.lobby-layout__main--center {
  display: flex;
  place-content: center;
}

.lobby-layout__sidebar {
  grid-area: sidebar;
  animation: slide-from-right 0.32s ease both;
}

.ll-rules-enter-active,
.ll-rules-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.ll-rules-enter-from,
.ll-rules-leave-to {
  opacity: 0;
  transform: translateY(-0.25rem);
}

@media (width <= 720px) {
  .lobby-layout {
    grid-template: 'header' auto 'main' 1fr / 1fr;
    height: 100dvh;
    padding: 0 var(--spacing-2);
    padding-top: var(--nav-height);
    padding-bottom: 3rem;
    gap: var(--spacing-2);
    overflow: hidden;
  }

  .lobby-layout--lobby {
    height: auto;
    min-height: 100dvh;
    overflow: auto;
  }

  .lobby-layout__header--hide-mobile {
    display: none;
  }

  .lobby-layout__sidebar {
    grid-area: main;
    display: none;
  }

  .lobby-layout--show-sidebar .lobby-layout__main {
    display: none;
  }

  .lobby-layout--show-sidebar .lobby-layout__sidebar {
    display: flex;
  }
}
</style>
