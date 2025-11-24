import * as THREE from "three";
import { createZigzagTexture } from "@/utils/threeJs";

export const getGround = (scene: THREE.Scene, physics?: any) => {
  const geometry = new THREE.BoxGeometry(2000, 0.5, 2000);

  // Create zigzag pattern texture with custom parameters
  const texture = createZigzagTexture({
    size: 128,
    backgroundColor: "#60af2c", // Slightly different green
    zigzagColor: "#ffff44", // Darker green for primary zigzag
    zigzagHeight: 100, // Taller zigzag amplitude
    zigzagWidth: 32, // Wider zigzag segments
    primaryThickness: 2, // Thicker primary line
    repeatX: 30, // Less repetition for larger pattern
    repeatY: 30,
  });

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color: 0x68b469, // Use white to show natural texture colors
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;

  // Position ground at y = 0, with the top surface at y = 0.25
  mesh.position.y = 0;
  mesh.userData.physics = { mass: 0 };

  if (physics) {
    physics.addMesh(mesh);
  }
  scene.add(mesh);

  return texture;
};
