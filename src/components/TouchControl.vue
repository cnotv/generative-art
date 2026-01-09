<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";
import { createFauxPadController, type FauxPadController, type FauxPadOptions } from "@webgamekit/controls";

const props = defineProps<{
  mapping: Record<string, string>;
  options?: FauxPadOptions;
  mode?: 'faux-pad' | 'button'; // Default is 'faux-pad'
  onAction: (action: string) => void;
}>();

const touchControlInside = ref<HTMLElement | null>(null);
const touchControlEdge = ref<HTMLElement | null>(null);

let fauxpadController: FauxPadController | null = null;
let cleanup: (() => void) | null = null;

const isButtonMode = computed(() => props.mode === 'button');

onMounted(() => {
  if (!touchControlEdge.value || !touchControlInside.value) return;

  if (isButtonMode.value) {
    // Button mode: simple tap triggers action
    const handleTap = (e: Event) => {
      e.preventDefault();
      const action = props.mapping.click;
      if (action) {
        props.onAction(action);
      }
    };

    touchControlInside.value.addEventListener('click', handleTap);
    touchControlInside.value.addEventListener('touchend', handleTap);
    
    cleanup = () => {
      touchControlInside.value?.removeEventListener('click', handleTap);
      touchControlInside.value?.removeEventListener('touchend', handleTap);
    };
  } else {
    // Faux-pad mode: directional control
    const mappingRef = { current: { 'faux-pad': props.mapping } };
    const handlers = {
      onAction: (action: string) => {
        props.onAction(action);
      },
      onRelease: () => {
        // Release events handled by main controls system
      },
    };

    fauxpadController = createFauxPadController(mappingRef, handlers, props.options);
    fauxpadController.bind(touchControlEdge.value, touchControlInside.value);
  }
});

onUnmounted(() => {
  if (cleanup) {
    cleanup();
  }
  if (fauxpadController && touchControlEdge.value && touchControlInside.value) {
    fauxpadController.unbind(touchControlEdge.value, touchControlInside.value);
  }
});
</script>

<template>
  <div class="touch-control">
    <div ref="touchControlEdge" class="touch-control__edge"></div>
    <div ref="touchControlInside" class="touch-control__inside"></div>
  </div>
</template>

<style scoped>
.touch-control {
  position: fixed;
  width: 100px;
  height: 100px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.touch-control__edge {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--touch-color-background-dark);
  border-radius: 50%;
  opacity: 0.5;
}

.touch-control__inside {
  width: 50px;
  height: 50px;
  background-color: var(--touch-color-background-light);
  border-radius: 50%;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.2);
  opacity: 0.5;
  z-index: 1;
}
</style>
