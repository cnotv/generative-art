import * as THREE from 'three';
import { CoordinateTuple, Model } from '@webgamekit/animation';
import { getOffset } from './getters';

/**
 * Camera preset configurations for different viewing styles
 */
interface CameraPresetConfig {
  type: 'perspective' | 'orthographic';
  fov?: number;
  position: CoordinateTuple;
  lookAt?: CoordinateTuple;
  near?: number;
  far?: number;
  frustumSize?: number;
  verticalOffset?: number;
}

/**
 * Enum for camera preset keys
 */
export enum CameraPreset {
  Perspective = 'perspective',
  Fisheye = 'fisheye',
  Cinematic = 'cinematic',
  Orbit = 'orbit',
  Orthographic = 'orthographic',
  OrthographicFollowing = 'orthographic-following',
  TopDown = 'top-down',
}

export enum CameraSide {
  CameraLeft = 'camera-left',
  CameraRight = 'camera-right',
  CameraUp = 'camera-up',
  CameraDown = 'camera-down',
}

/**
 * Dictionary of predefined camera presets for common use cases
 */
export const cameraPresets: Record<CameraPreset, CameraPresetConfig> = {
  [CameraPreset.Perspective]: {
    type: 'perspective',
    fov: 75,
    position: [0, 5, 20],
    near: 0.1,
    far: 1000,
  },
  [CameraPreset.Fisheye]: {
    type: 'perspective',
    fov: 120,
    position: [0, 5, 20],
    near: 0.1,
    far: 1000,
  },
  [CameraPreset.Cinematic]: {
    type: 'perspective',
    fov: 35,
    position: [0, 5, 20],
    near: 0.1,
    far: 1000,
  },
  [CameraPreset.Orbit]: {
    type: 'perspective',
    fov: 75,
    position: [0, 10, 15],
    near: 0.1,
    far: 1000,
  },
  [CameraPreset.Orthographic]: {
    type: 'orthographic',
    position: [10, 12, 10],
    lookAt: [0, -15, 0],
    frustumSize: 40,
    verticalOffset: 15,
    near: 0.1,
    far: 1000,
  },
  [CameraPreset.OrthographicFollowing]: {
    type: 'orthographic',
    position: [0, 5, 20],
    frustumSize: 30,
    verticalOffset: 10,
    near: 0.1,
    far: 1000,
  },
  [CameraPreset.TopDown]: {
    type: 'orthographic',
    position: [0, 50, 0],
    lookAt: [0, 0, 0],
    frustumSize: 50,
    verticalOffset: 0,
    near: 0.1,
    far: 1000,
  },
};

export const getLookAt = (model: Model, config: any) => {
  const { x, y, z } = config.lookAt;
  const lookAt = new THREE.Vector3(x, y, z);
  lookAt.applyQuaternion(model.quaternion);
  lookAt.add(model.position);
  return lookAt;
};

/**
 * Apply a predefined camera preset to an existing camera
 * @param camera - The Three.js camera to configure (PerspectiveCamera or OrthographicCamera)
 * @param presetName - Name of the preset from cameraPresets dictionary
 * @param aspect - Optional aspect ratio (defaults to current window aspect ratio)
 * @returns The configured camera, or null if preset not found
 */
export const setCameraPreset = (
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  presetName: CameraPreset,
  aspect: number = 16 / 9
): THREE.Camera | null => {
  const preset = cameraPresets[presetName];
  
  if (!preset) {
    console.warn(`Camera preset "${presetName}" not found. Available presets: ${Object.keys(cameraPresets).join(', ')}`);
    return null;
  }

  const isPerspective = preset.type === 'perspective';
  const isOrthographic = preset.type === 'orthographic';
  const frustumSize = preset.frustumSize ?? 40;
  const verticalOffset = preset.verticalOffset || 15;
  const lookAt = preset.lookAt || [0, 0, 0];

  if (isPerspective && camera instanceof THREE.PerspectiveCamera) {
    camera.position.set(...preset.position);
    camera.aspect = aspect;
    if (preset.fov !== undefined) camera.fov = preset.fov;
  } else if (isOrthographic && camera instanceof THREE.OrthographicCamera) {
    camera.left = (frustumSize * aspect) / -2;
    camera.right = (frustumSize * aspect) / 2;
    camera.top = frustumSize / 2 + verticalOffset;
    camera.bottom = frustumSize / -2 + verticalOffset;
  }
  camera.lookAt(new THREE.Vector3(...lookAt));
  camera.updateProjectionMatrix();

  return camera;
};

export const setCameraSide = (camera: THREE.PerspectiveCamera, {x, y, z}: THREE.Vector3, value: CameraSide) => {
  x = 0; y = 0; z = 0;
  if (value === CameraSide.CameraDown) {
    y += 5; z += 20;
  } else if (value === CameraSide.CameraUp) {
    y += 5;
  } else if (value === CameraSide.CameraLeft) {
    x -= 15; y += 5;
  } else if (value === CameraSide.CameraRight) {
    x += 15; y += 5;
  }
  camera.position.set(x, y, z);
  camera.lookAt(x, y, z);
};

/**
 * Set given camera to third person view
 * @param camera 
 * @param config 
 * @param model 
 */
export const setThirdPersonCamera = (
  camera: THREE.PerspectiveCamera,
  config: any,
  model: Model | null
) => {
  if (model) {
    const offset = getOffset(model, config);
    const lookAt = getLookAt(model, config);
    camera.position.copy(offset);
    camera.lookAt(lookAt);
  }
};

/**
 * Make camera follow a player/model by updating camera position with offset
 * @param camera - The Three.js camera to update
 * @param player - The player model to follow
 * @param offset - Camera offset from player [x, y, z]
 * @returns Updated camera position as CoordinateTuple
 */
export const cameraFollowPlayer = (
  camera: THREE.Camera,
  player: Model,
  offset: CoordinateTuple,
  coordinates: ('x' | 'y' | 'z')[] = ['x', 'y', 'z']
): CoordinateTuple => {
  if (coordinates.includes('x')) camera.position.x = player.position.x + offset[0];
  if (coordinates.includes('y')) camera.position.y = player.position.y + offset[1];
  if (coordinates.includes('z')) camera.position.z = player.position.z + offset[2];
  
  return [camera.position.x, camera.position.y, camera.position.z];
};

/**
 * Smoothly tilt the camera for dynamic effects like jump reactions
 * @param camera - The Three.js camera to tilt
 * @param targetTilt - Target tilt angle in radians (positive = tilt up, negative = tilt down)
 * @param lerpFactor - Smoothing factor (0-1, higher = faster transition)
 */
export const tiltCamera = (camera: THREE.Camera, targetTilt: number, lerpFactor: number = 0.1) => {
  if (!camera.userData.originalRotation) {
    camera.userData.originalRotation = {
      x: camera.rotation.x,
      y: camera.rotation.y,
      z: camera.rotation.z
    };
  }

  const currentTilt = camera.rotation.x - camera.userData.originalRotation.x;
  const tiltDifference = targetTilt - currentTilt;
  const newTilt = currentTilt + tiltDifference * lerpFactor;
  
  camera.rotation.x = camera.userData.originalRotation.x + newTilt;
};
