<script setup lang="ts">
import { defineAsyncComponent, watch } from 'vue'
import { Check, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { usePanelsStore } from '@/stores/panels'
import { useSoundPanelStore } from '@/stores/soundPanel'

// The whole editor, with its patterns, sounds, timeline and MIDI, only loads when it is opened.
const StrudelEditor = defineAsyncComponent(
  () => import('@/views/Tools/StrudelEditor/StrudelEditor.vue')
)

const soundStore = useSoundPanelStore()
const panelsStore = usePanelsStore()

// The Sound panel's code editor and the full editor share a canvas id, and the panel would sit
// behind the overlay anyway, so it steps aside while the editor is open and comes back after.
watch(
  () => soundStore.editorSlotId !== null,
  (isOpen) => {
    if (isOpen) {
      panelsStore.closePanel('sound')
      return
    }
    // The editor writes its tab and pattern into the address; the game does not want them.
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
    panelsStore.openPanel('sound')
  }
)
</script>

<template>
  <template v-if="soundStore.editorSlotId !== null">
    <div class="sound-editor-overlay" role="dialog" aria-label="Strudel Editor">
      <StrudelEditor />
    </div>
    <div class="sound-editor-overlay__actions" role="group" aria-label="Strudel Editor actions">
      <Button size="sm" @click="soundStore.closeEditor(true)">
        <Check class="sound-editor-overlay__icon" aria-hidden="true" />
        Use code in sound
      </Button>
      <Button size="sm" variant="outline" @click="soundStore.closeEditor(false)">
        <X class="sound-editor-overlay__icon" aria-hidden="true" />
        Close
      </Button>
    </div>
  </template>
</template>

<style scoped>
.sound-editor-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  background-color: var(--color-background);
  color: var(--color-foreground);
}

/* In the band the editor leaves free for the app's navigation bar, between its menu button and
   its panel buttons. A sibling of the overlay rather than a child, because the overlay's own
   stacking context would put it below the bar, which covers it whenever it appears. */
.sound-editor-overlay__actions {
  position: fixed;
  top: 0;
  left: calc(var(--spacing-4) * 3);
  z-index: calc(var(--z-nav) + 1);
  display: flex;
  gap: var(--spacing-2);
  align-items: center;
  height: var(--nav-height);
}

.sound-editor-overlay__icon {
  width: 1em;
  height: 1em;
}
</style>
