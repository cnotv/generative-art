<script setup lang="ts">
import { ChevronDown, SlidersHorizontal } from 'lucide-vue-next'

defineProps<{
  badge: string
  summary: string
  meta?: string
}>()
</script>

<template>
  <details class="strudel-flow-accordion">
    <summary class="strudel-flow-accordion__trigger">
      <SlidersHorizontal class="strudel-flow-accordion__icon" aria-hidden="true" />
      <span class="strudel-flow-accordion__badge">{{ badge }}</span>
      <span class="strudel-flow-accordion__summary">{{ summary }}</span>
      <span v-if="meta" class="strudel-flow-accordion__meta">· {{ meta }}</span>
      <ChevronDown class="strudel-flow-accordion__chevron" aria-hidden="true" />
    </summary>
    <div class="strudel-flow-accordion__content">
      <slot />
    </div>
  </details>
</template>
