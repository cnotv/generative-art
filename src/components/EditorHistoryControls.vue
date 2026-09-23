<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'radix-vue'
import { Undo2, Redo2, History } from 'lucide-vue-next'
import IconButton from '@/components/IconButton.vue'
import type { HistoryLogEntry } from '@webgamekit/history'

interface Properties {
  canUndo: boolean
  canRedo: boolean
  log: HistoryLogEntry[]
  size?: 'xs' | 'sm' | 'md' | 'lg'
}

withDefaults(defineProps<Properties>(), { size: 'sm' })
defineEmits<{ undo: []; redo: [] }>()
</script>

<template>
  <IconButton
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
      <IconButton :size="size" variant="outline" title="Action Log" aria-label="Action log">
        <History />
      </IconButton>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent class="history-log" :side-offset="4" align="start">
        <p v-if="log.length === 0" class="history-log__empty">Nothing done yet</p>
        <ol v-else class="history-log__list">
          <li
            v-for="(entry, index) in log"
            :key="`${index}-${entry.label}`"
            class="history-log__entry"
            :class="{ 'history-log__entry--undone': entry.undone }"
          >
            {{ entry.label }}
          </li>
        </ol>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

<!-- The panel is portalled out of this component, so a scoped style never reaches it. -->
<style>
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
}

.history-log__entry--undone {
  color: var(--color-muted-foreground);
  text-decoration: line-through;
}
</style>
