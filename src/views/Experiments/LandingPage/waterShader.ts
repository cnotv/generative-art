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
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;

      void main() {
        float g = 0.04 + abs(sin((vUv.y + sin(vUv.x * 6.0) * 0.1) * 20.0 - uTime * 2.0)) * 0.09;
        gl_FragColor = vec4(g, g, g, 0.5);
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
  });

  const update = (time: number): void => {
    material.uniforms.uTime.value = time;
  };

  return { material, update };
};
