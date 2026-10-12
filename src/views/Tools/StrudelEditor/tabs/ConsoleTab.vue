<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import type { StrudelLogEntry } from '../types'

const props = defineProps<{
  logEntries: StrudelLogEntry[]
}>()

const emit = defineEmits<{
  clear: []
}>()

const scrollContainer = ref<HTMLElement | null>(null)

watch(
  () => props.logEntries.length,
  async () => {
    await nextTick()
    if (scrollContainer.value) {
      scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight
    }
  }
)

const onClear = (): void => {
  emit('clear')
}
</script>

<template>
  <div class="strudel-console">
    <div class="strudel-console__toolbar">
      <button class="strudel-console__clear" type="button" @click="onClear">Clear</button>
    </div>
    <div ref="scrollContainer" class="strudel-console__output">
      <p
        v-for="entry in logEntries"
        :key="entry.id"
        class="strudel-console__line"
        :class="`strudel-console__line--${entry.level}`"
      >
        {{ entry.message }}
      </p>
      <p v-if="logEntries.length === 0" class="strudel-console__placeholder">
        Console output appears here when you play or evaluate patterns.
      </p>
    </div>
  </div>
</template>

<style scoped>
.strudel-console {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.strudel-console__toolbar {
  display: flex;
  justify-content: flex-end;
  padding: var(--spacing-2);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.strudel-console__clear {
  padding: var(--spacing-1) var(--spacing-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  color: var(--color-foreground);
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.strudel-console__output {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-2);
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  line-height: 1.5;
}

.strudel-console__line {
  margin: 0;
  padding: var(--spacing-1) 0;
}

.strudel-console__line--error {
  color: #dc2626;
}

.strudel-console__line--warn {
  color: #d97706;
}

.strudel-console__line--info {
  color: var(--color-foreground);
}

.strudel-console__placeholder {
  color: var(--color-muted-foreground);
  font-style: italic;
}
</style>
