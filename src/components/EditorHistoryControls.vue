<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'radix-vue'
import { Undo2, Redo2, ChevronDown } from 'lucide-vue-next'
import IconButton from '@/components/IconButton.vue'
import type { HistoryLogEntry } from '@webgamekit/history'

interface Properties {
  canUndo: boolean
  canRedo: boolean
  log: HistoryLogEntry[]
  size?: 'xs' | 'sm' | 'md' | 'lg'
}

withDefaults(defineProps<Properties>(), { size: 'sm' })
defineEmits<{ undo: []; redo: []; goTo: [index: number] }>()
</script>

<template>
  <div class="history-controls">
    <IconButton
      class="history-controls__button"
      :size="size"
      variant="outline"
      title="Undo"
      aria-label="Undo"
      :disabled="!canUndo"
      @click="$emit('undo')"
    >
      <Undo2 />
    </IconButton>
    <IconButton
      class="history-controls__button"
      :size="size"
      variant="outline"
      title="Redo"
      aria-label="Redo"
      :disabled="!canRedo"
      @click="$emit('redo')"
    >
      <Redo2 />
    </IconButton>
    <DropdownMenuRoot>
      <DropdownMenuTrigger as-child>
        <IconButton
          class="history-controls__button history-controls__caret"
          :size="size"
          variant="outline"
          title="Action log, click an action to step straight to it"
          aria-label="Action log"
        >
          <ChevronDown />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent class="history-log" :side-offset="4" align="start">
          <p v-if="log.length === 0" class="history-log__empty">Nothing done yet</p>
          <ol v-else class="history-log__list">
            <DropdownMenuItem
              v-for="entry in log"
              :key="entry.index"
              as="li"
              class="history-log__entry"
              :class="{ 'history-log__entry--undone': entry.undone }"
              @select="$emit('goTo', entry.index)"
            >
              {{ entry.label }}
            </DropdownMenuItem>
          </ol>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  </div>
</template>

<!-- The panel is portalled out of this component, so a scoped style never reaches it. -->
<style>
.history-controls {
  display: inline-flex;
}

/* One control rather than three: shared edges, so only the outer corners are rounded. */
.history-controls .history-controls__button.icon-btn:not(:first-child) {
  margin-left: -1px;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

.history-controls .history-controls__button.icon-btn:not(:last-child) {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.history-controls .history-controls__button.icon-btn:hover,
.history-controls .history-controls__button.icon-btn:focus-visible {
  position: relative;
}

.history-controls .history-controls__caret.icon-btn {
  width: auto;
  padding: 0 var(--spacing-0-5);
}

.history-log {
  max-height: 16rem;
  min-width: 12rem;
  overflow-y: auto;
  padding: var(--spacing-1);
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  color: var(--color-foreground);
  font-size: var(--font-size-sm);
}

.history-log__empty {
  margin: 0;
  padding: var(--spacing-1);
  color: var(--color-muted-foreground);
}

.history-log__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.history-log__entry {
  padding: var(--spacing-1);
  border-radius: var(--radius-sm);
  cursor: pointer;
  outline: none;
}

.history-log__entry:hover,
.history-log__entry[data-highlighted] {
  background: var(--color-accent);
}

.history-log__entry--undone {
  color: var(--color-muted-foreground);
  text-decoration: line-through;
}
</style>
