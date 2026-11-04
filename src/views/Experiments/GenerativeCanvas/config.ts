export const INITIAL_CANVAS_STATE = { count: 0 }

export const COMPONENT_EXAMPLES = [
  {
    id: 'pill',
    label: 'Pill button',
    source: `<script setup>
const props = defineProps({ count: Number })
const emit = defineEmits(['update'])
</script>

<template>
  <button class="pill" @click="emit('update', { count: props.count + 1 })">
    Clicked {{ props.count }} times
  </button>
</template>

<style scoped>
.pill {
  margin: 2rem;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 999px;
  background: #c9d4f5;
  color: #2c3557;
  font: 600 1rem system-ui, sans-serif;
  cursor: pointer;
}
</style>
`
  },
  {
    id: 'card',
    label: 'Stepper card',
    source: `<script>
export default {
  props: { count: Number },
  emits: ['update']
}
</script>

<template>
  <section class="card">
    <h2 class="card__value">{{ count }}</h2>
    <div class="card__actions">
      <button @click="$emit('update', { count: count - 1 })">Less</button>
      <button @click="$emit('update', { count: count + 1 })">More</button>
    </div>
  </section>
</template>

<style scoped>
.card {
  margin: 2rem;
  padding: 1.5rem;
  border-radius: 1rem;
  background: #f4dce3;
  color: #5a2f3c;
  font-family: system-ui, sans-serif;
  text-align: center;
}

.card__value {
  margin: 0 0 1rem;
  font-size: 3rem;
}

.card__actions {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}
</style>
`
  },
  {
    id: 'compile-error',
    label: 'Compile error',
    source: `<template>
  <p>This tag is never closed
</template>
`
  },
  {
    id: 'runtime-error',
    label: 'Runtime error',
    source: `<script setup>
throw new Error('This component fails while it mounts')
</script>

<template>
  <p>Never shown</p>
</template>
`
  }
]
