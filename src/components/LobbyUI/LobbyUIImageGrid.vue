<script setup lang="ts">
type GridItem = { id: string; name: string; url: string }

const props = defineProps<{
  modelValue: string
  items: GridItem[]
  isItemDisabled?: (id: string) => boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const selectedName = (): string =>
  props.items.find((item) => item.id === props.modelValue)?.name ?? ''
</script>

<template>
  <div class="lui-grid">
    <div class="lui-grid__items">
      <button
        v-for="item in items"
        :key="item.id"
        class="lui-grid__btn"
        :class="{
          'lui-grid__btn--active': modelValue === item.id,
          'lui-grid__btn--disabled': isItemDisabled?.(item.id)
        }"
        :title="isItemDisabled?.(item.id) ? `${item.name} (taken)` : item.name"
        type="button"
        :disabled="isItemDisabled?.(item.id)"
        @click="emit('update:modelValue', item.id)"
      >
        <img :src="item.url" :alt="item.name" class="lui-grid__img" />
      </button>
    </div>
    <span class="lui-grid__selected-name">{{ selectedName() }}</span>
  </div>
</template>

<style scoped>
.lui-grid {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--spacing-1);
}

.lui-grid__items {
  display: flex;
  column-gap: var(--spacing-3);
  row-gap: var(--spacing-2);
  flex-wrap: wrap;
  justify-content: flex-end;
}

.lui-grid__selected-name {
  font-family: var(--lui-font);
  font-weight: 700;
  font-size: var(--lui-text-tiny);
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.lui-grid__btn {
  position: relative;
  width: 2.5rem;
  height: 2.5rem;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 50%;
  background: none;
  cursor: pointer;
  transition:
    transform 0.15s,
    opacity 0.15s,
    border-color 0.15s;
  flex-shrink: 0;
}

.lui-grid__btn::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background:
    radial-gradient(circle at 35% 32%, rgb(255 255 255 / 0.55) 0%, transparent 52%),
    radial-gradient(circle at 68% 72%, rgb(0 0 0 / 0.28) 0%, transparent 45%);
  pointer-events: none;
}

.lui-grid__btn:hover:not(:disabled) {
  transform: scale(1.15);
}

.lui-grid__btn--active {
  transform: scale(1.2);
  border-color: var(--lui-stroke);
}

.lui-grid__btn:focus,
.lui-grid__btn:focus-visible {
  outline: 3px solid #ffd700;
  outline-offset: 4px;
}

.lui-grid__btn--disabled {
  opacity: 0.25;
  cursor: not-allowed;
}

.lui-grid__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  border-radius: 50%;
}
</style>
