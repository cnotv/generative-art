<script setup lang="ts">
import GenericPanel from '../GenericPanel.vue'
import SchemaControls from '../ConfigControls.vue'
import { useSceneConfigStore } from '@/stores/sceneConfig'
import { storeToRefs } from 'pinia'

const store = useSceneConfigStore()
const { schema } = storeToRefs(store)
</script>

<template>
  <GenericPanel panel-type="scene" side="right" title="Scene">
    <SchemaControls :schema="schema" :get-value="store.getValue" :on-update="store.updateValue" />
  </GenericPanel>
</template>
