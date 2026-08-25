<script setup lang="ts">
import { computed } from 'vue'
import SchemaControls from './ConfigControls.vue'
import RecordingControls from '@/components/RecordingControls.vue'
import { Button } from '@/components/ui/button'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent
} from '@/components/ui/accordion'
import { Select } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { RotateCcw, RotateCw } from 'lucide-vue-next'
import { CameraPreset, cameraPresets } from '@webgamekit/threejs'
import { useCameraConfigStore } from '@/stores/cameraConfig'
import { useElementPropertiesStore } from '@/stores/elementProperties'
import { storeToRefs } from 'pinia'

interface Properties {
  isRecording?: boolean
  minDurationMs?: number
  maxDurationMs?: number
}

defineProps<Properties>()

const emit = defineEmits<{
  start: [durationMs: number]
  stop: []
}>()

const cameraConfigStore = useCameraConfigStore()
const {
  activeSlot,
  transitionEnabled,
  followViews,
  activeFollowView,
  followConfig,
  followSettings,
  followTargetLabel,
  followTargets,
  activeFollowTarget,
  orbitEnabled
} = storeToRefs(cameraConfigStore)
const {
  applyPresetToActiveSlot,
  rotateActiveSlot,
  setTransitionEnabled,
  selectFollowView,
  resumeFollowView,
  setOrbitEnabled,
  setFollowTarget,
  updateFollowSetting,
  resetCameraToSceneDefault
} = cameraConfigStore

/** First person in a parallel projection has no vanishing point, so there is nothing to see. */
const ORTHOGRAPHIC_EXCLUDED_VIEWS = ['first']

const availableFollowViews = computed(() =>
  activePresetType.value === 'orthographic'
    ? followViews.value.filter((view) => !ORTHOGRAPHIC_EXCLUDED_VIEWS.includes(view.value))
    : followViews.value
)

const isFollowing = computed(() => activeFollowView.value !== null)

const ROTATION_STEP_DEGREES = 45

const elementPropertiesStore = useElementPropertiesStore()
const { activeProperties } = storeToRefs(elementPropertiesStore)

const hasExpandedSchema = computed(
  () => Object.keys(activeProperties.value?.schema ?? {}).length > 0
)

/**
 * Shorter names for the presets whose id does not read well as a button.
 *
 * Only the exceptions: the list itself is derived from `cameraPresets`, so a preset added to the
 * package appears here without being registered a second time. A hand-written list fell four
 * presets behind and nothing caught it — `Record<CameraPreset, string>` looks like it would, but
 * this file's script block is not type-checked, so the guarantee was imaginary.
 */
const PRESET_LABEL_OVERRIDES: Partial<Record<CameraPreset, string>> = {
  [CameraPreset.OrthographicFollowing]: 'Ortho Follow',
  [CameraPreset.TopDown]: 'Top Down'
}

/**
 * The preset each projection falls back to when the type is toggled rather than a preset picked.
 *
 * Named rather than taken as the first preset of that type: declaration order is not a
 * statement about which preset represents a projection, and relying on it silently turned the
 * Orthographic button into whichever preset happened to be declared first.
 */
const DEFAULT_PRESET_BY_TYPE: Record<'perspective' | 'orthographic', CameraPreset> = {
  perspective: CameraPreset.Perspective,
  orthographic: CameraPreset.Orthographic
}

/**
 * Turn a preset id into a button label: `first-person` reads as `First Person`.
 * @param preset The preset id
 * @returns A title-cased label
 */
const humanisePreset = (preset: string): string =>
  preset
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

const presetLabels = Object.fromEntries(
  (Object.keys(cameraPresets) as CameraPreset[]).map((preset) => [
    preset,
    PRESET_LABEL_OVERRIDES[preset] ?? humanisePreset(preset)
  ])
) as Record<CameraPreset, string>

const activePresetType = computed<'perspective' | 'orthographic'>(() =>
  activeSlot.value ? cameraPresets[activeSlot.value.preset].type : 'perspective'
)

const perspectivePresets = computed(() =>
  (Object.entries(presetLabels) as [CameraPreset, string][]).filter(
    ([preset]) => cameraPresets[preset].type === 'perspective'
  )
)

const orthographicPresets = computed(() =>
  (Object.entries(presetLabels) as [CameraPreset, string][]).filter(
    ([preset]) => cameraPresets[preset].type === 'orthographic'
  )
)

const filteredPresets = computed(() =>
  activePresetType.value === 'perspective' ? perspectivePresets.value : orthographicPresets.value
)

const handleTypeToggle = (type: 'perspective' | 'orthographic') => {
  applyPresetToActiveSlot(DEFAULT_PRESET_BY_TYPE[type])
}
</script>

<template>
  <!-- Properties and Recording stay shut: the presets and the follow rig are what a camera is
       reached for, and two long sections below them push both off the panel. -->
  <Accordion type="multiple" :default-value="['presets', 'following']">
    <AccordionItem value="presets">
      <AccordionTrigger>Presets</AccordionTrigger>
      <AccordionContent>
        <div class="element-camera__type-toggle">
          <Button
            :variant="activePresetType === 'perspective' ? 'default' : 'outline'"
            :disabled="
              !(activeSlot?.supportedCameraTypes ?? ['perspective', 'orthographic']).includes(
                'perspective'
              )
            "
            size="sm"
            class="w-full text-xs"
            @click="handleTypeToggle('perspective')"
            >Perspective</Button
          >
          <Button
            :variant="activePresetType === 'orthographic' ? 'default' : 'outline'"
            :disabled="
              !(activeSlot?.supportedCameraTypes ?? ['perspective', 'orthographic']).includes(
                'orthographic'
              )
            "
            size="sm"
            class="w-full text-xs"
            @click="handleTypeToggle('orthographic')"
            >Orthographic</Button
          >
        </div>
        <div class="element-camera__preset-grid">
          <Button
            v-for="[preset, label] in filteredPresets"
            :key="preset"
            :variant="activeSlot?.preset === preset ? 'default' : 'outline'"
            size="sm"
            class="text-xs"
            @click="applyPresetToActiveSlot(preset)"
            >{{ label }}</Button
          >
        </div>
        <div v-if="availableFollowViews.length" class="element-camera__preset-grid">
          <Button
            v-for="view in availableFollowViews"
            :key="view.value"
            :variant="activeFollowView === view.value ? 'default' : 'outline'"
            size="sm"
            class="text-xs"
            @click="selectFollowView(view.value)"
            >{{ view.label }}</Button
          >
        </div>
        <Button
          :variant="orbitEnabled ? 'default' : 'outline'"
          size="sm"
          class="element-camera__wide-toggle w-full text-xs"
          title="Drag the canvas to orbit the camera"
          @click="setOrbitEnabled(!orbitEnabled)"
        >
          Orbit Controls: {{ orbitEnabled ? 'On' : 'Off' }}
        </Button>
        <div class="element-camera__rotate-row">
          <Button
            variant="outline"
            size="sm"
            class="w-full text-xs"
            title="Rotate camera 45° left around Y"
            @click="rotateActiveSlot(ROTATION_STEP_DEGREES)"
          >
            <RotateCcw />
            45°
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="w-full text-xs"
            title="Rotate camera 45° right around Y"
            @click="rotateActiveSlot(-ROTATION_STEP_DEGREES)"
          >
            <RotateCw />
            45°
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          class="element-camera__wide-toggle w-full text-xs"
          title="Put the camera back where this scene declared it"
          @click="resetCameraToSceneDefault()"
        >
          Reset to scene default
        </Button>
        <Button
          :variant="transitionEnabled ? 'default' : 'outline'"
          size="sm"
          class="element-camera__wide-toggle w-full text-xs"
          title="Animate transitions between camera states"
          @click="setTransitionEnabled(!transitionEnabled)"
        >
          Transitions: {{ transitionEnabled ? 'On' : 'Off' }}
        </Button>
      </AccordionContent>
    </AccordionItem>
    <AccordionItem v-if="followSettings.length" value="following">
      <AccordionTrigger>Following</AccordionTrigger>
      <AccordionContent>
        <Button
          :variant="isFollowing ? 'default' : 'outline'"
          size="sm"
          class="element-camera__wide-toggle w-full text-xs"
          :title="
            isFollowing ? 'Stop following, so presets and rotation hold' : 'Follow the target again'
          "
          @click="isFollowing ? selectFollowView(null) : resumeFollowView()"
        >
          {{ isFollowing ? `Following ${followTargetLabel ?? 'target'}` : 'Not following' }}
        </Button>
        <Button
          :variant="followConfig.followRotation ? 'default' : 'outline'"
          size="sm"
          class="element-camera__wide-toggle w-full text-xs"
          title="Swing the camera round as the target turns, rather than holding its heading"
          @click="updateFollowSetting('followRotation', !followConfig.followRotation)"
        >
          Follow rotation: {{ followConfig.followRotation ? 'On' : 'Off' }}
        </Button>
        <div v-if="followTargets.length" class="element-camera__setting">
          <label for="follow-target" class="text-xs font-medium">Target</label>
          <Select
            id="follow-target"
            :model-value="activeFollowTarget ?? ''"
            :options="followTargets"
            class="h-7 text-xs"
            @update:model-value="(value) => setFollowTarget(String(value))"
          />
        </div>
        <div v-for="setting in followSettings" :key="setting.key" class="element-camera__setting">
          <label :for="`follow-${setting.key}`" class="text-xs font-medium">
            {{ setting.label }}: {{ followConfig[setting.key] }}
          </label>
          <Slider
            :id="`follow-${setting.key}`"
            :model-value="[followConfig[setting.key]]"
            :min="setting.min"
            :max="setting.max"
            :step="setting.step"
            @update:model-value="
              (value) => updateFollowSetting(setting.key, (value as number[])[0])
            "
          />
        </div>
      </AccordionContent>
    </AccordionItem>
    <AccordionItem v-if="hasExpandedSchema" value="properties">
      <AccordionTrigger>Properties</AccordionTrigger>
      <AccordionContent>
        <SchemaControls
          :schema="activeProperties!.schema"
          :get-value="activeProperties!.getValue"
          :on-update="activeProperties!.updateValue"
        />
      </AccordionContent>
    </AccordionItem>
    <AccordionItem value="recording">
      <AccordionTrigger>Recording</AccordionTrigger>
      <AccordionContent>
        <RecordingControls
          :is-recording="isRecording"
          :min-duration-ms="minDurationMs"
          :max-duration-ms="maxDurationMs"
          @start="(ms: number) => emit('start', ms)"
          @stop="emit('stop')"
        />
      </AccordionContent>
    </AccordionItem>
  </Accordion>
</template>

<style scoped>
.element-camera__type-toggle {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-1);
  margin-bottom: var(--spacing-1);
}

.element-camera__preset-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-1);
}

.element-camera__rotate-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-1);
  margin-top: var(--spacing-1);
}

.element-camera__wide-toggle {
  margin-top: var(--spacing-1);
}

.element-camera__setting {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  margin-top: var(--spacing-2);
}
</style>
