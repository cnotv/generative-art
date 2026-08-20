<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useMenuNavigation } from '@/composables/useMenuNavigation'
import { useDialogFocusTrap } from '@/composables/useDialogFocusTrap'
import LobbyUIButton from '@/components/LobbyUI/LobbyUIButton.vue'
import LobbyUIFocusHint from '@/components/LobbyUI/LobbyUIFocusHint.vue'
import { getSecureUrl } from './sensorGuidance'
import type { SensorGuidance } from './types'

const props = defineProps<{
  guidance: SensorGuidance
}>()

const emit = defineEmits<{
  dismiss: []
  requestPermission: []
}>()

const fixReference = ref<InstanceType<typeof LobbyUIButton> | null>(null)
const dialogReference = ref<HTMLElement | null>(null)
const { focusedHint, inputSource } = useDialogFocusTrap(dialogReference)

const secureUrl = computed(() =>
  props.guidance.reason === 'insecure-context' ? getSecureUrl(window.location.href) : null
)

const applyFix = (): void => {
  if (props.guidance.fix === 'request-permission') {
    emit('requestPermission')
    return
  }
  if (props.guidance.fix === 'reload-secure' && secureUrl.value) {
    window.location.replace(secureUrl.value)
  }
}

onMounted(() => {
  const element = fixReference.value?.$el as HTMLElement | undefined
  element?.focus?.()
})

useMenuNavigation(
  (action) => {
    if (action === 'cancel') emit('dismiss')
  },
  undefined,
  { modal: true }
)
</script>

<template>
  <div class="tm-sensor__backdrop" @click.self="emit('dismiss')">
    <div
      ref="dialogReference"
      class="tm-sensor lui-slide-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tm-sensor-title"
    >
      <h2 id="tm-sensor-title" class="tm-sensor__title">{{ guidance.title }}</h2>
      <p class="tm-sensor__summary">{{ guidance.summary }}</p>

      <ol class="tm-sensor__steps">
        <li v-for="step in guidance.steps" :key="step" class="tm-sensor__step">{{ step }}</li>
      </ol>

      <p v-if="secureUrl" class="tm-sensor__url">{{ secureUrl }}</p>

      <div class="tm-sensor__actions" data-lui-row>
        <LobbyUIButton
          v-if="guidance.fix"
          ref="fixReference"
          variant="cta"
          size="sm"
          @click="applyFix"
        >
          {{ guidance.fixLabel }}
        </LobbyUIButton>
        <LobbyUIButton variant="ghost" size="sm" @click="emit('dismiss')">
          Use arrow keys
        </LobbyUIButton>
      </div>
    </div>
    <LobbyUIFocusHint :hint="focusedHint" :visible="inputSource === 'gamepad'" />
  </div>
</template>

<style scoped>
/* A blocking dialog blurs rather than dims, so the board stays recognisable behind it. */
.tm-sensor__backdrop {
  position: absolute;
  inset: 0;
  z-index: var(--z-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-4);
  background: var(--lui-backdrop-tint);
  backdrop-filter: blur(var(--lui-backdrop-blur));
}

.tm-sensor {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-3);
  max-width: 30rem;
  text-align: center;
}

.tm-sensor__title {
  margin: 0;
  font-family: var(--lui-font);
  font-size: var(--lui-text-medium);
  color: var(--lui-focus-color);
  text-shadow: var(--lui-text-shadow);
  text-transform: uppercase;
}

.tm-sensor__summary {
  margin: 0;
  font-family: var(--lui-font);
  font-size: var(--lui-text-small);
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
}

.tm-sensor__steps {
  margin: 0;
  padding-left: var(--spacing-4);
  display: grid;
  gap: var(--spacing-1);
  text-align: left;
}

.tm-sensor__step {
  font-family: var(--lui-font);
  font-size: var(--lui-text-tiny);
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
}

.tm-sensor__url {
  margin: 0;
  font-family: var(--lui-font);
  font-size: var(--lui-text-tiny);
  color: var(--lui-focus-color);
  text-shadow: var(--lui-text-shadow);
  overflow-wrap: anywhere;
}

.tm-sensor__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--spacing-2);
}
</style>
