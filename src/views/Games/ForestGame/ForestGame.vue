<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef } from "vue";
import {
  getTools,
  getModel,
  getCube,
  instanceMatrixMesh,
  cameraFollowPlayer,
  generateAreaPositions,
  type ComplexModel
} from "@webgamekit/threejs";
import { controllerForward, type CoordinateTuple, type AnimationData, updateAnimation, setRotation, getRotation, createTimelineManager, createPopUpBounce } from "@webgamekit/animation";
import { createGame, type GameState } from "@webgamekit/game";
import { createControls, isMobile } from "@webgamekit/controls";
import { initializeAudio, stopMusic, playAudioFile } from "@webgamekit/audio";

import TouchControl from '@/components/TouchControl.vue'
import ControlsLogger from '@/components/ControlsLogger.vue'
import {
  playerSettings,
  illustrations,
  setupConfig,
  controlBindings,
  assets,
  dynamicFlowerConfig,
  // undergroundConfig,
} from "./config";
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
const init = async (): Promise<void> => {
  if (!canvas.value) return;
  const { setup, animate, scene, world, getDelta, camera } = await getTools({
    canvas: canvas.value,
  });

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

      Object.keys(illustrations).forEach((key) => {
        const config = (illustrations as Record<string, any>)[key];
        const mesh = getCube(scene, world, config);
        if (config.instances) {
          instanceMatrixMesh(mesh as any, scene, config.instances);
        }
        // obstacles.push(model);
      });

      // Demonstrate dynamic area population with pop-up animations
      const positions = generateAreaPositions(dynamicFlowerConfig.area);
      const dynamicFlowers: any[] = [];

      remapControlsOptions(bindings);

      const timelineManager = createTimelineManager();

      positions.forEach((position, index) => {
        const flowerConfig = {
          ...dynamicFlowerConfig,
          position
        };
        const flower = getCube(scene, world, flowerConfig);
        dynamicFlowers.push(flower);

        // Add pop-up animation with staggered delay
        const popUpAnimation = createPopUpBounce({
          object: flower,
          startY: position[1] - 3, // Start below ground
          endY: position[1],       // End at target position
          duration: 30,            // 30 frames
          delay: index * 2         // Stagger by 2 frames each
        });

        // Add to timeline
        timelineManager.addAction({
          name: `flower-${index}-popup`,
          category: 'visual',
          action: () => popUpAnimation(timelineManager.getFrame()),
          autoRemove: true
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
  await init();
  await initializeAudio();
  window.addEventListener("resize", init);
});
onUnmounted(() => {
  stopMusic();
  destroyControls();
  window.removeEventListener("resize", init);
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
    :options="{ deadzone: 0.15 }"
    :current-actions="currentActions"
    :on-action="bindings.onAction"
  />
  <TouchControl
    v-if="isMobileDevice"
    style="right: 25px; bottom: 25px"
    mode="button"
    :mapping="{ click: 'jump' }"
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
