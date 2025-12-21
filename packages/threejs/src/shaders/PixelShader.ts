// Simple pixelation shader
export const PixelShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: [window.innerWidth, window.innerHeight] },
    size: { value: 6.0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float size;
    varying vec2 vUv;
    void main() {
      vec2 dxy = size / resolution;
      vec2 coord = dxy * floor(vUv * resolution / size);
      gl_FragColor = texture2D(tDiffuse, coord);
    }
  `
};
