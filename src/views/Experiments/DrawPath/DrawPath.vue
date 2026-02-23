<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import * as THREE from "three";
import { getTools, getBall, getModel, type ComplexModel } from "@webgamekit/threejs";
import { createTimelineManager, animateTimeline } from "@webgamekit/animation";
import type { Waypoint, PathFollowState } from "@webgamekit/logic";
import { registerViewConfig, unregisterViewConfig, createReactiveConfig } from "@/composables/useViewConfig";
import { useViewPanels } from "@/composables/useViewPanels";

import {
  sceneSetupConfig,
  configControls,
  sceneControls,
  defaultConfigValues,
  defaultSceneValues,
  MESH_FOLLOWER_COLOR,
  PHYSICS_FOLLOWER_COLOR,
  SPHERE_RADIUS,
  PHYSICS_SPHERE_RADIUS,
  FOLLOWER_GROUND_Y,
  PHYSICS_FOLLOWER_GROUND_Y,
  GOOMBA_SCALE,
  GOOMBA_GROUND_Y,
  GOOMBA_IDLE_SPEED_THRESHOLD,
  GROUND_EPSILON,
  MIN_WAYPOINT_DISTANCE,
  type EasingName,
  type FollowerMode,
} from "./config";
import {
  drawCreatePathVisualization,
  drawRemovePathVisualization,
  drawInterpolateWaypoints,
  drawCreateWaypointNode,
  drawRemoveWaypointNodes,
  drawUpdateWaypointNodePosition,
} from "./helpers/drawPath";
import {
  modelFollowTick,
  modelFollowPhysicsTick,
  modelFollowEnableGoombaPhysics,
  modelFollowSetCharacterMass,
  modelFollowSyncPhysicsBody,
  modelFollowPlayWalkAnimation,
  modelFollowPlayIdleAnimation,
  modelFollowUpdateMixer,
  modelFollowSpawnDynamicObstacles,
  modelFollowSpawnFixedObstacles,
  modelFollowClearObstacles,
  modelFollowSyncDynamicObstacles,
  modelFollowApplyContactImpulses,
  modelFollowIsBlockedByFixedObstacle,
} from "./helpers/modelFollow";
import { getEasingSpeedMultiplier } from "./helpers/easing";

const route = useRoute();
const { setViewPanels, clearViewPanels } = useViewPanels();

const canvas = ref<HTMLCanvasElement | null>(null);
const reactiveConfig = createReactiveConfig(defaultConfigValues);
const sceneConfig = createReactiveConfig(defaultSceneValues);

type SceneState = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  world: Parameters<typeof getBall>[1];
  camera: THREE.PerspectiveCamera;
  getDelta: () => number;
  /** Delta stored this frame, used by the goomba timeline action to avoid double-ticking the clock. */
  lastDelta: number;
  /** Last easing multiplier computed in the animation loop, used by goomba walk animation. */
  lastEasingMultiplier: number;
  /** Computed Y offset to sit goomba on the ground (derived from model bounding box). */
  goombaGroundY: number;
  /** Raw control waypoints placed by the user. */
  controlWaypoints: Waypoint[];
  /** Smooth CatmullRom-interpolated waypoints fed to logicAdvanceAlongPath. */
  smoothWaypoints: Waypoint[];
  pathLine: THREE.Group | null;
  /** Sphere for mesh mode — kinematicPositionBased, sits on ground. */
  followerMesh: ComplexModel | null;
  /** Sphere for physics mode — kinematicPositionBased with CharacterController for collision. */
  followerPhysics: ComplexModel | null;
  /** Lazy-loaded goomba for animated mode. */
  followerGoomba: ComplexModel | null;
  followState: PathFollowState | null;
  isFollowing: boolean;
  obstacles: ComplexModel[];
  /** Shared geometry for waypoint node cubes. */
  waypointNodeGeo: THREE.BoxGeometry;
  /** Shared material for waypoint node spheres. */
  waypointNodeMat: THREE.MeshBasicMaterial;
  /** Sphere meshes shown at each control waypoint when showNodes is true. */
  waypointNodes: THREE.Mesh[];
  /** Index of the control waypoint currently being dragged, or null. */
  selectedNodeIndex: number | null;
};

let sceneState: SceneState | null = null;
let animFrameId: number | null = null;
let frameRef = 0;
let isPointerDown = false;

const timeline = createTimelineManager();
let goombaActionId: string | null = null;

const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

// ---------------------------------------------------------------------------
// Input helpers
// ---------------------------------------------------------------------------

const getNdcCoords = (event: MouseEvent | TouchEvent, canvasEl: HTMLCanvasElement): THREE.Vector2 => {
  const rect = canvasEl.getBoundingClientRect();
  const clientX = event instanceof MouseEvent ? event.clientX : event.touches[0].clientX;
  const clientY = event instanceof MouseEvent ? event.clientY : event.touches[0].clientY;
  return new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1
  );
};

const raycastToGround = (
  ndc: THREE.Vector2,
  camera: THREE.PerspectiveCamera
): THREE.Vector3 | null => {
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const target = new THREE.Vector3();
  return raycaster.ray.intersectPlane(groundPlane, target) ? target : null;
};

// ---------------------------------------------------------------------------
// Scene helpers
// ---------------------------------------------------------------------------

const getActiveFollower = (state: SceneState): ComplexModel | null => {
  if (reactiveConfig.value.mode === "goomba") return state.followerGoomba;
  if (reactiveConfig.value.mode === "physics") return state.followerPhysics;
  return state.followerMesh;
};

const getFollowerGroundY = (): number => {
  if (reactiveConfig.value.mode === "goomba") return sceneState?.goombaGroundY ?? GOOMBA_GROUND_Y;
  if (reactiveConfig.value.mode === "physics") return PHYSICS_FOLLOWER_GROUND_Y;
  return FOLLOWER_GROUND_Y;
};

const refreshPathVisualization = (state: SceneState): void => {
  if (state.pathLine) {
    drawRemovePathVisualization(state.scene, state.pathLine);
    state.pathLine = null;
  }
  if (state.controlWaypoints.length >= 2) {
    state.smoothWaypoints = drawInterpolateWaypoints(state.controlWaypoints);
    state.pathLine = drawCreatePathVisualization(state.scene, state.controlWaypoints);
    if (!reactiveConfig.value.showPath) state.pathLine.visible = false;
  }

  // Rebuild node spheres at current control waypoints
  drawRemoveWaypointNodes(state.scene, state.waypointNodes);
  if (reactiveConfig.value.showNodes && state.controlWaypoints.length > 0) {
    state.waypointNodes = state.controlWaypoints.map((wp) =>
      drawCreateWaypointNode(state.scene, wp, state.waypointNodeGeo, state.waypointNodeMat)
    );
  } else {
    state.waypointNodes = [];
  }
};

const startFollowing = (state: SceneState): void => {
  if (state.smoothWaypoints.length < 2) return;
  const groundY = getFollowerGroundY();
  const waypoints: Waypoint[] = state.smoothWaypoints.map((w) => ({ ...w, y: groundY }));
  state.followState = { waypoints, currentIndex: 0, progress: 0 };
  state.isFollowing = true;
  const follower = getActiveFollower(state);
  follower?.position.set(waypoints[0].x, groundY, waypoints[0].z);
  if (follower) modelFollowSyncPhysicsBody(follower);
};

const clearPath = (): void => {
  if (!sceneState) return;
  sceneState.isFollowing = false;
  sceneState.followState = null;
  sceneState.controlWaypoints = [];
  sceneState.smoothWaypoints = [];
  if (sceneState.pathLine) {
    drawRemovePathVisualization(sceneState.scene, sceneState.pathLine);
    sceneState.pathLine = null;
  }
  drawRemoveWaypointNodes(sceneState.scene, sceneState.waypointNodes);
  sceneState.waypointNodes = [];
};

// ---------------------------------------------------------------------------
// Pointer / touch interaction (hold to draw, start following on release)
// ---------------------------------------------------------------------------

const tryAddWaypoint = (event: MouseEvent | TouchEvent): void => {
  if (!sceneState || !canvas.value) return;
  const ndc = getNdcCoords(event, canvas.value);
  const worldPos = raycastToGround(ndc, sceneState.camera);
  if (!worldPos) return;

  // Enforce minimum distance between control waypoints
  const prev = sceneState.controlWaypoints.at(-1);
  if (prev) {
    const dx = worldPos.x - prev.x;
    const dz = worldPos.z - prev.z;
    if (Math.sqrt(dx * dx + dz * dz) < MIN_WAYPOINT_DISTANCE) return;
  }

  const groundY = getFollowerGroundY();
  const waypoint: Waypoint = { x: worldPos.x, y: groundY, z: worldPos.z };
  sceneState.controlWaypoints = [...sceneState.controlWaypoints, waypoint];

  refreshPathVisualization(sceneState);
};

const onPointerDown = (event: MouseEvent | TouchEvent): void => {
  if (event instanceof TouchEvent) event.preventDefault();
  if (!canvas.value) return;
  // When nodes are visible, check for node hit before starting path drawing
  if (sceneState && reactiveConfig.value.showNodes && sceneState.waypointNodes.length > 0) {
    const ndc = getNdcCoords(event, canvas.value);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, sceneState.camera);
    const intersects = raycaster.intersectObjects(sceneState.waypointNodes);
    if (intersects.length > 0) {
      const idx = sceneState.waypointNodes.indexOf(intersects[0].object as THREE.Mesh);
      if (idx !== -1) {
        sceneState.selectedNodeIndex = idx;
        return; // Enter node-drag mode; do not draw
      }
    }
  }
  isPointerDown = true;
  clearPath();
  tryAddWaypoint(event);
};

const onPointerMove = (event: MouseEvent | TouchEvent): void => {
  if (event instanceof TouchEvent) event.preventDefault();
  if (sceneState && sceneState.selectedNodeIndex !== null) {
    if (!canvas.value) return;
    const ndc = getNdcCoords(event, canvas.value);
    const worldPos = raycastToGround(ndc, sceneState.camera);
    if (worldPos) {
      const groundY = getFollowerGroundY();
      const moved: Waypoint = { x: worldPos.x, y: groundY, z: worldPos.z };
      sceneState.controlWaypoints[sceneState.selectedNodeIndex] = moved;
      drawUpdateWaypointNodePosition(sceneState.waypointNodes[sceneState.selectedNodeIndex], moved);
      // Rebuild smooth path and path line without touching other nodes
      if (sceneState.controlWaypoints.length >= 2) {
        sceneState.smoothWaypoints = drawInterpolateWaypoints(sceneState.controlWaypoints);
        if (sceneState.pathLine) drawRemovePathVisualization(sceneState.scene, sceneState.pathLine);
        sceneState.pathLine = drawCreatePathVisualization(sceneState.scene, sceneState.controlWaypoints);
        if (!reactiveConfig.value.showPath) sceneState.pathLine.visible = false;
      }
    }
    return;
  }
  if (isPointerDown) tryAddWaypoint(event);
};

const onPointerUp = (): void => {
  if (sceneState && sceneState.selectedNodeIndex !== null) {
    sceneState.selectedNodeIndex = null;
    if (sceneState.smoothWaypoints.length >= 2) startFollowing(sceneState);
    return;
  }
  isPointerDown = false;
  if (sceneState && sceneState.smoothWaypoints.length >= 2) {
    startFollowing(sceneState);
  }
};

// ---------------------------------------------------------------------------
// Mode switching
// ---------------------------------------------------------------------------

const getCurrentFollowerPosition = (state: SceneState): THREE.Vector3 =>
  getActiveFollower(state)?.position.clone() ?? new THREE.Vector3(0, FOLLOWER_GROUND_Y, 0);

/** Register a timeline action that drives the goomba mixer each frame.
 *  Uses state.lastDelta (set in the animation loop) to avoid double-ticking THREE.Clock. */
const registerGoombaTimelineAction = (): void => {
  if (goombaActionId) return;
  goombaActionId = timeline.addAction({
    name: "goomba-animation",
    category: "goomba",
    action: () => {
      if (!sceneState?.followerGoomba) return;
      // No active path — freeze animation in place by not advancing the mixer.
      if (!sceneState.isFollowing) return;
      const delta = sceneState.lastDelta;
      modelFollowUpdateMixer(sceneState.followerGoomba, delta);
      const effectiveSpeed = reactiveConfig.value.speed * sceneState.lastEasingMultiplier;
      if (effectiveSpeed >= GOOMBA_IDLE_SPEED_THRESHOLD) {
        // Drive walk animation directly by effective follow speed so it stays in sync with ground movement
        modelFollowPlayWalkAnimation(sceneState.followerGoomba, delta, effectiveSpeed);
      } else {
        modelFollowPlayIdleAnimation(sceneState.followerGoomba, delta);
      }
    },
  });
};

const unregisterGoombaTimelineAction = (): void => {
  if (!goombaActionId) return;
  timeline.removeAction(goombaActionId);
  goombaActionId = null;
};

const switchToMeshMode = (state: SceneState, pos: THREE.Vector3): void => {
  unregisterGoombaTimelineAction();
  if (state.followerPhysics) state.followerPhysics.visible = false;
  if (state.followerGoomba) state.followerGoomba.visible = false;
  if (state.followerMesh) {
    state.followerMesh.position.set(pos.x, FOLLOWER_GROUND_Y, pos.z);
    state.followerMesh.visible = true;
  }
  modelFollowClearObstacles(state.scene, state.world, state.obstacles);
  state.obstacles = [];
};

const switchToPhysicsMode = async (state: SceneState, pos: THREE.Vector3): Promise<void> => {
  unregisterGoombaTimelineAction();
  if (state.followerMesh) state.followerMesh.visible = false;
  if (state.followerGoomba) state.followerGoomba.visible = false;

  if (!state.followerPhysics) {
    state.followerPhysics = getBall(state.scene, state.world, {
      size: PHYSICS_SPHERE_RADIUS,
      color: PHYSICS_FOLLOWER_COLOR,
      type: "kinematicPositionBased",
      position: [pos.x, PHYSICS_FOLLOWER_GROUND_Y, pos.z],
      castShadow: true,
    });
  } else {
    const body = state.followerPhysics.userData?.body;
    if (body) body.setNextKinematicTranslation({ x: pos.x, y: PHYSICS_FOLLOWER_GROUND_Y, z: pos.z });
    state.followerPhysics.position.set(pos.x, PHYSICS_FOLLOWER_GROUND_Y, pos.z);
    state.followerPhysics.visible = true;
  }

  if (state.obstacles.length === 0) {
    state.obstacles = [
      ...modelFollowSpawnDynamicObstacles(state.scene, state.world),
      ...modelFollowSpawnFixedObstacles(state.scene, state.world),
    ];
  }
};

const switchToGoombaMode = async (state: SceneState, pos: THREE.Vector3): Promise<void> => {
  if (state.followerMesh) state.followerMesh.visible = false;
  if (state.followerPhysics) state.followerPhysics.visible = false;

  if (!state.followerGoomba) {
    state.followerGoomba = await getModel(state.scene, state.world, "goomba.glb", {
      position: [pos.x, 1, pos.z],
      scale: GOOMBA_SCALE,
      type: "kinematicPositionBased",
      castShadow: true,
    });
    // Compute bounding box so the goomba's feet sit exactly on the ground (y=0).
    const box = new THREE.Box3().setFromObject(state.followerGoomba);
    state.goombaGroundY = -box.min.y + GROUND_EPSILON;
    state.followerGoomba.position.set(pos.x, state.goombaGroundY, pos.z);
    modelFollowSyncPhysicsBody(state.followerGoomba);
    // Allow the CC to apply impulses to dynamic bodies so goomba pushes green cubes.
    modelFollowEnableGoombaPhysics(state.followerGoomba);
  } else {
    state.followerGoomba.position.set(pos.x, state.goombaGroundY, pos.z);
    state.followerGoomba.visible = true;
  }

  registerGoombaTimelineAction();

  if (state.obstacles.length === 0) {
    state.obstacles = [
      ...modelFollowSpawnDynamicObstacles(state.scene, state.world),
      ...modelFollowSpawnFixedObstacles(state.scene, state.world),
    ];
  }
};

const applyModeSwitch = async (mode: FollowerMode): Promise<void> => {
  if (!sceneState) return;
  const pos = getCurrentFollowerPosition(sceneState);
  if (mode === "mesh") switchToMeshMode(sceneState, pos);
  else if (mode === "physics") await switchToPhysicsMode(sceneState, pos);
  else await switchToGoombaMode(sceneState, pos);

  if (sceneState.smoothWaypoints.length >= 2) startFollowing(sceneState);
};

watch(() => reactiveConfig.value.mode, applyModeSwitch);

watch(() => sceneConfig.value.scene.backgroundColor, (val) => {
  if (sceneState?.scene.background instanceof THREE.Color) {
    sceneState.scene.background.setHex(val);
  }
});

watch(() => reactiveConfig.value.showPath, (show) => {
  if (!sceneState?.pathLine) return;
  sceneState.pathLine.visible = show;
});

watch(() => reactiveConfig.value.showNodes, (show) => {
  if (!sceneState) return;
  drawRemoveWaypointNodes(sceneState.scene, sceneState.waypointNodes);
  if (show && sceneState.controlWaypoints.length > 0) {
    sceneState.waypointNodes = sceneState.controlWaypoints.map((wp) =>
      drawCreateWaypointNode(sceneState!.scene, wp, sceneState!.waypointNodeGeo, sceneState!.waypointNodeMat)
    );
  } else {
    sceneState.waypointNodes = [];
  }
});

// ---------------------------------------------------------------------------
// Animation loop
// ---------------------------------------------------------------------------

const runAnimation = (state: SceneState): void => {
  animFrameId = requestAnimationFrame(() => runAnimation(state));
  frameRef++;
  // Measure delta first so we can sync the physics timestep to the actual render rate.
  // Without this, world.step() always advances by its fixed 1/60 s regardless of frame time,
  // causing physics to run faster at high refresh rates and slower on frame-rate spikes.
  const delta = state.getDelta();
  state.lastDelta = delta;
  state.world.timestep = Math.min(delta, 1 / 30); // cap prevents huge jumps after tab switch
  state.world.step();
  modelFollowSyncDynamicObstacles(state.obstacles);

  // Tick the timeline before movement so the mixer runs first and position/rotation
  // set by the movement tick is the last write before render (prevents animation
  // keyframes from overriding the facing direction).
  animateTimeline(timeline, frameRef);

  const mode = reactiveConfig.value.mode;
  const follower = getActiveFollower(state);

  if (reactiveConfig.value.playing && follower && state.isFollowing && state.followState) {
    const { currentIndex, progress, waypoints } = state.followState;
    const t = (currentIndex + progress) / Math.max(1, waypoints.length - 1);
    const easingMultiplier = getEasingSpeedMultiplier(
      t,
      reactiveConfig.value.easing as EasingName,
      reactiveConfig.value.easingIntensity
    );
    state.lastEasingMultiplier = easingMultiplier;
    const effectiveSpeed = reactiveConfig.value.speed * easingMultiplier;

    let isComplete = false;

    if (mode === "physics") {
      const result = modelFollowPhysicsTick(follower, state.followState, effectiveSpeed, delta);
      state.followState = result.state;
      isComplete = result.isComplete;
      // Ball passes through dynamic cubes; manual proximity impulse pushes them.
      modelFollowApplyContactImpulses(follower, state.obstacles, effectiveSpeed, delta, reactiveConfig.value.obstacleImpulse);
    } else if (mode === "goomba") {
      // CC with setApplyImpulsesToDynamicBodies handles pushing green cubes directly.
      // Update character mass each frame so the Push Force slider takes effect immediately.
      modelFollowSetCharacterMass(follower, reactiveConfig.value.obstacleImpulse);
      const result = modelFollowPhysicsTick(follower, state.followState, effectiveSpeed, delta, true);
      state.followState = result.state;
      isComplete = result.isComplete;
      // Stop when the goomba reaches a fixed (red) obstacle — idle animation kicks in via isFollowing.
      if (modelFollowIsBlockedByFixedObstacle(follower, state.obstacles)) {
        state.isFollowing = false;
      }
    } else {
      const result = modelFollowTick(follower, state.followState, effectiveSpeed, delta);
      state.followState = result.state;
      isComplete = result.isComplete;
    }

    if (isComplete) {
      if (reactiveConfig.value.pingPong && state.smoothWaypoints.length >= 2) {
        // Reverse the smooth waypoints so the follower retraces the path backward.
        // The follower is already at the last waypoint, which becomes waypoints[0]
        // after reversal, so startFollowing places it exactly there — no jump.
        state.smoothWaypoints = [...state.smoothWaypoints].reverse();
        startFollowing(state);
      } else if (reactiveConfig.value.loop && state.smoothWaypoints.length >= 2) {
        startFollowing(state);
      } else {
        state.isFollowing = false;
      }
    }
  }

  state.renderer.render(state.scene, state.camera);
};

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

const init = async (): Promise<void> => {
  if (!canvas.value) return;

  const { setup, renderer, scene, camera, world } = await getTools({ canvas: canvas.value });

  // getTools' getDelta only updates inside animate() which we don't use.
  // Use our own clock so delta is correct in our requestAnimationFrame loop.
  const clock = new THREE.Clock();

  await setup({ config: sceneSetupConfig });

  const followerMesh = getBall(scene, world, {
    size: SPHERE_RADIUS,
    color: MESH_FOLLOWER_COLOR,
    type: "kinematicPositionBased",
    position: [0, FOLLOWER_GROUND_Y, 0],
    castShadow: true,
  });

  const waypointNodeGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
  const waypointNodeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  sceneState = {
    renderer,
    scene,
    world,
    camera: camera as THREE.PerspectiveCamera,
    getDelta: () => clock.getDelta(),
    lastDelta: 0,
    lastEasingMultiplier: 1,
    goombaGroundY: GOOMBA_GROUND_Y,
    controlWaypoints: [],
    smoothWaypoints: [],
    pathLine: null,
    followerMesh,
    followerPhysics: null,
    followerGoomba: null,
    followState: null,
    isFollowing: false,
    obstacles: [],
    waypointNodeGeo,
    waypointNodeMat,
    waypointNodes: [],
    selectedNodeIndex: null,
  };

  runAnimation(sceneState!);
};

const onResize = (): void => {
  if (!sceneState) return;
  sceneState.renderer.setSize(window.innerWidth, window.innerHeight);
  sceneState.camera.aspect = window.innerWidth / window.innerHeight;
  sceneState.camera.updateProjectionMatrix();
};

onMounted(async () => {
  setViewPanels({ showConfig: true, showScene: true });
  registerViewConfig(
    route.name as string,
    reactiveConfig,
    configControls,
    sceneConfig,
    sceneControls,
    undefined,
    undefined,
    { clearPath }
  );

  canvas.value?.addEventListener("mousedown", onPointerDown);
  canvas.value?.addEventListener("mousemove", onPointerMove);
  canvas.value?.addEventListener("mouseup", onPointerUp);
  canvas.value?.addEventListener("touchstart", onPointerDown, { passive: false });
  canvas.value?.addEventListener("touchmove", onPointerMove, { passive: false });
  canvas.value?.addEventListener("touchend", onPointerUp);
  window.addEventListener("resize", onResize);
  await init();
});

onUnmounted(() => {
  if (animFrameId !== null) cancelAnimationFrame(animFrameId);
  unregisterGoombaTimelineAction();
  sceneState?.waypointNodeGeo.dispose();
  sceneState?.waypointNodeMat.dispose();
  canvas.value?.removeEventListener("mousedown", onPointerDown);
  canvas.value?.removeEventListener("mousemove", onPointerMove);
  canvas.value?.removeEventListener("mouseup", onPointerUp);
  canvas.value?.removeEventListener("touchstart", onPointerDown);
  canvas.value?.removeEventListener("touchmove", onPointerMove);
  canvas.value?.removeEventListener("touchend", onPointerUp);
  window.removeEventListener("resize", onResize);
  unregisterViewConfig(route.name as string);
  clearViewPanels();
});
</script>

<template>
  <canvas ref="canvas"></canvas>
</template>

<style scoped>
canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
