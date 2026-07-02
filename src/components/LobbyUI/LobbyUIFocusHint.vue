<script setup lang="ts">
import type { FocusHint } from '@/composables/useMenuFocus'

withDefaults(
  defineProps<{
    hint: FocusHint | null
    visible?: boolean
    glyph?: string
    gap?: number
  }>(),
  { visible: true, glyph: '✕', gap: 12 }
)
</script>

<template>
  <div
    v-if="hint && visible"
    class="lui-hint"
    aria-hidden="true"
    :style="{
      top: `${hint.rect.top + hint.rect.height / 2}px`,
      left: `${hint.rect.left + hint.rect.width + gap}px`
    }"
  >
    <span class="lui-hint__glyph">{{ glyph }}</span>
    {{ hint.label }}
  </div>
</template>

<style scoped>
.lui-hint {
  position: fixed;
  z-index: var(--z-tooltip, 300);
  transform: translateY(-50%);
  pointer-events: none;
  font-family: var(--lui-font);
  font-size: var(--lui-text-small);
  line-height: 1;
  color: #000;
  background: var(--lui-focus-color);
  padding-inline: 0.7em;
  padding-block: 0.4em;
  border-radius: 999px;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
}

.lui-hint__glyph {
  font-weight: 900;
}
</style>
