import * as THREE from 'three';

export const toggleObjectVisibility = (object: THREE.Object3D): void => {
  object.visible = !object.visible;
};

export const updateCameraFov = (camera: THREE.PerspectiveCamera, fov: number): void => {
  camera.fov = fov;
  camera.updateProjectionMatrix();
};

export const replaceGeometry = (mesh: { geometry: THREE.BufferGeometry }, geometry: THREE.BufferGeometry): void => {
  mesh.geometry.dispose();
  mesh.geometry = geometry;
};
