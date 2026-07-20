<script setup lang="ts">
import { computed } from 'vue'
import type { FocusHint } from '@/composables/useMenuFocus'
import type { HintPart, HintState } from '@/composables/useGamepadHint'

const props = withDefaults(
  defineProps<{
    hint: FocusHint | NonNullable<HintState> | null
    visible?: boolean
    glyph?: string
    gap?: number
  }>(),
  { visible: true, glyph: '✕', gap: 12 }
)

const parts = computed((): HintPart[] => {
  if (!props.hint) return []
  if ('parts' in props.hint) return props.hint.parts
  return [{ glyph: props.glyph, label: props.hint.label }]
})
</script>

<template>
  <!-- Teleported to body: an ancestor with a transform/filter would otherwise
       become the containing block for position: fixed and displace the chip. -->
  <Teleport to="body">
    <div
      v-if="hint && visible"
      class="lui-hint"
      aria-hidden="true"
      :style="{
        top: `${hint.rect.top + hint.rect.height / 2}px`,
        left: `${hint.rect.left + hint.rect.width + gap}px`
      }"
    >
      <span v-for="part in parts" :key="part.glyph" class="lui-hint__part">
        <span class="lui-hint__glyph">{{ part.glyph }}</span>
        {{ part.label }}
      </span>
    </div>
  </Teleport>
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
  gap: 0.9em;
}

.lui-hint__part {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
}

.lui-hint__glyph {
  font-weight: 900;
}
</style>
