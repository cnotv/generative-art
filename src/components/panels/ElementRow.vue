<script setup lang="ts">
import { ref } from 'vue'

interface Properties {
  selected?: boolean
  hidden?: boolean
}

defineProps<Properties>()
defineEmits<{ click: [] }>()

const hovered = ref(false)
</script>

<template>
  <div
    class="element-row"
    :class="{
      'element-row--selected': selected,
      'element-row--hidden': hidden
    }"
    role="button"
    tabindex="0"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
    @click="$emit('click')"
    @keydown.enter.space.prevent="$emit('click')"
  >
    <slot :hovered="hovered" />
  </div>
</template>

<style scoped>
.element-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  padding: 0 var(--spacing-1);
  cursor: pointer;
  background: var(--panel-item-bg);
  transition: background-color 150ms;
}

.element-row:hover {
  background-color: var(--panel-item-bg-hover);
}

.element-row--selected {
  background-color: var(--panel-item-bg-selected);
}

.element-row--hidden {
  opacity: var(--opacity-muted);
}
</style>
