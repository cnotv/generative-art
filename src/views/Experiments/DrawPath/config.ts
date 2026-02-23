import type { SetupConfig } from "@webgamekit/threejs";
import type { EasingName } from "@/components/ui/bezier-picker";

export type { EasingName };

export const sceneSetupConfig: SetupConfig = {
  scene: { backgroundColor: 0x1a1a2e },
  lights: {
    ambient: { color: 0xffffff, intensity: 1.5 },
    directional: {
      color: 0xffffff,
      intensity: 2,
      position: [20, 30, 20],
      castShadow: true,
      shadow: {
        camera: { left: -50, right: 50, top: 50, bottom: -50 },
        mapSize: { width: 4096, height: 4096 },
        bias: -0.001,
      },
    },
  },
  ground: { color: 0x2c3e50, size: 200 },
  sky: false,
  // Orbit controls conflict with canvas click-to-place-waypoints interaction
  orbit: false,
  camera: {
    position: [0, 15, 25],
    lookAt: [0, 0, 0],
    fov: 60,
  },
};

export const DEFAULT_FOLLOW_SPEED = 20;
/** Minimum world-unit distance between successive hold-drag waypoints. */
export const MIN_WAYPOINT_DISTANCE = 1.5;

export const PATH_LINE_COLOR = 0xffffff;
export const PATH_TUBE_RADIUS = 0.06;

export const SPHERE_RADIUS = 0.5;
export const PHYSICS_SPHERE_RADIUS = 1;
export const MESH_FOLLOWER_COLOR = 0x3498db;
export const PHYSICS_FOLLOWER_COLOR = 0xe74c3c;

/* eslint-disable no-magic-numbers */
/** Y of the top surface of the ground plane as created by getGround (default position y=-1). */
export const GROUND_SURFACE_Y = -1;
/**
 * Small gap added above the ground surface for all static/kinematic objects.
 * Prevents coplanar shadow acne between an object's bottom face and the ground.
 */
export const GROUND_EPSILON = 0.02;
export const FOLLOWER_GROUND_Y = GROUND_SURFACE_Y + SPHERE_RADIUS + GROUND_EPSILON;
export const PHYSICS_FOLLOWER_GROUND_Y = GROUND_SURFACE_Y + PHYSICS_SPHERE_RADIUS + GROUND_EPSILON;

export const OBSTACLE_SIZE: [number, number, number] = [1.5, 1.5, 1.5];
/** Centre Y for fixed (red) obstacles — slightly above ground to avoid shadow acne. */
export const OBSTACLE_GROUND_Y = GROUND_SURFACE_Y + OBSTACLE_SIZE[1] / 2 + GROUND_EPSILON;
/**
 * Spawn Y for dynamic (green) obstacles. Placed above the ground so Rapier settles them
 * under gravity — avoids spawning exactly at the resting position which can cause sticking.
 */
export const DYNAMIC_OBSTACLE_SPAWN_Y = GROUND_SURFACE_Y + OBSTACLE_SIZE[1] / 2 + 1;

/** Dynamic green obstacle cubes — spawned above ground, physics settles them. */
export const DYNAMIC_OBSTACLE_COLOR = 0x27ae60;
export const DYNAMIC_OBSTACLE_POSITIONS: [number, number, number][] = [
  [-5, DYNAMIC_OBSTACLE_SPAWN_Y, -3],
  [4, DYNAMIC_OBSTACLE_SPAWN_Y, 2],
  [-2, DYNAMIC_OBSTACLE_SPAWN_Y, 5],
];

/** Fixed (static) red obstacle cubes — center-positioned so bottom sits just above the ground. */
export const FIXED_OBSTACLE_COLOR = 0xc0392b;
export const FIXED_OBSTACLE_POSITIONS: [number, number, number][] = [
  [6, OBSTACLE_GROUND_Y, -6],
  [-7, OBSTACLE_GROUND_Y, 7],
  [0, OBSTACLE_GROUND_Y, -8],
];
/* eslint-enable no-magic-numbers */

/** Animation name fallback for goomba.glb — actual name discovered at runtime. */
export const GOOMBA_ANIMATION_FALLBACK_NAME = "walk";
export const GOOMBA_SCALE: [number, number, number] = [0.03, 0.03, 0.03];
export const GOOMBA_GROUND_Y = GROUND_SURFACE_Y + GROUND_EPSILON;
/**
 * Effective speed threshold (world units/sec) below which the goomba switches to
 * the idle animation instead of walk. Catches near-zero easing at path endpoints.
 */
export const GOOMBA_IDLE_SPEED_THRESHOLD = 0.5;

export type FollowerMode = "mesh" | "physics" | "goomba";

export const defaultConfigValues = {
  mode: "mesh" as FollowerMode,
  speed: DEFAULT_FOLLOW_SPEED,
  obstacleImpulse: 5,
  easing: "linear" as EasingName,
  easingIntensity: 0.6,
  playing: true,
  loop: true,
  pingPong: false,
  showPath: true,
  showNodes: false,
};

export const defaultSceneValues = {
  camera: { fov: 60 },
  ground: { color: 0x2c3e50 },
  scene: { backgroundColor: 0x1a1a2e },
};

export const configControls = {
  mode: {
    label: "Mode",
    component: "ButtonSelector",
    options: [
      { value: "mesh", label: "Mesh" },
      { value: "physics", label: "Physics" },
      { value: "goomba", label: "Goomba" },
    ],
  },
  speed: { min: 1, max: 100, step: 1, label: "Follow Speed" },
  obstacleImpulse: { min: 0, max: 50, step: 1, label: "Push Force" },
  easing: { bezier: true, label: "Easing" },
  easingIntensity: { min: 0, max: 5, step: 0.01, label: "Easing Intensity" },
  playing: { label: "Playing", boolean: true },
  loop: { label: "Loop", boolean: true },
  pingPong: { label: "Ping Pong", boolean: true },
  showPath: { label: "Show Path", boolean: true },
  showNodes: { label: "Show Nodes", boolean: true },
  clearPath: { callback: "clearPath", label: "Clear Path" },
};

export const sceneControls = {
  camera: {
    fov: { min: 30, max: 120 },
  },
  ground: { color: { color: true } },
  scene: { backgroundColor: { color: true } },
};
