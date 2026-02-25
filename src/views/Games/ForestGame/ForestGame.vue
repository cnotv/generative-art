<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef, watch } from "vue";
import { useRoute } from "vue-router";
import * as THREE from 'three';
import {
  getTools,
  getModel,
  getCube,
  cameraFollowPlayer,
  generateAreaPositions,
  setCameraPreset,
  CameraPreset,
  type ComplexModel
} from "@webgamekit/threejs";
import { controllerForward, type CoordinateTuple, type AnimationData, updateAnimation, setRotation, getRotation, createTimelineManager, createPopUpBounce, createSlideInFromSides, sortOrder, calculateSequentialDelays } from "@webgamekit/animation";
import { createGame, type GameState } from "@webgamekit/game";
import { createControls, isMobile } from "@webgamekit/controls";
import { initializeAudio, stopMusic, playAudioFile } from "@webgamekit/audio";
import { registerViewConfig, unregisterViewConfig, createReactiveConfig } from "@/composables/useViewConfig";
import { useViewPanels } from "@/composables/useViewPanels";

import TouchControl from '@/components/TouchControl.vue'
import ControlsLogger from '@/components/ControlsLogger.vue'
import {
  playerSettings,
  setupConfig,
  controlBindings,
  assets,
  illustrationAreas,
  configControls,
  sceneControls,
} from "./config";

const route = useRoute();
const { setViewPanels, clearViewPanels } = useViewPanels();

// Create reactive config for game settings (Config tab)
const reactiveConfig = createReactiveConfig({
  player: {
    speed: { ...playerSettings.game.speed },
    maxJump: playerSettings.game.maxJump,
  },
  illustrations: {
    grass: 500,
    treesBack: 30,
    treesFront: 40,
    clouds: 5,
  },
});

// Create reactive scene config for setupConfig-related settings (Scene tab)
const sceneConfig = createReactiveConfig({
  camera: {
    preset: 'perspective',
    fov: setupConfig.camera?.fov ?? 80,
    position: {
      x: (setupConfig.camera?.position as CoordinateTuple)?.[0] ?? 0,
      y: (setupConfig.camera?.position as CoordinateTuple)?.[1] ?? 7,
      z: (setupConfig.camera?.position as CoordinateTuple)?.[2] ?? 35,
    },
  },
  ground: {
    color: setupConfig.ground && typeof setupConfig.ground === 'object' ? setupConfig.ground.color : 0x98887d,
  },
  sky: {
    color: setupConfig.sky && typeof setupConfig.sky === 'object' ? setupConfig.sky.color : 0x00aaff,
  },
});

// import { times } from "@/utils/lodash";

// Use correct GameState type and initialization
const gameState = shallowRef<GameState>();
createGame({ data: { score: 0 } }, gameState, onUnmounted);

const isJumping = shallowRef(false);
const canJump = shallowRef(true);
const logs = shallowRef<string[]>([]);
const showLogs = false;
const isMobileDevice = isMobile();

const handleJump = (): void => {
  if (isJumping.value || !canJump.value) return;
  playAudioFile(assets.jumpSound);
  isJumping.value = true;
  canJump.value = false;
};

const getLogs = (actions: Record<string, any>): string[] =>
  Object.keys(actions)
    .filter((action) => !!actions[action])
    .map(
      (action) =>
        `${action} triggered by ${actions[action].trigger} ${actions[action].device}`
    );

const logControllerForward = (
  debug: boolean,
  actions: Record<string, unknown>,
  targetRotation: number | null
): void => {
  if (!debug) return;
  const activeActions = Object.keys(actions).filter(k => actions[k]);
  if (activeActions.length > 0) {
    console.log('[Controls Debug] Active actions:', activeActions, 'Target rotation:', targetRotation);
  }
};

const bindings = {
  ...controlBindings,
  onAction: (action: string) => {
    logs.value = getLogs(currentActions);

    switch (action) {
      case "jump":
        handleJump();
        break;
      case "print-log":
        break;
    }
  },
  onRelease: () => {
    logs.value = getLogs(currentActions);
  },
};
const { destroyControls, currentActions, remapControlsOptions } = createControls(
  bindings
);

const canvas = ref<HTMLCanvasElement | null>(null);

// Store references to scene objects for live config updates
const sceneRefs = shallowRef<{
  camera?: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  scene?: THREE.Scene;
} | null>(null);

// Track previous camera preset to detect when it changes
const previousCameraPreset = ref<string>('perspective');

// Watch scene camera config and apply changes
watch(
  () => sceneConfig.value.camera,
  (newCameraConfig) => {
    const presetChanged = newCameraConfig.preset !== previousCameraPreset.value;

    // If preset changed, apply the new camera preset
    if (presetChanged && sceneRefs.value?.camera) {
      previousCameraPreset.value = newCameraConfig.preset;

      // Apply the camera preset
      const aspect = window.innerWidth / window.innerHeight;
      setCameraPreset(
        sceneRefs.value.camera,
        newCameraConfig.preset as CameraPreset,
        aspect
      );
    } else if (sceneRefs.value?.camera && sceneRefs.value.camera instanceof THREE.PerspectiveCamera) {
      // For perspective camera, update FOV and position without preset
      const camera = sceneRefs.value.camera;
      camera.fov = newCameraConfig.fov;
      camera.position.set(
        newCameraConfig.position.x,
        newCameraConfig.position.y,
        newCameraConfig.position.z
      );
      camera.updateProjectionMatrix();
    }
  },
  { deep: true }
);

const init = async (): Promise<void> => {
  if (!canvas.value) return;
  const { setup, animate, scene, world, getDelta, camera } = await getTools({
    canvas: canvas.value,
  });

  // Store references for live updates
  sceneRefs.value = {
    camera: camera as THREE.PerspectiveCamera | THREE.OrthographicCamera,
    scene,
  };

  // Initialize camera with the configured preset
  if (sceneRefs.value.camera) {
    const aspect = window.innerWidth / window.innerHeight;
    setCameraPreset(
      sceneRefs.value.camera,
      sceneConfig.value.camera.preset as CameraPreset,
      aspect
    );
  }

  // Track initial preset value
  previousCameraPreset.value = sceneConfig.value.camera.preset;

  const { orbit } = await setup({
    config: setupConfig,
    defineSetup: async ({ ground }) => {
      const { distance, speed, maxJump } = playerSettings.game;
      const { movement } = playerSettings;
      const obstacles: ComplexModel[] = [];
      const cameraOffset = (setupConfig.camera?.position || [0, 10, 20]) as CoordinateTuple;

      const player = await getModel(scene, world, "mushroom.glb", playerSettings.model);
      // obstacles.push(await getModel(scene, world, "sand_block.glb", blockConfig));

      // Add ground mesh for ground detection (if ground exists)
      const groundBodies: ComplexModel[] = ground?.mesh ? [ground.mesh as unknown as ComplexModel] : [];

      remapControlsOptions(bindings);

      const timelineManager = createTimelineManager();

      // Populate all illustrations using pre-generated positions with pop-up animations
      let animationIndex = 0;
      Object.entries(illustrationAreas).forEach(([categoryName, configs]) => {
        configs.forEach((config) => {
          // Use instances with variations if available, otherwise use positions
          const elementsData = config.instances || config.positions.map((pos: CoordinateTuple) => ({ position: pos }));

          // Calculate sequential delays based on Z-position
          // For grass: animate from middle Z outward (creates expanding effect)
          // For other elements: animate back to front (depth reveal)
          let sortFunction;
          if (categoryName === 'grass') {
            sortFunction = sortOrder.byDistanceFromZ(elementsData, 'middle');
          } else {
            sortFunction = sortOrder.zBackToFront;
          }
          const delays = calculateSequentialDelays(elementsData, sortFunction, 2);

          elementsData.forEach((elementData: any, index: number) => {
            const position = elementData.position;
            const elementConfig = {
              ...config,
              position,
              ...(elementData.scale && { size: elementData.scale }),
              ...(elementData.rotation && { rotation: elementData.rotation })
            };
            const element = getCube(scene, world, elementConfig);

            // Choose animation type based on category
            let animation;
            if (categoryName === 'clouds') {
              // Clouds slide in from the sides
              animation = createSlideInFromSides({
                object: element,
                startY: position[1],
                endY: position[1],
                duration: 60,
                delay: delays[index]
              });
            } else {
              // Other elements use pop-up animation
              animation = createPopUpBounce({
                object: element,
                startY: position[1] - 3,
                endY: position[1],
                duration: 30,
                delay: delays[index]
              });
            }

            timelineManager.addAction({
              name: `${categoryName}-${animationIndex}-popup`,
              category: 'visual',
              action: animation,
              autoRemove: true
            });

            animationIndex++;
          });
        });
      });

      // times(200, (i) => getCube(scene, world, {...undergroundConfig, position: [(i - 100) * 10, -10.3, 27]}) )

      timelineManager.addAction({
        frequency: speed.movement,
        name: "Walk",
        category: "user-input",
        action: () => {
          const targetRotation = getRotation(currentActions, true);
          const isMoving = targetRotation !== null;
          const actionName = isMoving ? "Esqueleto|walking" : "Esqueleto|idle";
          logControllerForward(movement.debug, currentActions, targetRotation);
          const animationData: AnimationData = { actionName, player, delta: getDelta() * 2, speed: 20, backward: true, distance };
          if (isMoving) {
            setRotation(player, targetRotation);
            controllerForward(
              obstacles,
              groundBodies,
              animationData,
              movement
            );
            cameraFollowPlayer(camera, player, cameraOffset, orbit, ['x', 'z']);
          } else {
            updateAnimation(animationData);
          }
        },
      });

      timelineManager.addAction({
        name: "Jump action",
        category: "physics",
        action: () => {
          if (isJumping.value) {
            if (player.position.y >= playerSettings.model.position[1] + maxJump) {
              isJumping.value = false;
            } else {
              player.position.y += speed.jump * 0.1;
            }
          } else {
            player.position.y -= speed.jump * 0.1;
          }

          // Fake gravity
          if (player.position.y <= playerSettings.model.position[1] + 0.1) {
            canJump.value = true;
            player.position.y = playerSettings.model.position[1];
          }
        },
      });

      animate({
        beforeTimeline: () => { },
        timeline: timelineManager,
      });
    },
  });
};

onMounted(async () => {
  // Set view-specific panels for GlobalNavigation
  setViewPanels({
    showConfig: true,
  });

  // Register both Config and Scene tabs with the config panel
  registerViewConfig(
    route.name as string,
    reactiveConfig,
    configControls,
    sceneConfig,
    sceneControls
  );

  await init();
  await initializeAudio();
  window.addEventListener("resize", init);
});
onUnmounted(() => {
  // Clear view-specific panels
  clearViewPanels();

  stopMusic();
  destroyControls();
  unregisterViewConfig(route.name as string);
  window.removeEventListener("resize", init);
  sceneRefs.value = null;
});
</script>

<template>
  <canvas ref="canvas"></canvas>
  <ControlsLogger v-if="gameState && showLogs" :logs="logs">
    <div>
      <span>{{ isJumping ? "Jumping" : "On ground" }},</span>
      <span>{{ canJump ? "ready" : "not ready" }}</span>
    </div>
  </ControlsLogger>

  <TouchControl
    v-if="isMobileDevice"
    style="left: 25px; bottom: 25px"
    :mapping="{
      left: 'move-left',
      right: 'move-right',
      up: 'move-up',
      down: 'move-down',
    }"
    :options="{ deadzone: 0.15, enableEightWay: true }"
    :current-actions="currentActions"
    :on-action="bindings.onAction"
  />
  <TouchControl
    v-if="isMobileDevice"
    style="right: 25px; bottom: 25px"
    mode="button"
    :mapping="{ '': 'jump' }"
    :on-action="bindings.onAction"
  />
</template>

<style scoped>
canvas {
  display: block;
  width: 100%;
  height: 100vh;
}
</style>
