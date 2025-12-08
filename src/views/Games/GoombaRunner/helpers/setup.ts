import * as THREE from "three";
import { RapierPhysics } from "three/addons/physics/RapierPhysics.js";
import { RapierHelper } from "three/addons/helpers/RapierHelper.js";
import { config } from "../config";

/**
 * Initialize game data with default values
 * This function is called by the game state initialization
 */
const initGameData = (setData: (key: string, value: any) => void) => {
  setData("score", 0);
  setData("highestScore", 0);
  setData("isNewHighScore", false);
};

/**
 * Load high score from localStorage
 */
const loadHighScore = (
  getData: <T = any>(key: string, defaultValue?: T) => T,
  setData: (key: string, value: any) => void,
  highScoreKey = "goomba-runner-high-score"
): number => {
  const saved = localStorage.getItem(highScoreKey);
  const parsed = saved ? parseInt(saved, 10) : 0;
  const highScore = isNaN(parsed) ? 0 : parsed;
  setData("highestScore", highScore);
  return highScore;
};

/**
 * Check if current score is a new high score and save it
 */
const checkHighScore = (
  getData: <T = any>(key: string, defaultValue?: T) => T,
  setData: (key: string, value: any) => void,
  highScoreKey = "goomba-runner-high-score"
): boolean => {
  const currentScore = getData("score", 0);
  const highestScore = getData("highestScore", 0);
  const isNewHighScore = currentScore > highestScore;

  setData("isNewHighScore", isNewHighScore);
  if (isNewHighScore) {
    localStorage.setItem(highScoreKey, currentScore.toString());
    setData("highestScore", currentScore);
  }
  return isNewHighScore;
};

/**
 * Increment the game score by specified points
 */
const incrementGameScore = (
  getData: <T = any>(key: string, defaultValue?: T) => T,
  setData: (key: string, value: any) => void,
  points: number
): void => {
  if (!isNaN(points)) {
    const currentScore = getData("score", 0);
    setData("score", currentScore + points);
  }
};

/**
 * Get the current game score
 */
const getGameScore = (
  getData: <T = any>(key: string, defaultValue?: T) => T
): number => getData("score", 0);

/**
 * Get the highest score achieved
 */
const getHighestScore = (
  getData: <T = any>(key: string, defaultValue?: T) => T
): number => getData("highestScore", 0);

/**
 * Check if the current score is a new high score
 */
const getIsNewHighScore = (
  getData: <T = any>(key: string, defaultValue?: T) => T
): boolean => getData("isNewHighScore", false);

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
  initGameData,
  loadHighScore,
  checkHighScore,
  incrementGameScore,
  getGameScore,
  getHighestScore,
  getIsNewHighScore,
  initPhysics,
  preventGlitches,
  getSpeed,
  prevents,
};
