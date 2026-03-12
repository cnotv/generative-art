<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import StartScreen from "./screens/StartScreen.vue";
import GameOver from "./screens/GameOver.vue";
import ScoreDisplay from "./screens/ScoreDisplay.vue";
import { createControls } from "@webgamekit/controls";
import { stats } from "@/utils/stats";
import { initializeAudio, stopMusic } from "@webgamekit/audio";
import { getTools } from "@webgamekit/threejs";
import { useUiStore } from "@/stores/ui";
import {
  enableZoomPrevention,
  loadGoogleFont,
  removeGoogleFont,
  disableZoomPrevention,
} from "@/utils/ui";
import { config, setupConfig } from "./config";
import { createTimeline } from "./animation";
import "@/assets/prevents.css";
import "./styles.css";

import { handleJumpGoomba } from "./helpers/events";
import { useDebugSceneStore } from '@/stores/debugScene';
import { useElementPropertiesStore } from '@/stores/elementProperties';

import {
  prevents,
  loadHighScore,
  checkHighScore,
  isGameOver,
  isGameStart,
  isGamePlaying,
  setStatus,
  setScore,
} from "./helpers/setup";
import type { ControlsOptions } from "packages/controls/dist";

type LightObject = { color: { getHex: () => number; set: (v: number) => void }; intensity: number };

const uiStore = useUiStore();
const fontName = "goomba-runner-font";
const shouldClearObstacles = ref(false);
const statsEl = ref(null);
const canvas = ref(null);
const route = useRoute();
const { originalViewport, preventZoomStyleElement } = enableZoomPrevention();

const bindings: Record<string, ControlsOptions> = {
  playing: {
    mapping: {
      keyboard: {
        " ": "jump",
      },
      gamepad: {
        cross: "jump",
      },
      touch: {
        tap: "jump",
      },
    },
    onAction: (action) => {
      if (action === "jump") handleJumpGoomba(uiStore);
    },
  },
  "game-over": {
    mapping: {
      keyboard: {
        " ": "restart",
      },
      gamepad: {
        cross: "restart",
      },
      touch: {
        tap: "restart",
      },
    },
    onAction: (action) => {
      if (action === "restart") handleRestartGame();
    },
  },
  idle: {
    mapping: {
      keyboard: {
        " ": "start",
      },
      gamepad: {
        cross: "start",
      },
      touch: {
        tap: "start",
      },
    },
    onAction: (action) => {
      if (action === "start") handleStartGame();
    },
  },
};

const { remapControlsOptions, destroyControls } = createControls(bindings["idle"]);

const handleStartGame = async () => {
  setStatus("playing");
  setScore(0);
  remapControlsOptions(bindings["playing"]);
};

const handleRestartGame = () => {
  handleStartGame();
  shouldClearObstacles.value = true;
  remapControlsOptions(bindings["playing"]);
};

const endGame = () => {
  stopMusic();
  checkHighScore();
  setStatus("game-over");
  remapControlsOptions(bindings["game-over"]);
};

const { setSceneElements, clearSceneElements } = useDebugSceneStore();
const { registerElementProperties, unregisterElementProperties, clearAllElementProperties } = useElementPropertiesStore();

const init = async (canvas: HTMLCanvasElement, statsEl: HTMLElement) => {
  stats.init(route, statsEl);
  const createScene = async () => {
    initializeAudio();
    const { animate, setup, world, scene, getDelta, camera } = await getTools({
      stats,
      route,
      canvas,
    });
    remapControlsOptions(bindings["idle"]);
    const { elements } = await setup({
      config: setupConfig,
    });

    const lightSchema = {
      intensity: { min: 0, max: 5, step: 0.1, label: 'Intensity' },
      color: { color: true, label: 'Color' },
    };

    const elementVisibility = new Map<string, boolean>();

    let sceneHandlers: { onToggleVisibility: (name: string) => void; onRemove: (name: string) => void };

    const textureAreaNames = new Set(config.backgrounds.textureAreaLayers.map(l => l.name));
    const textureAreaGroups = Object.fromEntries(
      [...textureAreaNames].map(name => [name, name.charAt(0).toUpperCase() + name.slice(1)])
    );

    const refreshElements = () => {
      const textureGroupEntries = [...textureAreaNames].map(groupName => ({
        name: groupName,
        type: 'TextureArea',
        hidden: elementVisibility.get(groupName) ?? false,
        groupId: groupName,
      }));

      setSceneElements(
        [
          { name: 'Camera', type: camera.type, hidden: false },
          ...scene.children
            .filter(child => !textureAreaNames.has(child.name))
            .map(child => ({
              name: child.name || child.type,
              type: child.type,
              hidden: elementVisibility.get(child.name || child.type) ?? false,
            })),
          ...textureGroupEntries,
        ],
        sceneHandlers,
        textureAreaGroups
      );
    };

    sceneHandlers = {
      onToggleVisibility: (name: string) => {
        if (textureAreaNames.has(name)) {
          const isHidden = elementVisibility.get(name) ?? false;
          scene.children.filter(c => c.name === name).forEach(m => { m.visible = isHidden; });
          elementVisibility.set(name, !isHidden);
        } else {
          const obj = scene.getObjectByName(name);
          if (!obj) return;
          obj.visible = !obj.visible;
          elementVisibility.set(name, !obj.visible);
        }
        refreshElements();
      },
      onRemove: (name: string) => {
        if (textureAreaNames.has(name)) {
          scene.children.filter(c => c.name === name).forEach(m => scene.remove(m));
          elementVisibility.delete(name);
        } else {
          const obj = scene.getObjectByName(name);
          if (obj) scene.remove(obj);
          elementVisibility.delete(name);
          unregisterElementProperties(name);
        }
        refreshElements();
      },
    };

    const makeLightRegistration = (light: LightObject, name: string, title: string) => {
      const lightState = reactive({ intensity: light.intensity, color: light.color.getHex() });
      registerElementProperties(name, {
        title,
        schema: lightSchema,
        getValue: (path: string) => (lightState as Record<string, unknown>)[path],
        updateValue: (path: string, value: unknown) => {
          (lightState as Record<string, unknown>)[path] = value;
          if (path === 'color') light.color.set(value as number);
          else (light as Record<string, unknown>)[path] = value;
        },
      });
    };

    const ambientLight = elements.find(e => e.name === 'ambient-light') as unknown as LightObject | undefined;
    if (ambientLight) makeLightRegistration(ambientLight, 'ambient-light', 'Ambient Light');

    const directionalLight = elements.find(e => e.name === 'directional-light') as unknown as LightObject | undefined;
    if (directionalLight) makeLightRegistration(directionalLight, 'directional-light', 'Directional Light');
    animate({
      timeline: await createTimeline({
        scene,
        getDelta,
        world,
        shouldClearObstacles,
        camera,
        uiStore,
        endGame,
        onReset: refreshElements,
      }),
    });
    refreshElements();
  };
  createScene();
};

let initInstance: () => void;
onMounted(() => {
  loadGoogleFont(
    "https://fonts.googleapis.com/css2?family=Darumadrop+One&display=swap",
    fontName
  );
  loadHighScore();
  prevents();
  initInstance = () => {
    init(
      (canvas.value as unknown) as HTMLCanvasElement,
      (statsEl.value as unknown) as HTMLElement
    );
  };
  initInstance();
  window.addEventListener("resize", initInstance);
});

onUnmounted(() => {
  removeGoogleFont(fontName);
  disableZoomPrevention(originalViewport, preventZoomStyleElement);
  destroyControls();
  stopMusic();
  window.removeEventListener("resize", initInstance);
  clearSceneElements();
  clearAllElementProperties();
});
</script>

<template>
  <div ref="statsEl"></div>
  <canvas ref="canvas" style="position: relative; z-index: 0"></canvas>
  <StartScreen v-if="isGameStart" @start="handleStartGame" />
  <GameOver v-if="isGameOver" @restart="handleRestartGame" />
  <ScoreDisplay v-if="isGamePlaying || isGameOver" />
</template>
