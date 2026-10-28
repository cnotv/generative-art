<script setup lang="ts">
import { AccordionRoot } from 'radix-vue'

withDefaults(
  defineProps<{
    type?: 'single' | 'multiple'
    collapsible?: boolean
    defaultValue?: string | string[]
  }>(),
  { type: 'single', collapsible: true, defaultValue: undefined }
)
</script>

<template>
  <AccordionRoot
    :type="type"
    :collapsible="collapsible"
    :default-value="defaultValue"
    class="accordion"
  >
    <slot />
  </AccordionRoot>
</template>

<style>
.accordion {
  width: 100%;
}
</style>
