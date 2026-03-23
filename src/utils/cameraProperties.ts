import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Ref } from 'vue';
import { ref } from 'vue';
import { cameraSchema } from '@/views/Tools/SceneEditor/config';
import { useElementPropertiesStore } from '@/stores/elementProperties';
import { updateCameraFov, setOrbitEnabled } from '@/utils/threeObjectUpdaters';
import { getNestedValue, setNestedValueImmutable } from '@/utils/nestedObjects';

type Vec3 = { x: number; y: number; z: number };
interface RegisterCameraOptions {
  camera: THREE.Camera;
  orbit?: OrbitControls | null;
  cameraConfig?: Ref<Record<string, unknown>>;
  skipOrbitSync?: boolean;
  schema?: Record<string, unknown>;
}

/**
 * Registers camera element properties with orbit sync.
 * Handles: schema-based property panel, Three.js updates on change,
 * and orbit controls → panel reactivity.
 *
 * @param options.camera - The Three.js PerspectiveCamera
 * @param options.orbit - Optional orbit controls instance
 * @param options.cameraConfig - Optional external ref to use for camera state.
 *   If not provided, creates an internal one from current camera/orbit values.
 * @returns The cameraConfig ref (same as passed in, or newly created)
 */
export const registerCameraProperties = ({ camera, orbit, cameraConfig: externalConfig, skipOrbitSync, schema }: RegisterCameraOptions) => {
  const elementPropertiesStore = useElementPropertiesStore();

  const cameraConfig = externalConfig ?? ref<Record<string, unknown>>({
    position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
    fov: (camera as THREE.PerspectiveCamera).fov,
    orbitTarget: orbit
      ? { x: orbit.target.x, y: orbit.target.y, z: orbit.target.z }
      : { x: 0, y: 0, z: 0 },
    orbitEnabled: orbit?.enabled ?? false,
  });

  const applyCameraUpdate = (path: string, value: unknown) => {
    if (path === 'fov' && camera instanceof THREE.PerspectiveCamera) {
      updateCameraFov(camera, value as number);
    } else if (path === 'position') {
      const pos = value as Vec3;
      camera.position.set(pos.x, pos.y, pos.z);
    } else if (path === 'orbitTarget' && orbit) {
      const target = value as Vec3;
      orbit.target.set(target.x, target.y, target.z);
      orbit.update();
    } else if (path === 'orbitEnabled' && orbit) {
      setOrbitEnabled(orbit, value as boolean);
    }
  };

  elementPropertiesStore.registerElementProperties('Camera', {
    title: 'Camera',
    type: 'camera',
    schema: schema ?? cameraSchema,
    getValue: (path) => getNestedValue(cameraConfig.value, path),
    updateValue: (path, value) => {
      cameraConfig.value = setNestedValueImmutable(cameraConfig.value, path, value);
      applyCameraUpdate(path, value);
    },
  });

  // Sync orbit controls → camera config when orbit changes
  if (orbit && !skipOrbitSync) {
    orbit.addEventListener('change', () => {
      cameraConfig.value = {
        ...cameraConfig.value,
        position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        orbitTarget: { x: orbit.target.x, y: orbit.target.y, z: orbit.target.z },
      };
    });
  }

  return { cameraConfig };
};
