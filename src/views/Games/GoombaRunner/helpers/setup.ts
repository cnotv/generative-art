import * as THREE from "three";
import { RapierPhysics } from "three/addons/physics/RapierPhysics.js";
import { RapierHelper } from "three/addons/helpers/RapierHelper.js";
import { config } from "../config";

const initPhysics = async (scene: THREE.Scene) => {
  //Initialize physics engine using the script in the jsm/physics folder
  const physics = await RapierPhysics();

  //Optionally display collider outlines
  const physicsHelper = new RapierHelper(physics.world);
  if (config.game.helper) {
    scene.add(physicsHelper); // Enable helper to show colliders
  }

  physics.addScene(scene);

  return { physics, physicsHelper };
};

const preventGlitches = (result: ComplexModel, options: any) => {
  // Fix texture opacity glitches during camera rotation
  if (result.mesh && options.opacity < 1) {
    // Set render order based on depth - farther elements render first
    result.mesh.renderOrder = Math.abs(options.zPosition) / 10;

    // Adjust material properties to prevent Z-fighting
    if (result.mesh.material instanceof THREE.MeshBasicMaterial) {
      result.mesh.material.depthTest = true;
      result.mesh.material.depthWrite = options.opacity >= 0.9; // Only write to depth if mostly opaque
      result.mesh.material.alphaTest = 0.01; // Discard very transparent pixels
    }
  }
};

/**
 * Increase speed based on score (0.1 speed increase per 10 points)
 */
const getSpeed = (base: number, score: number): number => {
  const speedMultiplier = 1 + score * 0.001;
  const speed = base * speedMultiplier;
  return speed;
};

const prevents = () => {
  // Prevent iOS zoom and selection behaviors
  const preventZoomAndSelection = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Additional iOS-specific prevention
  [
    "gesturestart",
    "gesturechange",
    "gestureend",
    "selectstart",
    "contextmenu",
  ].forEach((event) => {
    document.addEventListener(event, preventZoomAndSelection, {
      passive: false,
    });
  });

  // Prevent double-tap zoom
  let lastTouchEnd = 0;
  document.addEventListener(
    "touchend",
    (event) => {
      const now = new Date().getTime();
      if (now - lastTouchEnd <= 300) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    },
    { passive: false }
  );
};

export {
  initPhysics,
  preventGlitches,
  getSpeed,
  prevents,
};
