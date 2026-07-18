<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useMenuNavigation } from '@/composables/useMenuNavigation'
import { useDialogFocusTrap } from '@/composables/useDialogFocusTrap'
import LobbyUIButton from './LobbyUIButton.vue'
import LobbyUIFocusHint from './LobbyUIFocusHint.vue'

const props = defineProps<{
  message: string
  confirmLabel?: string
  cancelLabel?: string
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const confirmReference = ref<InstanceType<typeof LobbyUIButton> | null>(null)
const dialogReference = ref<HTMLElement | null>(null)
const { focusedHint, inputSource } = useDialogFocusTrap(dialogReference)

onMounted(() => {
  const element = confirmReference.value?.$el as HTMLElement | undefined
  element?.focus?.()
})

useMenuNavigation(
  (action) => {
    if (action === 'cancel') emit('cancel')
  },
  undefined,
  { modal: true }
)
</script>

<template>
  <div class="lui-confirm__backdrop" @click.self="emit('cancel')">
    <div ref="dialogReference" class="lui-confirm lui-slide-in" role="dialog" aria-modal="true">
      <p class="lui-confirm__message">{{ message }}</p>
      <div class="lui-confirm__actions" data-lui-row>
        <LobbyUIButton ref="confirmReference" variant="primary" @click="emit('confirm')">
          {{ confirmLabel ?? 'Leave' }}
        </LobbyUIButton>
        <LobbyUIButton variant="ghost" @click="emit('cancel')">
          {{ cancelLabel ?? 'Cancel' }}
        </LobbyUIButton>
      </div>
    </div>
    <LobbyUIFocusHint :hint="focusedHint" :visible="inputSource === 'gamepad'" />
  </div>
</template>

<style scoped>
.lui-confirm__backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-overlay, 200);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--lui-backdrop-tint);
  backdrop-filter: blur(var(--lui-backdrop-blur));
}

.lui-confirm {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  max-width: 22rem;
  width: 90%;
  text-align: center;
}

.lui-confirm__message {
  margin: 0;
  font-family: var(--lui-font);
  font-size: var(--lui-text-medium);
  font-weight: 700;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  line-height: 1.3;
}

.lui-confirm__actions {
  display: flex;
  gap: var(--spacing-3);
  justify-content: center;
}
</style>
