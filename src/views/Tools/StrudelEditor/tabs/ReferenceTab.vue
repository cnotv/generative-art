<script setup lang="ts">
import { computed, ref } from 'vue'

const searchQuery = ref('')

const functions = [
  { name: 's', description: 'Play a sound by name, e.g. s("bd sd")' },
  { name: 'note', description: 'Play a note, e.g. note("c3 e3 g3")' },
  { name: 'chord', description: 'Play a chord, e.g. chord("Cmaj7")' },
  { name: 'stack', description: 'Layer multiple patterns together' },
  { name: 'seq', description: 'Sequence patterns in order' },
  { name: 'cat', description: 'Concatenate patterns' },
  { name: 'fast', description: 'Speed up a pattern' },
  { name: 'slow', description: 'Slow down a pattern' },
  { name: 'jux', description: 'Apply a function to one stereo channel' },
  { name: 'rev', description: 'Reverse a pattern' },
  { name: 'ply', description: 'Repeat each event a number of times' },
  { name: 'gain', description: 'Set the volume of a pattern' },
  { name: 'lpf', description: 'Low-pass filter' },
  { name: 'hpf', description: 'High-pass filter' },
  { name: 'delay', description: 'Add delay effect' },
  { name: 'room', description: 'Add reverb effect' },
  { name: 'struct', description: 'Apply a rhythmic structure' },
  { name: 'mask', description: 'Filter events by a boolean pattern' },
  { name: 'scale', description: 'Set the musical scale' },
  { name: 'degradeBy', description: 'Randomly drop events' },
  { name: 'sometimes', description: 'Apply a function occasionally' },
  { name: 'every', description: 'Apply a function on a cycle interval' },
  { name: 'layer', description: 'Apply multiple functions to the same pattern' },
  { name: 'palindrome', description: 'Play forwards then backwards' },
  { name: 'range', description: 'Map a pattern to a numeric range' }
]

const filteredFunctions = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (query.length === 0) {
    return functions
  }
  return functions.filter(
    (fn) => fn.name.toLowerCase().includes(query) || fn.description.toLowerCase().includes(query)
  )
})
</script>

<template>
  <div class="strudel-reference">
    <input
      v-model="searchQuery"
      class="strudel-reference__search"
      type="search"
      placeholder="Search functions..."
      aria-label="Search functions"
    />
    <p class="strudel-reference__hint">
      Full API docs at
      <a href="https://strudel.cc/learn/" target="_blank" rel="noopener">strudel.cc/learn</a>
    </p>
    <ul class="strudel-reference__list">
      <li v-for="fn in filteredFunctions" :key="fn.name" class="strudel-reference__item">
        <code class="strudel-reference__name">{{ fn.name }}</code>
        <span class="strudel-reference__description">{{ fn.description }}</span>
      </li>
    </ul>
    <p v-if="filteredFunctions.length === 0" class="strudel-reference__empty">No functions found</p>
  </div>
</template>

<style scoped>
.strudel-reference {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  padding: var(--spacing-4);
}

.strudel-reference__search {
  width: 100%;
  padding: var(--spacing-2) var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  color: var(--color-foreground);
  font-size: var(--font-size-md);
  box-sizing: border-box;
}

.strudel-reference__hint {
  font-size: var(--font-size-sm);
  color: var(--color-muted-foreground);
  margin: 0;
}

.strudel-reference__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.strudel-reference__item {
  display: flex;
  gap: var(--spacing-2);
  align-items: baseline;
}

.strudel-reference__name {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--color-primary);
  min-width: 5rem;
}

.strudel-reference__description {
  font-size: var(--font-size-sm);
  color: var(--color-muted-foreground);
}

.strudel-reference__empty {
  color: var(--color-muted-foreground);
  font-size: var(--font-size-sm);
  text-align: center;
  padding: var(--spacing-4);
}
</style>
