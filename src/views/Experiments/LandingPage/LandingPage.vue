<script setup lang="ts">
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { ref, onMounted, onUnmounted } from "vue";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import type { Font } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import { getTools } from "@webgamekit/threejs";
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

type PhysicsBodies = Map<THREE.Object3D, RAPIER.RigidBody>;

const createDynamicBody = (
  world: RAPIER.World,
  bodies: PhysicsBodies,
  mesh: THREE.Object3D,
  halfExtents: THREE.Vector3
): RAPIER.RigidBody => {
  const { x, y, z } = mesh.position;
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(x, y, z)
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
  bodies.set(mesh, body);
  return body;
};

const loadLogo = (
  scene: THREE.Scene,
  world: RAPIER.World,
  bodies: PhysicsBodies,
  material: THREE.Material
): void => {
  new GLTFLoader().load("/cnotv.glb", (gltf) => {
    const model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    model.scale.setScalar(TARGET_WIDTH / size.x);

    box.setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const scaledSize = box.getSize(new THREE.Vector3());
    model.position.set(-center.x, -center.y + scaledSize.y / 2 + GAP, -center.z);

    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).material = material;
        (child as THREE.Mesh).castShadow = true;
      }
    });

    scene.add(model);
    createDynamicBody(
      world,
      bodies,
      model,
      new THREE.Vector3(scaledSize.x / 2, scaledSize.y / 2, scaledSize.z / 2)
    );
  });
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
  const textScale = TARGET_WIDTH / fullWidth;

  const letters = ["C", "N", "O", "T", "V"];
  const { meshes, currentX: finalX } = letters.reduce(
    ({ meshes, currentX }, letter) => {
      const geometry = new TextGeometry(letter, buildTextOptions(font));
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      const letterWidth = (box.max.x - box.min.x) * textScale;
      const letterHeight = (box.max.y - box.min.y) * textScale;
      const letterDepth = (box.max.z - box.min.z) * textScale;
      const mesh = new THREE.Mesh(geometry, material);
      mesh.scale.setScalar(textScale);
      mesh.position.set(currentX - box.min.x * textScale, -(letterHeight / 2), 0);
      mesh.castShadow = true;
      scene.add(mesh);
      return {
        meshes: [...meshes, { mesh, letterWidth, letterHeight, letterDepth }],
        currentX: currentX + letterWidth + LETTER_SPACING,
      };
    },
    {
      meshes: [] as {
        mesh: THREE.Mesh;
        letterWidth: number;
        letterHeight: number;
        letterDepth: number;
      }[],
      currentX: 0,
    }
  );

  const totalWidth = finalX - LETTER_SPACING;
  const centerX = totalWidth / 2;
  meshes.forEach(({ mesh, letterWidth, letterHeight, letterDepth }) => {
    mesh.position.x -= centerX;
    createDynamicBody(
      world,
      bodies,
      mesh,
      new THREE.Vector3(letterWidth / 2, letterHeight / 2, letterDepth / 2)
    );
  });
};

const getAncestors = (object: THREE.Object3D): THREE.Object3D[] =>
  object.parent ? [object, ...getAncestors(object.parent)] : [object];

const findBodyForObject = (
  object: THREE.Object3D,
  bodies: PhysicsBodies
): RAPIER.RigidBody | null =>
  getAncestors(object).reduce<RAPIER.RigidBody | null>(
    (found, ancestor) => found ?? bodies.get(ancestor) ?? null,
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
  const bodyOwner = [...bodies.entries()].find(([, b]) => b === body)?.[0];
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
  loadLogo(scene, world, bodies, contentMaterial);

  new FontLoader().load(
    "/node_modules/three/examples/fonts/helvetiker_bold.typeface.json",
    (font) => {
      loadText(scene, world, bodies, contentMaterial, font);
    }
  );

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

  const onResize = createResizeHandler(camera, renderer);
  const onPointerDown = createClickHandler(camera, bodies, physicsConfig);
  window.addEventListener("resize", onResize);
  canvasElement.addEventListener("pointerdown", onPointerDown);

  const clock = new THREE.Clock();
  let accumulator = 0;

  const runAnimation = () => {
    animationId = requestAnimationFrame(runAnimation);
    const delta = clock.getDelta();

    accumulator += delta;
    const steps = Math.floor(accumulator / PHYSICS_STEP);
    Array.from({ length: steps }).forEach(() => world.step());
    accumulator -= steps * PHYSICS_STEP;

    bodies.forEach((body, mesh) => {
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
