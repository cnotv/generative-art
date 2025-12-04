<script setup>
import { onMounted, ref, onUnmounted } from "vue";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

const canvas = ref(null);
let scene, camera, renderer, world, clock;
let perspectiveCamera, orthographicCamera, fisheyeCamera, cinematicCamera, orbitCamera;
let orbitControls;
let geekoMixer,
  geekoAction,
  characterController,
  geekoRigidBody,
  bugRigidBody,
  bugMesh,
  geekoCollider;
let geekoObject;
let autoTracking = true;
let jumpVelocity = 0;
let cameraView = "default"; // 'default', 'top', 'left', 'right'
let cameraType = "perspective"; // 'perspective', 'orthographic', 'fisheye', 'cinematic', 'orbit'
const cubeSize = 2; // Configurable cube size
const gridGap = cubeSize; // Gap equals cube size
const obstacles = []; // Store obstacle positions
const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
  space: false,
};

const score = () => {
  console.log("Score!");
};

const init = async () => {
  // 1. Setup Scene, Camera, Renderer
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb); // Sky color

  // Create perspective camera
  perspectiveCamera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  perspectiveCamera.position.set(0, 5, 20);

  // Create orthographic camera (isometric)
  const aspect = window.innerWidth / window.innerHeight;
  const frustumSize = 40;
  const verticalOffset = 15; // Shift view downward
  orthographicCamera = new THREE.OrthographicCamera(
    (frustumSize * aspect) / -2,
    (frustumSize * aspect) / 2,
    frustumSize / 2 + verticalOffset, // Shift top up
    frustumSize / -2 + verticalOffset, // Shift bottom up (shows more below)
    0.1,
    1000
  );
  orthographicCamera.position.set(10, 12, 10); // Raised camera higher
  orthographicCamera.lookAt(0, -verticalOffset, 0);

  // Create fisheye-style camera (wide FOV perspective)
  fisheyeCamera = new THREE.PerspectiveCamera(
    120, // Very wide field of view
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  fisheyeCamera.position.set(0, 5, 20);

  // Create cinematic camera (narrow FOV for telephoto effect)
  cinematicCamera = new THREE.PerspectiveCamera(
    35, // Narrow field of view
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  cinematicCamera.position.set(0, 5, 20);

  // Create orbit camera with free mouse control
  orbitCamera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  orbitCamera.position.set(0, 10, 15);

  // Set initial camera
  camera = perspectiveCamera;

  renderer = new THREE.WebGLRenderer({ canvas: canvas.value, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;

  // Create OrbitControls for orbit camera
  orbitControls = new OrbitControls(orbitCamera, renderer.domElement);
  orbitControls.enableDamping = true;
  orbitControls.dampingFactor = 0.05;
  orbitControls.enabled = false; // Disabled by default

  // 2. Setup Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.1); // Intensity 0.1
  directionalLight.position.set(10, 10, 10);
  directionalLight.castShadow = true;
  scene.add(directionalLight);

  // 3. Setup Physics World (Rapier)
  const gravity = { x: 0.0, y: -9.81, z: 0.0 };
  await RAPIER.init();
  world = new RAPIER.World(gravity);

  // 4. Create Ground
  const groundSize = 10000;
  const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize);
  const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x99ff99 });
  const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  // Ground Physics Body
  const groundBodyDesc = RAPIER.RigidBodyDesc.fixed();
  const groundBody = world.createRigidBody(groundBodyDesc);
  const groundColliderDesc = RAPIER.ColliderDesc.cuboid(
    groundSize / 2,
    0.1,
    groundSize / 2
  );
  world.createCollider(groundColliderDesc, groundBody);

  // Create obstacle cubes on a grid
  const cubeGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
  const cubeMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });

  // Create obstacles in a grid pattern
  const numCubes = 20;
  for (let i = 0; i < numCubes; i++) {
    const gridX = Math.floor(Math.random() * 10) - 5;
    const gridZ = Math.floor(Math.random() * 10) - 5;
    const x = gridX * (cubeSize + gridGap);
    const z = gridZ * (cubeSize + gridGap);

    // Skip if too close to starting position
    if (Math.abs(x) < 3 && Math.abs(z) < 3) continue;

    const cubeMesh = new THREE.Mesh(cubeGeometry, cubeMaterial);
    cubeMesh.position.set(x, cubeSize / 2, z);
    cubeMesh.castShadow = true;
    cubeMesh.receiveShadow = true;
    scene.add(cubeMesh);

    // Cube physics
    const cubeBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, cubeSize / 2, z);
    const cubeBody = world.createRigidBody(cubeBodyDesc);
    const cubeColliderDesc = RAPIER.ColliderDesc.cuboid(
      cubeSize / 2,
      cubeSize / 2,
      cubeSize / 2
    ).setSensor(false); // Make solid, not a sensor
    world.createCollider(cubeColliderDesc, cubeBody);

    obstacles.push({ x, z });
  }

  // 5. Load Model (Geeko)
  const loader = new FBXLoader();

  // Load Model
  geekoObject = await new Promise((resolve, reject) => {
    loader.load("/chameleon.fbx", (object) => resolve(object), undefined, reject);
  });

  geekoObject.position.set(0, -0.75, 0);
  geekoObject.scale.set(0.05, 0.05, 0.05);

  geekoObject.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  scene.add(geekoObject);

  // Geeko Character Controller (for better character movement)
  const rigidBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
    0,
    5,
    0
  );
  geekoRigidBody = world.createRigidBody(rigidBodyDesc);

  // Capsule collider for the character
  const colliderDesc = RAPIER.ColliderDesc.capsule(0.5, 0.3);
  geekoCollider = world.createCollider(colliderDesc, geekoRigidBody);

  // Create character controller
  characterController = world.createCharacterController(0.01);
  // Disable autostep to prevent climbing over blocks
  // characterController.enableAutostep(0.5, 0.2, true);
  characterController.enableSnapToGround(0.5);

  // Create Bug Sphere
  const bugGeometry = new THREE.SphereGeometry(0.5, 32, 32);
  const bugMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  bugMesh = new THREE.Mesh(bugGeometry, bugMaterial);

  // Find valid position for bug (not on obstacles)
  const getValidBugPosition = () => {
    let validPos = null;
    let attempts = 0;
    while (!validPos && attempts < 50) {
      const x = Math.random() * 20 - 10;
      const z = Math.random() * 20 - 10;
      const clearOfObstacles = obstacles.every(
        (obs) => Math.sqrt((obs.x - x) ** 2 + (obs.z - z) ** 2) > cubeSize * 1.5
      );
      if (clearOfObstacles) {
        validPos = { x, y: 1, z };
      }
      attempts++;
    }
    return validPos || { x: 15, y: 1, z: 0 };
  };

  const bugPos = getValidBugPosition();
  bugMesh.position.set(bugPos.x, bugPos.y, bugPos.z);
  bugMesh.castShadow = true;
  scene.add(bugMesh);

  // Bug Physics Body
  const bugBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(
    bugPos.x,
    bugPos.y,
    bugPos.z
  );
  bugRigidBody = world.createRigidBody(bugBodyDesc);
  const bugColliderDesc = RAPIER.ColliderDesc.ball(0.5);
  world.createCollider(bugColliderDesc, bugRigidBody);

  // 6. Load Animations
  const animObject = await new Promise((resolve, reject) => {
    loader.load(
      "/chameleon_animations.fbx",
      (object) => resolve(object),
      undefined,
      reject
    );
  });

  geekoMixer = new THREE.AnimationMixer(geekoObject);
  if (animObject.animations.length > 0) {
    // Assuming "Walk" is the animation we want, or the first one if named differently in the file
    // The original code referenced geeko.actions["Walk"]
    const clip =
      animObject.animations.find((a) => a.name === "Walk") || animObject.animations[0];
    geekoAction = geekoMixer.clipAction(clip);
    geekoAction.play();
  }

  // 7. Animation Loop
  clock = new THREE.Clock();

  const animate = () => {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    // Step Physics
    world.step();

    // Get current position
    const position = geekoRigidBody.translation();

    let direction = new THREE.Vector3(0, 0, 0);

    if (autoTracking) {
      // Move Geeko toward Bug
      const bugPosition = bugRigidBody.translation();
      direction = new THREE.Vector3(
        bugPosition.x - position.x,
        0, // Keep movement on horizontal plane
        bugPosition.z - position.z
      ).normalize();

      // Check if there's an obstacle ahead and jump if needed
      const lookAheadDist = 2;
      const futureX = position.x + direction.x * lookAheadDist;
      const futureZ = position.z + direction.z * lookAheadDist;

      const obstacleAhead = obstacles.some((obs) => {
        const dist = Math.sqrt((obs.x - futureX) ** 2 + (obs.z - futureZ) ** 2);
        return dist < cubeSize;
      });

      if (obstacleAhead && position.y <= 0.1) {
        jumpVelocity = 0.25; // Jump to clear obstacle
      }
    } else {
      // Manual controls
      // W/S: Forward/Backward based on current rotation
      // A/D: Rotate left/right
      const currentRotation = geekoObject.rotation.y;

      let moveForward = 0;
      if (keys.w) moveForward = 1;
      if (keys.s) moveForward = -1;

      // Calculate direction based on current rotation
      if (moveForward !== 0) {
        direction.x = Math.sin(currentRotation) * moveForward;
        direction.z = Math.cos(currentRotation) * moveForward;
      }

      // Rotate with A/D
      const rotationSpeed = 0.05;
      if (keys.a) geekoObject.rotation.y += rotationSpeed;
      if (keys.d) geekoObject.rotation.y -= rotationSpeed;
    }

    // Handle jump and gravity
    const isGrounded = position.y <= 0.1;

    if (keys.space && isGrounded && !autoTracking) {
      jumpVelocity = 0.2; // Initial jump impulse
    }

    // Apply gravity
    if (!isGrounded || jumpVelocity > 0) {
      jumpVelocity -= 0.01; // Gravity
    } else {
      jumpVelocity = -0.01; // Small downward force to stay grounded
    }

    const speed = 0.1; // Movement speed
    const movement = {
      x: direction.x * speed,
      y: jumpVelocity,
      z: direction.z * speed,
    };

    characterController.computeColliderMovement(geekoCollider, movement);
    const correctedMovement = characterController.computedMovement();

    const newPos = {
      x: position.x + correctedMovement.x,
      y: position.y + correctedMovement.y,
      z: position.z + correctedMovement.z,
    };

    // Keep above ground
    if (newPos.y < 0) {
      newPos.y = 0;
    }

    geekoRigidBody.setNextKinematicTranslation(newPos);

    // Sync Model with Physics Body
    geekoObject.position.set(newPos.x, newPos.y, newPos.z);

    // Rotate geeko to face movement direction (only in auto-tracking mode)
    if (autoTracking && direction.length() > 0.01) {
      const angle = Math.atan2(direction.x, direction.z);
      geekoObject.rotation.y = angle;
    }

    // Check collision/proximity with bug
    const bugPosition = bugRigidBody.translation();
    const distance = Math.sqrt(
      Math.pow(bugPosition.x - newPos.x, 2) + Math.pow(bugPosition.z - newPos.z, 2)
    );

    if (distance < 1.0) {
      // Trigger score when close enough
      score();
      // Reset bug position to valid location
      const newBugPos = (() => {
        let validPos = null;
        let attempts = 0;
        while (!validPos && attempts < 50) {
          const x = Math.random() * 20 - 10;
          const z = Math.random() * 20 - 10;
          const clearOfObstacles = obstacles.every(
            (obs) => Math.sqrt((obs.x - x) ** 2 + (obs.z - z) ** 2) > cubeSize * 1.5
          );
          if (clearOfObstacles) {
            validPos = { x, y: 1, z };
          }
          attempts++;
        }
        return (
          validPos || { x: Math.random() * 20 - 10, y: 1, z: Math.random() * 20 - 10 }
        );
      })();
      bugRigidBody.setTranslation(newBugPos, true);
      bugMesh.position.copy(bugRigidBody.translation());
    }

    // Update Animation
    if (geekoMixer) {
      geekoMixer.update(delta);
    }

    // Update camera based on view mode
    const geekoPos = geekoObject.position;

    // Switch active camera based on type
    switch (cameraType) {
      case "perspective":
        camera = perspectiveCamera;
        orbitControls.enabled = false;
        break;
      case "orthographic":
        camera = orthographicCamera;
        orbitControls.enabled = false;
        break;
      case "fisheye":
        camera = fisheyeCamera;
        orbitControls.enabled = false;
        break;
      case "cinematic":
        camera = cinematicCamera;
        orbitControls.enabled = false;
        break;
      case "orbit":
        camera = orbitCamera;
        orbitControls.enabled = true;
        orbitControls.target.set(geekoPos.x, geekoPos.y, geekoPos.z);
        orbitControls.update();
        break;
      default:
        camera = perspectiveCamera;
        orbitControls.enabled = false;
    }

    // Only update camera position if not in orbit mode
    if (cameraType !== "orbit") {
      switch (cameraView) {
        case "top":
          camera.position.set(geekoPos.x, geekoPos.y + 15, geekoPos.z);
          camera.lookAt(geekoPos.x, geekoPos.y, geekoPos.z);
          break;
        case "left":
          camera.position.set(geekoPos.x - 15, geekoPos.y + 5, geekoPos.z);
          camera.lookAt(geekoPos.x, geekoPos.y, geekoPos.z);
          break;
        case "right":
          camera.position.set(geekoPos.x + 15, geekoPos.y + 5, geekoPos.z);
          camera.lookAt(geekoPos.x, geekoPos.y, geekoPos.z);
          break;
        case "default":
        default:
          camera.position.set(geekoPos.x, geekoPos.y + 5, geekoPos.z + 20);
          camera.lookAt(geekoPos.x, geekoPos.y, geekoPos.z);
          break;
      }
    }

    renderer.render(scene, camera);
  };

  animate();
};

const onWindowResize = () => {
  if (renderer) {
    const aspect = window.innerWidth / window.innerHeight;

    // Update perspective cameras
    if (perspectiveCamera) {
      perspectiveCamera.aspect = aspect;
      perspectiveCamera.updateProjectionMatrix();
    }
    if (fisheyeCamera) {
      fisheyeCamera.aspect = aspect;
      fisheyeCamera.updateProjectionMatrix();
    }
    if (cinematicCamera) {
      cinematicCamera.aspect = aspect;
      cinematicCamera.updateProjectionMatrix();
    }
    if (orbitCamera) {
      orbitCamera.aspect = aspect;
      orbitCamera.updateProjectionMatrix();
    }

    // Update orthographic cameras
    const frustumSize = 30; // Match the initialization value
    const verticalOffset = 5; // Match the initialization offset
    if (orthographicCamera) {
      orthographicCamera.left = (frustumSize * aspect) / -2;
      orthographicCamera.right = (frustumSize * aspect) / 2;
      orthographicCamera.top = frustumSize / 2 + verticalOffset;
      orthographicCamera.bottom = frustumSize / -2 + verticalOffset;
      orthographicCamera.updateProjectionMatrix();
    }

    renderer.setSize(window.innerWidth, window.innerHeight);
  }
};

const onKeyDown = (e) => {
  const key = e.key.toLowerCase();
  if (key === "w" || key === "a" || key === "s" || key === "d") {
    keys[key] = true;
  }
  if (key === " ") {
    keys.space = true;
    e.preventDefault(); // Prevent page scroll
  }
  if (key === "enter") {
    autoTracking = !autoTracking;
    console.log("Auto-tracking:", autoTracking ? "ON" : "OFF");
  }

  // Arrow keys for camera views
  if (e.key === "ArrowUp") {
    cameraView = "top";
    console.log("Camera: Top view");
  }
  if (e.key === "ArrowLeft") {
    cameraView = "left";
    console.log("Camera: Left view");
  }
  if (e.key === "ArrowRight") {
    cameraView = "right";
    console.log("Camera: Right view");
  }
  if (e.key === "ArrowDown") {
    cameraView = "default";
    console.log("Camera: Default view");
  }

  // Number keys for camera type
  if (e.key === "1") {
    cameraType = "perspective";
    console.log("Camera: Perspective (75° FOV)");
  }
  if (e.key === "2") {
    cameraType = "orthographic";
    console.log("Camera: Orthographic (Isometric)");
  }
  if (e.key === "3") {
    cameraType = "fisheye";
    console.log("Camera: Fisheye (120° Wide FOV)");
  }
  if (e.key === "4") {
    cameraType = "cinematic";
    console.log("Camera: Cinematic (35° Telephoto)");
  }
  if (e.key === "5") {
    cameraType = "orbit";
    console.log("Camera: Orbit (Free mouse control)");
  }
};

const onKeyUp = (e) => {
  const key = e.key.toLowerCase();
  if (key === "w" || key === "a" || key === "s" || key === "d") {
    keys[key] = false;
  }
  if (key === " ") {
    keys.space = false;
  }
};

onMounted(async () => {
  await init();
  window.addEventListener("resize", onWindowResize);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
});

onUnmounted(() => {
  window.removeEventListener("resize", onWindowResize);
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
});
</script>

<template>
  <div ref="statsEl"></div>
  <canvas ref="canvas" style="position: relative; z-index: 0"></canvas>
</template>
