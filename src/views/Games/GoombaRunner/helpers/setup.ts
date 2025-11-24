import * as THREE from "three";
import { RapierPhysics } from "three/addons/physics/RapierPhysics.js";
import { RapierHelper } from "three/addons/helpers/RapierHelper.js";
import { config } from "../config";

export const initPhysics = async (scene: THREE.Scene) => {
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

export const onWindowResize = (camera: THREE.Camera, renderer: THREE.WebGLRenderer) => {
  if (camera instanceof THREE.PerspectiveCamera) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
  renderer.setSize(window.innerWidth, window.innerHeight);
};

export const preventGlitches = (result: ComplexModel, options: any) => {
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

export const addHorizonLine = (scene: THREE.Scene) => {
  // Create a dark grey horizontal bar/line for cartoonish horizon effect
  const horizonGeometry = new THREE.BoxGeometry(4000, 3, 2); // Wide, thin bar
  const horizonMaterial = new THREE.MeshBasicMaterial({
    color: 0x333333, // Dark grey
    transparent: true,
    opacity: 0.8,
  });

  const horizonLine = new THREE.Mesh(horizonGeometry, horizonMaterial);

  // Position the horizon line slightly above the ground level
  horizonLine.position.set(0, 11, -200); // Y=11 for horizon height, Z back a bit for depth
  horizonLine.receiveShadow = false;
  horizonLine.castShadow = false;

  scene.add(horizonLine);
  return horizonLine; // Return the horizon line so we can manipulate it during jumps
};

/**
 * Increase speed based on score (0.1 speed increase per 10 points)
 */
export const getSpeed = (base: number, score: number): number => {
  const speedMultiplier = 1 + score * 0.001;
  const speed = base * speedMultiplier;
  return speed;
};
