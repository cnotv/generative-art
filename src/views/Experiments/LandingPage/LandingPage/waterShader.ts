import * as THREE from 'three';

interface WaterMaterial {
  material: THREE.ShaderMaterial;
  update: (time: number) => void;
}

export const createWaterMaterial = (): WaterMaterial => {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;

      void main() {
        vUv = uv;
        vec3 pos = position;
        pos.z += sin(pos.x * 3.0 + uTime) * 0.05 + sin(pos.y * 2.0 + uTime * 0.7) * 0.05;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;

      void main() {
        float v = sin(vUv.x * 12.0 + uTime) * sin(vUv.y * 8.0 + uTime * 0.6);
        float g = 0.07 + v * 0.04;
        gl_FragColor = vec4(g, g, g, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  });

  const update = (time: number): void => {
    material.uniforms.uTime.value = time;
  };

  return { material, update };
};
