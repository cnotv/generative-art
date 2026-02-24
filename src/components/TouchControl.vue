<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";
import { createFauxPadController, type FauxPadController, type FauxPadOptions } from "@webgamekit/controls";

const props = defineProps<{
  mapping: Record<string, string>;
  options?: FauxPadOptions;
  mode?: 'faux-pad' | 'button'; // Default is 'faux-pad'
  currentActions?: Record<string, any>; // Reference to currentActions from createControls
  onAction: (action: string) => void;
}>();

const touchControlInside = ref<HTMLElement | null>(null);
const touchControlEdge = ref<HTMLElement | null>(null);

let padController: FauxPadController | null = null;

const isButtonMode = computed(() => props.mode === 'button');
const buttonEntries = computed(() => Object.entries(props.mapping));
const isMultiButton = computed(() => buttonEntries.value.length > 1);
const singleEntry = computed(() => buttonEntries.value[0]);

onMounted(() => {
  if (isButtonMode.value) return;

  if (!touchControlEdge.value || !touchControlInside.value) return;

  // Faux-pad mode: directional control
  const mappingRef = { current: { 'faux-pad': props.mapping } };
  const handlers = {
    onAction: (action: string, trigger: string, device: string) => {
      // Update currentActions so the game loop can read them (intentional mutation of shared state)
      if (props.currentActions) {
        // eslint-disable-next-line vue/no-mutating-props
        props.currentActions[action] = { trigger, device };
      }
      props.onAction(action);
    },
    onRelease: (action: string) => {
      // Remove from currentActions when released
      if (props.currentActions && props.currentActions[action]) {
        // eslint-disable-next-line vue/no-mutating-props
        delete props.currentActions[action];
      }
    },
  };

  padController = createFauxPadController(mappingRef, handlers, props.options);
  // Bind touch events to edge (larger area), visual feedback to inside
  padController.bind(touchControlEdge.value, touchControlInside.value);
});

onUnmounted(() => {
  if (padController && touchControlEdge.value && touchControlInside.value) {
    padController.unbind(touchControlEdge.value, touchControlInside.value);
  }
});

const handleButtonAction = (action: string, event: Event) => {
  event.preventDefault();
  props.onAction(action);
};
</script>

<template>
  <!-- Single button: big circle matching the faux-pad visual style -->
  <div
    v-if="isButtonMode && !isMultiButton"
    class="touch-control"
    @click="handleButtonAction(singleEntry[1], $event)"
    @touchend="handleButtonAction(singleEntry[1], $event)"
  >
    <div class="touch-control__edge"></div>
    <div class="touch-control__inside touch-control__inside--label">{{ singleEntry[0] }}</div>
  </div>

  <!-- Multi-button: horizontal row of smaller buttons -->
  <div v-else-if="isButtonMode" class="touch-control touch-control--buttons">
    <button
      v-for="(action, label) in mapping"
      :key="label"
      class="touch-control__button"
      @click="handleButtonAction(action, $event)"
      @touchend="handleButtonAction(action, $event)"
    >
      {{ label }}
    </button>
  </div>

  <!-- Faux-pad: directional joystick -->
  <div v-else class="touch-control">
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

.touch-control--buttons {
  border-radius: 0;
  width: calc(2 * 44px + 8px);
  height: auto;
  gap: 8px;
  flex-wrap: wrap;
  flex-direction: row;
  justify-content: flex-start;
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

.touch-control__inside--label {
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  font-weight: bold;
  user-select: none;
  -webkit-user-select: none;
  cursor: pointer;
}

.touch-control__button {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background-color: var(--touch-color-background-dark);
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  font-weight: bold;
  cursor: pointer;
  opacity: 0.5;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}
</style>
