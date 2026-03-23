<script setup lang="ts">
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { ref, onMounted, onUnmounted } from "vue";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import type { Font } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import { getTools, getWalls, getModel } from "@webgamekit/threejs";
import { createTimelineManager, animateTimeline } from "@webgamekit/animation";
import { registerLightProperties } from "@/utils/lightProperties";
import { useElementPropertiesStore } from "@/stores/elementProperties";
import { useDebugSceneStore } from "@/stores/debugScene";

const canvas = ref<HTMLCanvasElement | null>(null);

let animationId = 0;
let cleanupReference: (() => void) | null = null;

const CAMERA_Z = 14;
const CAMERA_Y = 2;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 200;
const FRUSTUM_HEIGHT = 14;
const BACKGROUND_COLOR = 0x0a0a0a;
const WHITE = 0xffffff;
const AMBIENT_INTENSITY = 2;
const DIR_LIGHT_INTENSITY = 4;
const DIR_LIGHT_POS = 5;
const TARGET_WIDTH = 8;
const TEXT_DEPTH = 0.8;
const GAP = 1.4;
const LETTER_SPACING = 0.3;
const COLLIDER_RESTITUTION = 0.4;
const COLLIDER_FRICTION = 0.6;
const LINEAR_DAMPING = 2.0;
const ANGULAR_DAMPING = 2.0;
const PHYSICS_FPS = 60;
const PHYSICS_STEP = 1 / PHYSICS_FPS;
const DEFAULT_IMPULSE = 90;
const LOGO_IMPULSE_MULTIPLIER = 10;
const DEFAULT_TORQUE = 7.5;
const RESET_DURATION_FRAMES = 60;
const RESET_INTERVAL_FRAMES = 300;
const WALL_DEPTH = 0.3;

const createOrthographicCamera = (): THREE.OrthographicCamera => {
  const aspect = window.innerWidth / window.innerHeight;
  const halfH = FRUSTUM_HEIGHT / 2;
  const halfW = halfH * aspect;
  const camera = new THREE.OrthographicCamera(
    -halfW,
    halfW,
    halfH,
    -halfH,
    CAMERA_NEAR,
    CAMERA_FAR
  );
  camera.position.set(0, CAMERA_Y, CAMERA_Z);
  camera.lookAt(0, CAMERA_Y, 0);
  return camera;
};

const createResizeHandler = (
  camera: THREE.OrthographicCamera,
  renderer: THREE.WebGLRenderer
) => (): void => {
  const halfH = FRUSTUM_HEIGHT / 2;
  const newHalfW = halfH * (window.innerWidth / window.innerHeight);
  camera.left = -newHalfW;
  camera.right = newHalfW;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
};

const createLights = (scene: THREE.Scene) => {
  const ambientLight = new THREE.AmbientLight(WHITE, AMBIENT_INTENSITY);
  ambientLight.name = "ambient-light";
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(WHITE, DIR_LIGHT_INTENSITY);
  dirLight.name = "directional-light";
  dirLight.position.set(DIR_LIGHT_POS, DIR_LIGHT_POS * 2, DIR_LIGHT_POS);
  dirLight.castShadow = true;
  scene.add(dirLight);

  return { ambientLight, dirLight };
};

type BodyEntry = { body: RAPIER.RigidBody; originalPos: THREE.Vector3 };
type PhysicsBodies = Map<THREE.Object3D, BodyEntry>;

const createDynamicBody = (
  world: RAPIER.World,
  position: THREE.Vector3,
  halfExtents: THREE.Vector3
): RAPIER.RigidBody => {
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      .setGravityScale(0.0)
      .setLinearDamping(LINEAR_DAMPING)
      .setAngularDamping(ANGULAR_DAMPING)
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
      .setRestitution(COLLIDER_RESTITUTION)
      .setFriction(COLLIDER_FRICTION),
    body
  );
  return body;
};

const loadLogo = async (
  scene: THREE.Scene,
  world: RAPIER.World,
  bodies: PhysicsBodies,
  material: THREE.Material
): Promise<void> => {
  const model = await getModel(scene, world, "cnotv.glb", {
    type: "dynamic",
    weight: 0,
    damping: LINEAR_DAMPING,
    angular: ANGULAR_DAMPING,
    restitution: COLLIDER_RESTITUTION,
    friction: COLLIDER_FRICTION,
    castShadow: true,
  });

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  model.scale.setScalar(TARGET_WIDTH / size.x);

  box.setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const scaledSize = box.getSize(new THREE.Vector3());
  const logoPos = new THREE.Vector3(
    -center.x,
    -center.y + scaledSize.y / 2 + GAP,
    -center.z
  );
  model.position.copy(logoPos);

  model.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      (child as THREE.Mesh).material = material;
      (child as THREE.Mesh).castShadow = true;
    }
  });

  model.userData.body.setTranslation({ x: logoPos.x, y: logoPos.y, z: logoPos.z }, true);
  bodies.set(model, { body: model.userData.body, originalPos: logoPos.clone() });
};

const buildTextOptions = (font: Font) => ({
  font,
  size: 1,
  depth: TEXT_DEPTH,
  curveSegments: 8,
  bevelEnabled: true,
  bevelThickness: 0.08,
  bevelSize: 0.05,
  bevelSegments: 6,
});

const getSpacingAfter = (index: number): number =>
  index === 2 || index === 3 ? LETTER_SPACING / 2 : LETTER_SPACING;

const loadText = (
  scene: THREE.Scene,
  world: RAPIER.World,
  bodies: PhysicsBodies,
  material: THREE.Material,
  font: Font
): void => {
  const referenceGeometry = new TextGeometry("CNOTV", buildTextOptions(font));
  referenceGeometry.computeBoundingBox();
  const fullWidth =
    referenceGeometry.boundingBox!.max.x - referenceGeometry.boundingBox!.min.x;
  referenceGeometry.dispose();
  const baseTextScale = TARGET_WIDTH / fullWidth;

  const letters = ["C", "N", "O", "T", "V"];
  const letterGeometries = letters.map((letter) => {
    const geometry = new TextGeometry(letter, buildTextOptions(font));
    geometry.computeBoundingBox();
    return geometry;
  });

  const letterMeasurements = letterGeometries.map((geometry) => {
    const box = geometry.boundingBox!;
    return {
      width: (box.max.x - box.min.x) * baseTextScale,
      height: (box.max.y - box.min.y) * baseTextScale,
      depth: (box.max.z - box.min.z) * baseTextScale,
      minX: box.min.x * baseTextScale,
    };
  });

  const totalSpacings = letters
    .slice(0, -1)
    .reduce((sum, _, i) => sum + getSpacingAfter(i), 0);
  const totalLetterWidth = letterMeasurements.reduce((sum, { width }) => sum + width, 0);
  const sizeCorrection = (TARGET_WIDTH - totalSpacings) / totalLetterWidth;
  const textScale = baseTextScale * sizeCorrection;

  let currentX = 0;
  const meshes = letterGeometries.map((geometry, i) => {
    const { width, height, depth, minX } = letterMeasurements[i];
    const scaledWidth = width * sizeCorrection;
    const scaledHeight = height * sizeCorrection;
    const scaledDepth = depth * sizeCorrection;
    const scaledMinX = minX * sizeCorrection;

    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.setScalar(textScale);
    mesh.position.set(currentX - scaledMinX, -(scaledHeight / 2), 0);
    mesh.castShadow = true;
    scene.add(mesh);

    currentX += scaledWidth + (i < letters.length - 1 ? getSpacingAfter(i) : 0);

    return { mesh, scaledWidth, scaledHeight, scaledDepth };
  });

  const centerX = currentX / 2;
  meshes.forEach(({ mesh, scaledWidth, scaledHeight, scaledDepth }) => {
    mesh.position.x -= centerX;
    const body = createDynamicBody(
      world,
      mesh.position,
      new THREE.Vector3(scaledWidth / 2, scaledHeight / 2, scaledDepth / 2)
    );
    bodies.set(mesh, { body, originalPos: mesh.position.clone() });
  });
};

const getAncestors = (object: THREE.Object3D): THREE.Object3D[] =>
  object.parent ? [object, ...getAncestors(object.parent)] : [object];

const findBodyForObject = (
  object: THREE.Object3D,
  bodies: PhysicsBodies
): RAPIER.RigidBody | null =>
  getAncestors(object).reduce<RAPIER.RigidBody | null>(
    (found, ancestor) => found ?? bodies.get(ancestor)?.body ?? null,
    null
  );

type PhysicsConfig = { impulse: number; torque: number };

const createClickHandler = (
  camera: THREE.OrthographicCamera,
  bodies: PhysicsBodies,
  config: PhysicsConfig
) => (event: PointerEvent): void => {
  const pointer = new THREE.Vector2(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointer, camera);

  const targets = [...bodies.keys()].flatMap((object) =>
    object instanceof THREE.Group ? [...object.children] : [object]
  );
  const hits = raycaster.intersectObjects(targets, true);
  if (hits.length === 0) return;

  const hit = hits[0];
  const body = findBodyForObject(hit.object, bodies);
  if (!body) return;

  const center = body.translation();
  const offset = new THREE.Vector3(
    hit.point.x - center.x,
    hit.point.y - center.y,
    hit.point.z - center.z
  );
  const direction = offset.clone().negate().normalize();
  const bodyOwner = [...bodies.entries()].find(([, entry]) => entry.body === body)?.[0];
  const impulseScale = bodyOwner instanceof THREE.Group ? LOGO_IMPULSE_MULTIPLIER : 1;
  const magnitude = config.impulse * impulseScale;

  body.applyImpulse(
    {
      x: direction.x * magnitude,
      y: direction.y * magnitude,
      z: direction.z * magnitude,
    },
    true
  );

  const offsetLength = offset.length();
  const torque = offsetLength * config.torque * impulseScale;
  body.applyTorqueImpulse(
    {
      x: offset.y * torque,
      y: -offset.x * torque,
      z: offset.x * torque,
    },
    true
  );
};

const createResetTimeline = (bodies: PhysicsBodies) => {
  const timelineManager = createTimelineManager();
  let resetFrame = 0;
  const resetStartPositions = new Map<THREE.Object3D, THREE.Vector3>();
  const resetStartRotations = new Map<THREE.Object3D, THREE.Quaternion>();

  timelineManager.addAction({
    interval: [RESET_DURATION_FRAMES, RESET_INTERVAL_FRAMES - RESET_DURATION_FRAMES],
    actionStart: () => {
      resetFrame = 0;
      resetStartPositions.clear();
      resetStartRotations.clear();
      bodies.forEach(({ body }, mesh) => {
        const pos = body.translation();
        const rot = body.rotation();
        resetStartPositions.set(mesh, new THREE.Vector3(pos.x, pos.y, pos.z));
        resetStartRotations.set(mesh, new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w));
      });
    },
    action: () => {
      resetFrame++;
      const progress = Math.min(1, resetFrame / RESET_DURATION_FRAMES);
      const identityQuat = new THREE.Quaternion();
      bodies.forEach(({ body, originalPos }, mesh) => {
        const startPos = resetStartPositions.get(mesh);
        const startRot = resetStartRotations.get(mesh);
        if (!startPos || !startRot) return;
        const newPos = startPos.clone().lerp(originalPos, progress);
        const newRot = startRot.clone().slerp(identityQuat, progress);
        body.setTranslation({ x: newPos.x, y: newPos.y, z: newPos.z }, true);
        body.setRotation({ x: newRot.x, y: newRot.y, z: newRot.z, w: newRot.w }, true);
        body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      });
    },
  });

  return timelineManager;
};

const init = async (canvasElement: HTMLCanvasElement): Promise<void> => {
  const { renderer, scene, world } = await getTools({
    canvas: canvasElement,
    resize: false,
  });

  renderer.setClearColor(BACKGROUND_COLOR, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene.background = null;

  const camera = createOrthographicCamera();
  const { ambientLight, dirLight } = createLights(scene);
  const contentMaterial = new THREE.MeshStandardMaterial({
    color: 0xdddddd,
    roughness: 0.3,
    metalness: 0.6,
  });

  const bodies: PhysicsBodies = new Map();
  await loadLogo(scene, world, bodies, contentMaterial);

  new FontLoader().load(
    "/node_modules/three/examples/fonts/helvetiker_bold.typeface.json",
    (font) => {
      loadText(scene, world, bodies, contentMaterial, font);
    }
  );

  const wallAspect = window.innerWidth / window.innerHeight;
  const wallLength = Math.ceil(FRUSTUM_HEIGHT * wallAspect);
  const wallsGroup = getWalls(scene, world, {
    length: wallLength,
    height: FRUSTUM_HEIGHT,
    depth: WALL_DEPTH,
  });
  wallsGroup.rotation.z = Math.PI / 2;

  registerLightProperties({
    light: ambientLight,
    name: "ambient-light",
    title: "Ambient Light",
  });
  registerLightProperties({
    light: dirLight,
    name: "directional-light",
    title: "Directional Light",
  });
  useDebugSceneStore().registerSceneElements((camera as unknown) as THREE.Camera, [
    ambientLight,
    dirLight,
  ]);

  const physicsConfig: PhysicsConfig = {
    impulse: DEFAULT_IMPULSE,
    torque: DEFAULT_TORQUE,
  };
  useElementPropertiesStore().registerElementProperties("physics", {
    title: "Physics",
    schema: {
      impulse: { label: "Movement Speed", min: 0, max: 500, step: 1 },
      torque: { label: "Rotation Speed", min: 0, max: 100, step: 0.5 },
    },
    getValue: (path) => physicsConfig[path as keyof PhysicsConfig],
    updateValue: (path, value) => {
      physicsConfig[path as keyof PhysicsConfig] = value as number;
    },
  });

  const timelineManager = createResetTimeline(bodies);

  const onResize = createResizeHandler(camera, renderer);
  const onPointerDown = createClickHandler(camera, bodies, physicsConfig);
  window.addEventListener("resize", onResize);
  canvasElement.addEventListener("pointerdown", onPointerDown);

  const clock = new THREE.Clock();
  let accumulator = 0;
  let frame = 0;

  const runAnimation = () => {
    animationId = requestAnimationFrame(runAnimation);
    frame++;
    const delta = clock.getDelta();

    accumulator += delta;
    const steps = Math.floor(accumulator / PHYSICS_STEP);
    Array.from({ length: steps }).forEach(() => world.step());
    accumulator -= steps * PHYSICS_STEP;

    animateTimeline(timelineManager, frame);

    bodies.forEach(({ body }, mesh) => {
      const pos = body.translation();
      const rot = body.rotation();
      mesh.position.set(pos.x, pos.y, pos.z);
      mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
    });

    renderer.render(scene, camera);
  };
  runAnimation();

  cleanupReference = () => {
    window.removeEventListener("resize", onResize);
    canvasElement.removeEventListener("pointerdown", onPointerDown);
    contentMaterial.dispose();
    renderer.dispose();
  };
};

onMounted(() => {
  if (canvas.value) init(canvas.value);
});

onUnmounted(() => {
  cancelAnimationFrame(animationId);
  useElementPropertiesStore().clearAllElementProperties();
  useDebugSceneStore().clearSceneElements();
  cleanupReference?.();
  cleanupReference = null;
});
</script>

<template>
  <canvas ref="canvas" class="landing-page__canvas" />
</template>

<style scoped>
.landing-page__canvas {
  display: block;
  width: 100%;
  height: 100%;
  position: fixed;
  inset: 0;
}
</style>
