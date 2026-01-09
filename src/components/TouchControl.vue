<script setup lang="ts">
import type { CoordinateTuple } from "@webgamekit/animation";
import { ref, onMounted, onUnmounted } from "vue";

const touchControlInside = ref(null as HTMLElement | null);
const touchControlEdge = ref(null as HTMLElement | null);
let initialTouchPosition = { x: 0, y: 0 };
let threshold = { x: 0, y: 0 };

const emit = defineEmits<{
  (event: "moved", payload: CoordinateTuple): void;
  (event: "touchstart"): void;
  (event: "touchend"): void;
}>();

const onTouchStart = (event: TouchEvent) => {
  event.preventDefault();
  initialTouchPosition = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  emit("touchstart");
};

const onTouchMove = (event: TouchEvent) => {
  event.preventDefault();
  let xDistance = event.touches[0].clientX - initialTouchPosition.x;
  let yDistance = event.touches[0].clientY - initialTouchPosition.y;

  // Limit the movement to the threshold
  xDistance = Math.max(Math.min(xDistance, threshold.x), -threshold.x);
  yDistance = Math.max(Math.min(yDistance, threshold.y), -threshold.y);

  if (touchControlInside.value) {
    touchControlInside.value.style.transform = `translate(${xDistance}px, ${yDistance}px)`;
  }

  emit("moved", { x: xDistance, y: yDistance });
};

const onTouchEnd = () => {
  if (touchControlInside.value) {
    touchControlInside.value.style.transform = "translate(0, 0)";
  }
  emit("touchend");
};

onMounted(() => {
  if (touchControlEdge.value) {
    threshold = {
      x: touchControlEdge.value.offsetWidth / 2,
      y: touchControlEdge.value.offsetHeight / 2,
    };
  }

  if (touchControlInside.value) {
    touchControlInside.value.addEventListener("touchstart", onTouchStart);
    touchControlInside.value.addEventListener("touchmove", onTouchMove);
    touchControlInside.value.addEventListener("touchend", onTouchEnd);
  }
});

onUnmounted(() => {
  if (touchControlInside.value) {
    touchControlInside.value.removeEventListener("touchstart", onTouchStart);
    touchControlInside.value.removeEventListener("touchmove", onTouchMove);
    touchControlInside.value.removeEventListener("touchend", onTouchEnd);
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
}
</style>
