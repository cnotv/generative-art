<script setup lang="ts">
withDefaults(
  defineProps<{
    tag?: string
  }>(),
  { tag: 'div' }
)
</script>

<template>
  <component :is="tag" class="pictionary-card">
    <slot />
  </component>
</template>

<style scoped>
.pictionary-card {
  background: #fff;
  border: 3px solid #111;
  border-radius: 1.25rem;
  box-shadow: 4px 4px 0 #111;
  box-sizing: border-box;
  color: #111;
}
</style>
