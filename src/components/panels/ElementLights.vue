<script setup lang="ts">
import { computed } from 'vue'
import SchemaControls from './ConfigControls.vue'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent
} from '@/components/ui/accordion'
import { lightPresets } from '@webgamekit/threejs'
import type { LightPreset } from '@webgamekit/threejs'
import { useSceneViewStore } from '@/stores/sceneView'
import type { LightGroup } from '@/stores/sceneView'
import {
  lightsSchema,
  environmentLightSchema,
  hemisphereLightSchema,
  skySchema
} from '@/views/Tools/SceneEditor/config'
import { getNestedValue } from '@/utils/nestedObjects'
import { storeToRefs } from 'pinia'

const sceneViewStore = useSceneViewStore()
const { lightsConfig, skyConfig, activeLightPreset, lightTransitionEnabled, lightTransitionSpeed } =
  storeToRefs(sceneViewStore)
const {
  applyLightPreset,
  updateLightValue,
  updateSkyValue,
  setLightTransitionEnabled,
  setLightTransitionSpeed
} = sceneViewStore

const TRANSITION_SPEED = { min: 0.25, max: 8, step: 0.25 }

const presetLabels = Object.keys(lightPresets).map((preset) => ({
  value: preset as LightPreset,
  label: preset.charAt(0).toUpperCase() + preset.slice(1)
}))

/** Each light group, in the order they stack from the sky down to the objects. */
const lightSections: { group: LightGroup; label: string; schema: Record<string, unknown> }[] = [
  { group: 'environment', label: 'Environment Light', schema: environmentLightSchema },
  { group: 'hemisphere', label: 'Hemisphere Light', schema: hemisphereLightSchema },
  { group: 'ambient', label: 'Ambient Light', schema: lightsSchema.ambient },
  { group: 'directional', label: 'Directional Light', schema: lightsSchema.directional }
]

const availableSections = computed(() =>
  lightSections.filter((section) => lightsConfig.value[section.group] !== undefined)
)

const hasSky = computed(() => Object.keys(skyConfig.value).length > 0)

const getLightValue = (group: LightGroup, path: string) =>
  getNestedValue((lightsConfig.value[group] ?? {}) as Record<string, unknown>, path)
</script>

<template>
  <!-- Every section starts shut: the whole rig is five groups of controls, and opening any
       of them by default pushes the presets and the player off the panel. -->
  <Accordion type="multiple" class="element-lights">
    <AccordionItem value="presets">
      <AccordionTrigger>Presets</AccordionTrigger>
      <AccordionContent>
        <div class="element-lights__preset-grid">
          <Button
            v-for="preset in presetLabels"
            :key="preset.value"
            :variant="activeLightPreset === preset.value ? 'default' : 'outline'"
            size="sm"
            class="text-xs"
            @click="applyLightPreset(preset.value)"
            >{{ preset.label }}</Button
          >
        </div>

        <div class="element-lights__player">
          <label class="element-lights__player-row" for="light-transition-toggle">
            <span class="text-xs font-medium">Transition</span>
            <Switch
              id="light-transition-toggle"
              :model-value="lightTransitionEnabled"
              @update:model-value="setLightTransitionEnabled"
            />
          </label>
          <label class="text-xs font-medium" for="light-transition-speed">
            Speed: {{ lightTransitionSpeed }}x
          </label>
          <Slider
            id="light-transition-speed"
            :model-value="[lightTransitionSpeed]"
            :min="TRANSITION_SPEED.min"
            :max="TRANSITION_SPEED.max"
            :step="TRANSITION_SPEED.step"
            @update:model-value="(value) => setLightTransitionSpeed((value as number[])[0])"
          />
        </div>
      </AccordionContent>
    </AccordionItem>

    <AccordionItem v-for="section in availableSections" :key="section.group" :value="section.group">
      <AccordionTrigger>{{ section.label }}</AccordionTrigger>
      <AccordionContent>
        <SchemaControls
          :schema="section.schema"
          :get-value="(path: string) => getLightValue(section.group, path)"
          :on-update="
            (path: string, value: unknown) => updateLightValue(section.group, path, value)
          "
        />
      </AccordionContent>
    </AccordionItem>

    <AccordionItem v-if="hasSky" value="sky">
      <AccordionTrigger>Sky</AccordionTrigger>
      <AccordionContent>
        <SchemaControls
          :schema="skySchema"
          :get-value="(path: string) => getNestedValue(skyConfig, path)"
          :on-update="updateSkyValue"
        />
      </AccordionContent>
    </AccordionItem>
  </Accordion>
</template>

<style scoped>
.element-lights__preset-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-1);
}

.element-lights__player {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  margin-top: var(--spacing-2);
  padding-top: var(--spacing-2);
  border-top: 1px solid var(--color-border);
}

.element-lights__player-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
