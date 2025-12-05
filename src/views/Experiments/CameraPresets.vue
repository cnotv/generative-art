<script setup>
import { onMounted, ref, onUnmounted } from "vue";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

const canvas = ref(null);
const canvas1 = ref(null);
const canvas2 = ref(null);
const canvas3 = ref(null);
const canvas4 = ref(null);
let scene, camera, renderer, world, clock;
let cameras = [];
let renderers = [];
let orbitControls;
const isSplitScreen = ref(false);
let geekoMixer,
  geekoAction,
  characterController,
  geekoRigidBody,
  bugRigidBody,
  bugMesh,
  geekoCollider;
let geekoObject;
const autoTracking = ref(true);
let jumpVelocity = 0;
const cameraView = ref("default"); // 'default', 'top', 'left', 'right'
const cameraType = ref("perspective"); // 'perspective', 'orthographic', 'fisheye', 'cinematic', 'orbit'
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

  // Setup viewports
  const viewportWidth = isSplitScreen.value ? window.innerWidth / 2 : window.innerWidth;
  const viewportHeight = isSplitScreen.value
    ? window.innerHeight / 2
    : window.innerHeight;
  const aspect = viewportWidth / viewportHeight;
  const frustumSize = 40;
  const verticalOffset = 15;
  const frustumSize2 = 30;
  const verticalOffset2 = 10;

  // Camera configurations
  const cameraConfigs = [
    {
      name: "perspective",
      camera: new THREE.PerspectiveCamera(75, aspect, 0.1, 1000),
      position: [0, 5, 20],
    },
    {
      name: "orthographic-preset",
      camera: new THREE.OrthographicCamera(
        (frustumSize2 * aspect) / -2,
        (frustumSize2 * aspect) / 2,
        frustumSize2 / 2 + verticalOffset2,
        frustumSize2 / -2 + verticalOffset2,
        0.1,
        1000
      ),
      position: [0, 5, 20],
      frustumSize: frustumSize2,
      verticalOffset: verticalOffset2,
    },
    {
      name: "fisheye",
      camera: new THREE.PerspectiveCamera(120, aspect, 0.1, 1000),
      position: [0, 5, 20],
    },
    {
      name: "orbit",
      camera: new THREE.PerspectiveCamera(75, aspect, 0.1, 1000),
      position: [0, 10, 15],
    },
    {
      name: "cinematic",
      camera: new THREE.PerspectiveCamera(35, aspect, 0.1, 1000),
      position: [0, 5, 20],
    },
    {
      name: "orthographic",
      camera: new THREE.OrthographicCamera(
        (frustumSize * aspect) / -2,
        (frustumSize * aspect) / 2,
        frustumSize / 2 + verticalOffset,
        frustumSize / -2 + verticalOffset,
        0.1,
        1000
      ),
      position: [10, 12, 10],
      lookAt: [0, -verticalOffset, 0],
    },
  ];

  // Create cameras
  cameras = cameraConfigs.map((config) => {
    config.camera.position.set(...config.position);
    if (config.lookAt) {
      config.camera.lookAt(...config.lookAt);
    }
    return { ...config };
  });

  // Set initial camera
  camera = cameras[0].camera;

  // Create all renderers (both single and split screen)
  renderer = new THREE.WebGLRenderer({ canvas: canvas.value, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;

  const canvasRefs = [canvas1, canvas2, canvas3, canvas4];
  renderers = canvasRefs.map((canvasRef) => {
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.value,
      antialias: true,
    });
    renderer.setSize(viewportWidth, viewportHeight);
    renderer.shadowMap.enabled = true;
    return renderer;
  });

  // Create OrbitControls for orbit camera
  const orbitCam = cameras.find((c) => c.name === "orbit");
  if (orbitCam) {
    const targetCanvas = isSplitScreen.value ? renderer3.value : canvas.value;
    orbitControls = new OrbitControls(
      orbitCam.camera,
      isSplitScreen.value ? renderers[3].domElement : renderer.domElement
    );
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.05;
    orbitControls.enabled = isSplitScreen.value || cameraType.value === "orbit";
  }

  // 2. Setup Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
  directionalLight.position.set(20, 30, 20);
  directionalLight.castShadow = true;

  // Configure shadow properties for larger, higher quality shadows
  directionalLight.shadow.mapSize.width = 4096;
  directionalLight.shadow.mapSize.height = 4096;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 500;
  directionalLight.shadow.camera.left = -50;
  directionalLight.shadow.camera.right = 50;
  directionalLight.shadow.camera.top = 50;
  directionalLight.shadow.camera.bottom = -50;
  directionalLight.shadow.bias = -0.0001;
  directionalLight.shadow.radius = 1;

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
      // Replace material with non-reflective Lambert material
      if (child.material) {
        const oldMaterial = child.material;
        child.material = new THREE.MeshLambertMaterial({
          color: oldMaterial.color || 0xffffff,
          map: oldMaterial.map,
          flatShading: false
        });
      }
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

    if (autoTracking.value) {
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

    if (keys.space && isGrounded && !autoTracking.value) {
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
    if (autoTracking.value && direction.length() > 0.01) {
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

    // Update all camera positions to follow the character
    const geekoPos = geekoObject.position;

    // Update camera positions based on configuration
    cameras.forEach((camConfig, index) => {
      const cam = camConfig.camera;

      switch (camConfig.name) {
        case "perspective":
        case "fisheye":
        case "orthographic-preset":
          if (cameraView.value === "default" || isSplitScreen.value) {
            cam.position.set(geekoPos.x, geekoPos.y + 5, geekoPos.z + 20);
          } else if (cameraView.value === "top") {
            cam.position.set(geekoPos.x, geekoPos.y + 15, geekoPos.z);
          } else if (cameraView.value === "left") {
            cam.position.set(geekoPos.x - 15, geekoPos.y + 5, geekoPos.z);
          } else if (cameraView.value === "right") {
            cam.position.set(geekoPos.x + 15, geekoPos.y + 5, geekoPos.z);
          }
          cam.lookAt(geekoPos.x, geekoPos.y, geekoPos.z);
          break;
        case "orthographic":
          cam.position.set(geekoPos.x + 10, geekoPos.y + 12, geekoPos.z + 10);
          cam.lookAt(geekoPos.x, geekoPos.y, geekoPos.z);
          break;
        case "orbit":
          if (orbitControls) {
            orbitControls.target.set(geekoPos.x, geekoPos.y, geekoPos.z);
            orbitControls.update();
          }
          break;
        case "cinematic":
          cam.position.set(geekoPos.x, geekoPos.y + 3, geekoPos.z + 10);
          cam.lookAt(geekoPos.x, geekoPos.y, geekoPos.z);
          break;
      }
    });

    // Render based on mode
    if (isSplitScreen.value) {
      // Map specific cameras to each viewport
      const splitScreenCameras = [0, 1, 5, 3]; // perspective, orthographic-preset, orthographic, orbit
      renderers.forEach((rend, index) => {
        const cameraIndex = splitScreenCameras[index];
        if (cameras[cameraIndex]) {
          rend.render(scene, cameras[cameraIndex].camera);
        }
      });
    } else {
      renderer.render(scene, camera);
    }
  };

  animate();
};

const onWindowResize = () => {
  const viewportWidth = isSplitScreen.value ? window.innerWidth / 2 : window.innerWidth;
  const viewportHeight = isSplitScreen.value
    ? window.innerHeight / 2
    : window.innerHeight;
  const aspect = viewportWidth / viewportHeight;
  const frustumSize = 40;
  const verticalOffset = 15;

  // Update all cameras
  cameras.forEach((camConfig) => {
    const cam = camConfig.camera;
    if (cam.isPerspectiveCamera) {
      cam.aspect = aspect;
      cam.updateProjectionMatrix();
    } else if (cam.isOrthographicCamera) {
      // Use specific frustum settings if available
      const fs = camConfig.frustumSize || frustumSize;
      const vo = camConfig.verticalOffset || verticalOffset;
      cam.left = (fs * aspect) / -2;
      cam.right = (fs * aspect) / 2;
      cam.top = fs / 2 + vo;
      cam.bottom = fs / -2 + vo;
      cam.updateProjectionMatrix();
    }
  });

  // Update renderers
  if (isSplitScreen.value) {
    renderers.forEach((rend) => rend.setSize(viewportWidth, viewportHeight));
  } else if (renderer) {
    renderer.setSize(viewportWidth, viewportHeight);
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
    autoTracking.value = !autoTracking.value;
    console.log("Auto-tracking:", autoTracking.value ? "ON" : "OFF");
  }

  // Arrow keys for camera views (single camera mode only)
  if (!isSplitScreen.value) {
    if (e.key === "ArrowUp") {
      cameraView.value = "top";
      console.log("Camera: Top view");
    }
    if (e.key === "ArrowLeft") {
      cameraView.value = "left";
      console.log("Camera: Left view");
    }
    if (e.key === "ArrowRight") {
      cameraView.value = "right";
      console.log("Camera: Right view");
    }
    if (e.key === "ArrowDown") {
      cameraView.value = "default";
      console.log("Camera: Default view");
    }
  }

  // Number keys for camera type - disable split screen and switch to single camera
  if (e.key === "1") {
    isSplitScreen.value = false;
    cameraType.value = "perspective";
    camera = cameras.find((c) => c.name === "perspective")?.camera;
    if (orbitControls) orbitControls.enabled = false;
    onWindowResize();
    console.log("Camera: Perspective (75° FOV)");
  }
  if (e.key === "2") {
    isSplitScreen.value = false;
    cameraType.value = "orthographic-preset";
    camera = cameras.find((c) => c.name === "orthographic-preset")?.camera;
    if (orbitControls) orbitControls.enabled = false;
    onWindowResize();
    console.log("Camera: Orthographic Preset (Following)");
  }
  if (e.key === "3") {
    isSplitScreen.value = false;
    cameraType.value = "fisheye";
    camera = cameras.find((c) => c.name === "fisheye")?.camera;
    if (orbitControls) orbitControls.enabled = false;
    onWindowResize();
    console.log("Camera: Fisheye (120° Wide FOV)");
  }
  if (e.key === "4") {
    isSplitScreen.value = false;
    cameraType.value = "orbit";
    camera = cameras.find((c) => c.name === "orbit")?.camera;
    if (orbitControls) orbitControls.enabled = true;
    onWindowResize();
    console.log("Camera: Orbit (Free mouse control)");
  }
  if (e.key === "5") {
    isSplitScreen.value = false;
    cameraType.value = "cinematic";
    camera = cameras.find((c) => c.name === "cinematic")?.camera;
    if (orbitControls) orbitControls.enabled = false;
    onWindowResize();
    console.log("Camera: Cinematic (35° Telephoto)");
  }
  if (e.key === "6") {
    isSplitScreen.value = false;
    cameraType.value = "orthographic";
    camera = cameras.find((c) => c.name === "orthographic")?.camera;
    if (orbitControls) orbitControls.enabled = false;
    onWindowResize();
    console.log("Camera: Orthographic (Isometric)");
  }

  // Number 7 enables split screen mode (doesn't disable)
  if (e.key === "7") {
    if (!isSplitScreen.value) {
      isSplitScreen.value = true;
      console.log("Split screen: ON");
      // Update OrbitControls state
      if (orbitControls) {
        orbitControls.enabled = true;
      }
      // Trigger resize to update renderers
      onWindowResize();
    }
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
  <!-- Single camera mode -->
  <canvas
    ref="canvas"
    :style="{
      position: 'relative',
      zIndex: 0,
      width: '100vw',
      height: '100vh',
      display: isSplitScreen ? 'none' : 'block',
    }"
  ></canvas>

  <!-- Split screen mode -->
  <div
    :style="{
      display: isSplitScreen ? 'grid' : 'none',
      gridTemplateColumns: '1fr 1fr',
      gridTemplateRows: '1fr 1fr',
      width: '100vw',
      height: '100vh',
      margin: 0,
      padding: 0,
      overflow: 'hidden',
    }"
    style="
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 1fr 1fr;
      width: 100vw;
      height: 100vh;
      margin: 0;
      padding: 0;
      overflow: hidden;
    "
  >
    <div style="position: relative; border: 1px solid #333">
      <canvas ref="canvas1"></canvas>
      <div
        style="
          position: absolute;
          top: 10px;
          left: 10px;
          color: white;
          background: rgba(0, 0, 0, 0.5);
          padding: 5px 10px;
          font-family: monospace;
        "
      >
        Perspective (75° FOV)
      </div>
    </div>
    <div style="position: relative; border: 1px solid #333">
      <canvas ref="canvas2"></canvas>
      <div
        style="
          position: absolute;
          top: 10px;
          left: 10px;
          color: white;
          background: rgba(0, 0, 0, 0.5);
          padding: 5px 10px;
          font-family: monospace;
        "
      >
        Orthographic (Isometric)
      </div>
    </div>
    <div style="position: relative; border: 1px solid #333">
      <canvas ref="canvas3"></canvas>
      <div
        style="
          position: absolute;
          top: 10px;
          left: 10px;
          color: white;
          background: rgba(0, 0, 0, 0.5);
          padding: 5px 10px;
          font-family: monospace;
        "
      >
        Orthographic (Following)
      </div>
    </div>
    <div style="position: relative; border: 1px solid #333">
      <canvas ref="canvas4"></canvas>
      <div
        style="
          position: absolute;
          top: 10px;
          left: 10px;
          color: white;
          background: rgba(0, 0, 0, 0.5);
          padding: 5px 10px;
          font-family: monospace;
        "
      >
        Orbit (Mouse Control)
      </div>
    </div>
  </div>

  <!-- Instructions overlay -->
  <div
    style="
      position: fixed;
      bottom: 10px;
      left: 10px;
      color: white;
      background: rgba(0, 0, 0, 0.7);
      padding: 10px;
      font-family: monospace;
      font-size: 12px;
    "
  >
    <div>
      Mode: {{ isSplitScreen ? "Split Screen" : cameraType }} | View: {{ cameraView }}
    </div>
    <div>Press 7: Toggle Split Screen ({{ isSplitScreen ? "ON" : "OFF" }})</div>
    <div v-if="!isSplitScreen">Press 1-6: Switch Camera | Arrows: Change View</div>
    <div>
      WASD: Move | SPACE: Jump | ENTER: Auto-track ({{ autoTracking ? "ON" : "OFF" }})
    </div>
  </div>
</template>
