<script setup lang="ts">
import { Music, Volume2 } from 'lucide-vue-next'
import { LobbyUIIconButton } from '@/components/LobbyUI'
import type { SoundSettings } from '../types'

defineProps<{ settings: SoundSettings }>()
const emit = defineEmits<{ toggle: [kind: keyof SoundSettings] }>()
</script>

<template>
  <div class="rr-sound-toggles">
    <LobbyUIIconButton
      size="md"
      :title="settings.music ? 'Turn the music off' : 'Turn the music on'"
      :aria-label="settings.music ? 'Turn the music off' : 'Turn the music on'"
      :aria-pressed="settings.music"
      @click="emit('toggle', 'music')"
    >
      <Music class="rr-sound-toggles__icon" aria-hidden="true" />
      <span v-if="!settings.music" class="rr-sound-toggles__bar" aria-hidden="true"></span>
    </LobbyUIIconButton>
    <LobbyUIIconButton
      size="md"
      :title="settings.effects ? 'Turn the sounds off' : 'Turn the sounds on'"
      :aria-label="settings.effects ? 'Turn the sounds off' : 'Turn the sounds on'"
      :aria-pressed="settings.effects"
      @click="emit('toggle', 'effects')"
    >
      <Volume2 class="rr-sound-toggles__icon" aria-hidden="true" />
      <span v-if="!settings.effects" class="rr-sound-toggles__bar" aria-hidden="true"></span>
    </LobbyUIIconButton>
  </div>
</template>

<style scoped>
.rr-sound-toggles {
  display: flex;
  gap: var(--spacing-2);
}

.rr-sound-toggles__icon {
  width: 1.5em;
  height: 1.5em;
}

/* The bar is what says "off": the icon alone cannot, since it is the same glyph either way. */
.rr-sound-toggles__bar {
  position: absolute;
  width: 2em;
  height: 0.15em;
  border-radius: var(--lui-radius-sketch-round);
  background: currentcolor;
  transform: rotate(-45deg);
}
</style>
