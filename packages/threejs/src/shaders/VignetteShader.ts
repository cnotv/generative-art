// VignetteShader.js
// Based on https://github.com/evanw/glfx.js/blob/master/src/filters/adjust/vignette.js

export const VignetteShader = {
  uniforms: {
    'tDiffuse': { value: null },
    'offset': { value: 1.1 },
    'darkness': { value: 1.2 },
    'vignetteColor': { value: [0, 0, 0] }, // RGB array, default black
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
    uniform float offset;
    uniform float darkness;
    uniform vec3 vignetteColor;
    varying vec2 vUv;
    void main() {
      // Calculate distance from center
      vec2 position = vUv - vec2(0.5);
      float len = length(position);
      // Vignette factor
      float vignette = smoothstep(offset, offset - darkness, len);
      vec4 texel = texture2D(tDiffuse, vUv);
      // Blend vignette color
      texel.rgb = mix(texel.rgb, vignetteColor, vignette);
      gl_FragColor = texel;
    }
  `
};
