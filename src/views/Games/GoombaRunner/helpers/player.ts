import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d";
import { getModel, colorModel, tiltCamera } from "@/utils/threeJs";
import { playAudioFile } from "@/utils/audio";
import { config, GAME_STATUS } from "../config";
import { startBackgroundFalling } from "./background";
import jumpSound from "@/assets/jump.wav";
import gameOverSound from "@/assets/gameover.wav";
import starTexture from "@/assets/star1.png";

export interface PlayerMovement {
  forward: number;
  right: number;
  up: number;
}

export const addPlayerController = async (
  scene: THREE.Scene,
  physics: any,
  world: RAPIER.World
) => {
  // Load Goomba model
  const goombaModel = await getModel(scene, world, "goomba.glb", {
    scale: [0.4, 0.4, 0.4],
    size: 3,
    restitution: -10,
    boundary: 0.5,
    type: "kinematicPositionBased",
    hasGravity: false,
    castShadow: true,
    // showHelper: config.player.helper,
  });

  if (!goombaModel || !goombaModel.mesh) {
    throw new Error("Failed to load goomba model");
  }

  const player = goombaModel.mesh;
  player.castShadow = true;

  // Update colors
  colorModel(player, [
    0xffffff, // White - unknown
    0xffffff, // White - unknown
    0xffffff, // White - unknown
    0xb1865a, // Beige - body
    0xffffff, // White - unknown
    0xbf9a37, // Brown - head
    0xffffff, // White - unknown
    0xffffff, // White - tusks
    0xffffff, // White - unknown
    0x654321, // Dark brown - feet
    0x8b4513, // Brown - default/other parts
  ]);

  // Rotate goomba to face sideways (towards the camera/blocks)
  player.rotation.y = 2;

  // Position player above ground
  const groundY = 0.25; // Ground top surface is at y = 0.25
  const goombaHeight = 5; // Approximate height from center to bottom of Goomba
  const playerY = groundY + goombaHeight; // Position Goomba above ground
  const startingPosition = { x: 0, y: playerY, z: 0 };
  player.position.set(startingPosition.x, startingPosition.y, startingPosition.z);

  // Store starting position for resets
  player.userData.startingPosition = startingPosition;

  // Rapier Character Controller
  const playerController = physics.world.createCharacterController(0.01);
  playerController.setApplyImpulsesToDynamicBodies(true);
  playerController.setCharacterMass(3);

  // Remove existing collider from getModel to avoid conflicts
  if (goombaModel.collider) {
    physics.world.removeCollider(goombaModel.collider);
  }

  // Always create a custom capsule collider for better visibility and control
  const capsuleRadius = 8;
  const capsuleHeight = 20;
  const colliderDesc = physics.RAPIER.ColliderDesc.capsule(
    capsuleHeight / 2,
    capsuleRadius
  );
  colliderDesc.friction = 1;
  colliderDesc.mass = 1;
  player.userData.collider = physics.world.createCollider(colliderDesc);

  // Store base Y position for jump calculations (above ground level)
  player.userData.baseY = playerY;

  return { player, playerController, model: goombaModel };
};

export const handleJump = (
  player: THREE.Mesh,
  gameStatus: string,
  uiStore: any,
  camera: THREE.Camera,
  horizonLine: THREE.Mesh
) => {
  // Always ensure Goomba is at proper ground level, regardless of game state
  const ensureGroundPosition = () => {
    const currentPosition = player.userData.collider.translation();
    const groundLevel = player.userData.baseY;
    const safeY = Math.max(currentPosition.y, groundLevel);

    if (currentPosition.y !== safeY) {
      player.userData.collider.setTranslation({
        x: currentPosition.x,
        y: safeY,
        z: currentPosition.z,
      });
      player.position.set(currentPosition.x, safeY, currentPosition.z);
    }
  };

  // Stop jump animation if game is not playing
  if (gameStatus !== GAME_STATUS.PLAYING) {
    config.player.jump.isActive = false;
    config.player.jump.velocity = 0;
    // Ensure proper ground position even when game is not playing
    ensureGroundPosition();
    return;
  }

  const currentTime = Date.now();

  // Start jump if jump key is pressed OR touch is active and not already jumping
  if (uiStore.controls.jump && !config.player.jump.isActive) {
    config.player.jump.isActive = true;
    config.player.jump.startTime = currentTime;
    config.player.jump.velocity = config.player.jump.height;

    // Play jump sound effect
    playAudioFile(jumpSound);
  }

  // Handle ongoing jump
  if (config.player.jump.isActive) {
    const jumpElapsed = currentTime - config.player.jump.startTime;
    const jumpProgress = jumpElapsed / config.player.jump.duration;

    if (jumpProgress >= 1.0) {
      // Jump complete - ensure Goomba returns to ground level
      config.player.jump.isActive = false;
      config.player.jump.velocity = 0;

      // Reset camera tilt when jump completes
      tiltCamera(camera, 0, 0.15);

      // Reset camera position when jump completes
      if (camera.userData.originalPosition) {
        camera.position.y = camera.userData.originalPosition.y;
      }

      // Reset horizon line position when jump completes
      if (horizonLine.userData.originalPosition) {
        horizonLine.position.y = horizonLine.userData.originalPosition.y;
      }

      // Ensure Goomba is positioned exactly at ground level
      const currentPosition = player.userData.collider.translation();
      const groundLevel = player.userData.baseY; // This is already above ground

      player.userData.collider.setTranslation({
        x: currentPosition.x,
        y: groundLevel,
        z: currentPosition.z,
      });
      player.position.set(currentPosition.x, groundLevel, currentPosition.z);
    } else {
      // Calculate jump arc (parabolic motion)
      const jumpCurve = Math.sin(jumpProgress * Math.PI); // Creates arc from 0 to 1 to 0
      const targetY =
        player.userData.baseY + config.player.jump.height * jumpCurve;

      // Tilt camera based on jump progress (tilt up more during ascent)
      const maxTilt = -0.1; // Negative = tilt up (radians, about 5.7 degrees)
      const cameraTilt = jumpCurve * maxTilt;
      tiltCamera(camera, cameraTilt, 0.2);

      // Move camera up with the player during jump
      if (!camera.userData.originalPosition) {
        camera.userData.originalPosition = {
          x: camera.position.x,
          y: camera.position.y,
          z: camera.position.z,
        };
      }
      const cameraRiseAmount = jumpCurve * 15; // Rise up to 15 units with the jump
      camera.position.y = camera.userData.originalPosition.y + cameraRiseAmount;

      // Adjust horizon line to follow camera movement for consistent visual effect
      if (!horizonLine.userData.originalPosition) {
        horizonLine.userData.originalPosition = {
          x: horizonLine.position.x,
          y: horizonLine.position.y,
          z: horizonLine.position.z,
        };
      }
      const horizonRiseAmount = jumpCurve * 9; // Rise less than camera for depth effect
      horizonLine.position.y =
        horizonLine.userData.originalPosition.y + horizonRiseAmount;

      // Ensure Goomba never goes below ground level
      const minY = player.userData.baseY; // Base Y is already above ground
      const safeTargetY = Math.max(targetY, minY);

      // Update player position
      const currentPosition = player.userData.collider.translation();
      player.userData.collider.setTranslation({
        x: currentPosition.x,
        y: safeTargetY,
        z: currentPosition.z,
      });

      // Sync Three.js mesh
      player.position.set(currentPosition.x, safeTargetY, currentPosition.z);
    }
  }
};

export const movePlayer = (
  player: THREE.Mesh,
  playerController: any,
  physics: any,
  playerMovement: PlayerMovement,
  gameStatus: string
) => {
  if (physics && playerController) {
    const deltaTime = 1 / 60;

    // Player movement
    const speed = config.player.speed * deltaTime;
    const moveVector = new physics.RAPIER.Vector3(
      playerMovement.right * speed,
      playerMovement.up * speed,
      -playerMovement.forward * speed
    );

    playerController.computeColliderMovement(
      player.userData.collider,
      moveVector
    );

    // Read the result
    const translation = playerController.computedMovement();
    const position = player.userData.collider.translation();

    position.x += translation.x;
    // Prevent vertical movement if game is not playing, but always ensure ground collision
    if (gameStatus === GAME_STATUS.PLAYING) {
      position.y += translation.y;
    }
    // Always ensure Goomba never goes below ground level, regardless of game state
    const minY = player.userData.baseY; // Base Y is already above ground
    position.y = Math.max(position.y, minY);
    position.z += translation.z;

    player.userData.collider.setTranslation(position);

    // Sync Three.js mesh with Rapier collider
    player.position.set(position.x, position.y, position.z);
  }
};

export const ensurePlayerAboveGround = (player: THREE.Mesh) => {
  const currentPosition = player.userData.collider.translation();
  const groundLevel = player.userData.baseY;

  if (currentPosition.y < groundLevel) {
    player.userData.collider.setTranslation({
      x: currentPosition.x,
      y: groundLevel,
      z: currentPosition.z,
    });
    player.position.set(currentPosition.x, groundLevel, currentPosition.z);
  }
};

export const handleArcMovement = (player: THREE.Mesh) => {
  if (!player.userData.arcMovement || !player.userData.arcMovement.isActive) {
    return;
  }

  const arcData = player.userData.arcMovement;
  const currentTime = Date.now();
  const elapsed = currentTime - arcData.startTime;
  const progress = Math.min(elapsed / arcData.duration, 1.0);

  if (progress >= 1.0) {
    // Arc movement complete - make Goomba disappear
    arcData.isActive = false;
    player.visible = false;
    return;
  }

  // Create smooth arc movement using easing
  const easeProgress = 1 - Math.pow(1 - progress, 2); // Faster easing: changed from cubic to quadratic

  // Calculate current position along the arc
  const startPos = arcData.startPosition;
  const targetPos = arcData.targetPosition;

  // Create a lower parabolic arc
  const arcHeight = Math.sin(progress * Math.PI) * 8; // Much lower arc: reduced from 20 to 8

  const currentX = startPos.x + (targetPos.x - startPos.x) * easeProgress;
  const currentY =
    startPos.y + (targetPos.y - startPos.y) * easeProgress + arcHeight;
  const currentZ = startPos.z + (targetPos.z - startPos.z) * easeProgress;

  // Update player position
  player.userData.collider.setTranslation({
    x: currentX,
    y: currentY,
    z: currentZ,
  });

  // Sync Three.js mesh
  player.position.set(currentX, currentY, currentZ);

  // Add much more rotation during arc movement for dramatic effect
  player.rotation.x = progress * Math.PI * 1.5; // Rotate forward more: increased from 0.5 to 1.5
  player.rotation.y = 0 + progress * Math.PI * 2; // Maintain right-facing + add spinning
  player.rotation.z = Math.sin(progress * Math.PI * 6) * 0.4; // More wobble: increased frequency and amplitude

  // Fade out opacity from the beginning of animation
  const opacity = 1 - progress; // Fade from 1 to 0 throughout entire animation

  // Apply opacity to all materials in the Goomba model
  player.traverse((child: THREE.Object3D) => {
    if ((child as any).isMesh && (child as any).material) {
      const mesh = child as THREE.Mesh;
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((material: any) => {
          material.transparent = true;
          material.opacity = opacity;
        });
      } else {
        (mesh.material as any).transparent = true;
        (mesh.material as any).opacity = opacity;
      }
    }
  });
};

// Explosion particles array
export const explosionParticles: THREE.Mesh[] = [];

export const createStarExplosion = (scene: THREE.Scene, position: THREE.Vector3, color: number) => {
  const starCount = 12; // Number of stars in explosion

  // Load the star texture
  const textureLoader = new THREE.TextureLoader();
  const starTextureLoaded = textureLoader.load(starTexture);

  for (let i = 0; i < starCount; i++) {
    // Create plane geometry for star texture
    const starGeometry = new THREE.PlaneGeometry(16, 16);

    // Create transparent material with star texture
    const starMaterial = new THREE.MeshBasicMaterial({
      map: starTextureLoaded,
      color: color,
      transparent: true,
      alphaTest: 0.1, // Remove fully transparent pixels
      side: THREE.DoubleSide, // Make star visible from both sides
      opacity: 0.5, // Set initial opacity
    });

    // Create the star mesh
    const star = new THREE.Mesh(starGeometry, starMaterial);

    // Position star at collision point
    star.position.copy(position);

    // Random rotation for variety
    star.rotation.set(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2
    );

    // Random velocity for explosion effect
    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 60, // X velocity
      Math.random() * 40 + 20, // Y velocity (upward bias)
      (Math.random() - 0.5) * 40 // Z velocity
    );

    // Store animation data
    star.userData = {
      velocity,
      gravity: -120, // Gravity effect
      life: 1.0, // Life span (1.0 = full life)
      decay: 0.02, // How fast it decays
      initialScale: 1 + Math.random() * 0.5, // Random initial scale
      rotationSpeed: new THREE.Vector3(
        (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * 0.2
      ),
    };

    star.scale.setScalar(star.userData.initialScale);
    scene.add(star);
    explosionParticles.push(star);
  }
};

export const updateExplosionParticles = (scene: THREE.Scene, deltaTime: number) => {
  for (let i = explosionParticles.length - 1; i >= 0; i--) {
    const particle = explosionParticles[i];
    const userData = particle.userData;

    // Update velocity with gravity
    userData.velocity.y += userData.gravity * deltaTime;

    // Update position
    particle.position.add(userData.velocity.clone().multiplyScalar(deltaTime));

    // Update rotation
    particle.rotation.x += userData.rotationSpeed.x;
    particle.rotation.y += userData.rotationSpeed.y;
    particle.rotation.z += userData.rotationSpeed.z;

    // Update life and scale
    userData.life -= userData.decay;
    const scale = userData.initialScale * userData.life;
    particle.scale.setScalar(Math.max(0, scale));

    // Update opacity based on life
    if (particle.material instanceof THREE.MeshStandardMaterial || particle.material instanceof THREE.MeshBasicMaterial) {
      particle.material.opacity = userData.life;
      particle.material.transparent = true;
    }

    // Remove particle when life is depleted
    if (userData.life <= 0) {
      scene.remove(particle);
      explosionParticles.splice(i, 1);
    }
  }
};

export const checkCollisions = (
  player: THREE.Mesh,
  obstacles: { mesh: THREE.Mesh; characterController: any; collider: any }[],
  backgrounds: any[],
  scene: THREE.Scene,
  endGameCallback: () => void,
  loggedCollisions: Set<string>,
  goombaColor: number
) => {
  const playerPosition = player.position;
  obstacles.forEach((obstacle, index) => {
    const obstaclePosition = obstacle.mesh.position;
    const distance = playerPosition.distanceTo(obstaclePosition);
    if (distance < config.player.collisionThreshold) {
      const collisionKey = `obstacle-${index}-${obstacle.mesh.uuid}`;

      if (!loggedCollisions.has(collisionKey)) {
        loggedCollisions.add(collisionKey);

        // Play game over sound effect
        playAudioFile(gameOverSound);

        // Create explosion at collision point
        const explosionPosition = playerPosition.clone();
        createStarExplosion(scene, explosionPosition, goombaColor);

        // Start arc movement toward camera instead of hiding
        // Pick random direction within camera cone toward camera
        const randomAngle = (Math.random() - 0.5) * Math.PI * 0.8; // Random angle within camera cone
        const randomDistance = 80 + Math.random() * 40; // Reduced animation: 80-120 units (was 120-200)
        const randomHeight = -10 + Math.random() * 5; // Reduced height: -10 to -5 (was -20 to -10)

        player.userData.arcMovement = {
          isActive: true,
          startTime: Date.now(),
          duration: 800, // Shorter animation: reduced from 1200ms to 800ms
          startPosition: playerPosition.clone(),
          targetPosition: new THREE.Vector3(
            playerPosition.x + Math.sin(randomAngle) * 30, // Less dramatic X: reduced from 50 to 30
            playerPosition.y + randomHeight, // Random lower height
            playerPosition.z + Math.cos(randomAngle) * randomDistance // Random Z toward camera
          ),
        };

        // Start background falling animation
        startBackgroundFalling(backgrounds);

        endGameCallback();
      }
    }
  });
};
