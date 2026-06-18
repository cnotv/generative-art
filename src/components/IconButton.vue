<script setup lang="ts">
import { Button } from '@/components/ui/button'

interface Properties {
  title: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  variant?: 'ghost' | 'default' | 'outline'
  active?: boolean
  panelColors?: boolean
}

withDefaults(defineProps<Properties>(), {
  size: 'md',
  variant: 'ghost',
  active: false,
  panelColors: false
})
</script>

<template>
  <Button
    :variant="variant"
    size="icon"
    class="icon-btn"
    :class="[
      `icon-btn--${size}`,
      { 'icon-btn--panel-colors': panelColors, 'icon-btn--active': active }
    ]"
    :title="title"
  >
    <slot />
  </Button>
</template>

<style>
.icon-btn--xs.btn--icon {
  width: var(--btn-xs-height);
  height: var(--btn-xs-height);
  flex-shrink: 0;
}

.icon-btn--xs.btn--icon svg {
  width: var(--font-size-xs);
  height: var(--font-size-xs);
}

.icon-btn--sm.btn--icon {
  width: var(--btn-sm-height);
  height: var(--btn-sm-height);
  flex-shrink: 0;
}

.icon-btn--sm.btn--icon svg {
  width: var(--font-size-base);
  height: var(--font-size-base);
}

.icon-btn--md.btn--icon {
  width: var(--btn-md-height);
  height: var(--btn-md-height);
  flex-shrink: 0;
}

.icon-btn--md.btn--icon svg {
  width: var(--font-size-md);
  height: var(--font-size-md);
}

.icon-btn--lg.btn--icon {
  width: var(--btn-lg-height);
  height: var(--btn-lg-height);
  flex-shrink: 0;
}

.icon-btn--lg.btn--icon svg {
  width: var(--font-size-md);
  height: var(--font-size-md);
}

.icon-btn--panel-colors.btn--ghost.btn--icon {
  background: var(--panel-item-bg-hover);
  color: var(--color-foreground);
}

.icon-btn--panel-colors.btn--ghost.btn--icon.icon-btn--active {
  background: var(--panel-item-bg-selected);
}

.icon-btn--panel-colors.btn--ghost.btn--icon:hover,
.icon-btn--panel-colors.btn--ghost.btn--icon:focus-visible {
  background: var(--panel-item-bg);
}
</style>
