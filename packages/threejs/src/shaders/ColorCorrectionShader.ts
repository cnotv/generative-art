// ColorCorrectionShader.js
// Based on https://github.com/mrdoob/three.js/blob/master/examples/jsm/shaders/ColorCorrectionShader.js

export const ColorCorrectionShader = {
  uniforms: {
    'tDiffuse': { value: null },
    'powRGB': { value: [1.4, 1.45, 1.45] }, // contrast, saturation, brightness
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
    uniform vec3 powRGB;
    varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      texel.rgb = pow(texel.rgb, powRGB);
      gl_FragColor = texel;
    }
  `
};
