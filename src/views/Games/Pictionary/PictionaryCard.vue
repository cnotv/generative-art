<script setup lang="ts">
import GameCard from '@/components/GameCard.vue'

withDefaults(
  defineProps<{
    tag?: string
  }>(),
  { tag: 'div' }
)
</script>

<template>
  <GameCard><slot /></GameCard>
</template>
