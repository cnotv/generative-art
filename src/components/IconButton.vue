<script setup lang="ts">
import { Button } from '@/components/ui/button';

interface Props {
  title: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'ghost' | 'default' | 'outline';
  active?: boolean;
}

withDefaults(defineProps<Props>(), { size: 'md', variant: 'ghost', active: false });

defineEmits<{ click: [] }>();
</script>

<template>
  <Button
    :variant="active ? 'default' : variant"
    size="icon"
    class="icon-btn"
    :class="`icon-btn--${size}`"
    :title="title"
    @click="$emit('click')"
  >
    <slot />
  </Button>
</template>

<style scoped>
.icon-btn--sm {
  width: var(--btn-sm-height);
  height: var(--btn-sm-height);
  flex-shrink: 0;
}

.icon-btn--sm :deep(svg) {
  width: var(--font-size-base);
  height: var(--font-size-base);
}

.icon-btn--md {
  width: var(--btn-md-height);
  height: var(--btn-md-height);
  flex-shrink: 0;
}

.icon-btn--md :deep(svg) {
  width: var(--font-size-md);
  height: var(--font-size-md);
}

.icon-btn--lg {
  width: var(--btn-lg-height);
  height: var(--btn-lg-height);
  flex-shrink: 0;
}

.icon-btn--lg :deep(svg) {
  width: var(--font-size-md);
  height: var(--font-size-md);
}
</style>
