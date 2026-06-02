<script setup lang="ts">
defineProps<{ label?: string }>()
</script>

<template>
  <div class="lui-row" data-lui-row>
    <span v-if="label" class="lui-row__label">{{ label }}</span>
    <div class="lui-row__control">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.lui-row {
  display: grid;
  grid-template-columns: minmax(var(--lui-label-column), auto) 1fr;
  align-items: center;
  gap: var(--spacing-3);
  width: 100%;
}

.lui-row__label {
  font-family: var(--lui-font);
  font-weight: 900;
  font-size: var(--lui-text-small);
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-align: left;
}

.lui-row__control {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--spacing-2);
  flex-wrap: wrap;
  min-width: 0;
}

@media (width <= 480px) {
  .lui-row {
    grid-template-columns: 1fr;
    gap: var(--spacing-1);
  }

  .lui-row__control {
    justify-content: flex-start;
  }
}
</style>
