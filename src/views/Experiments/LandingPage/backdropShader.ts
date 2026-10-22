/**
 * The page backdrop behind the skills city and the market: a topographic map of the ground the
 * city stands on, drawn in dots like the lines to the market. The ground is a slowly drifting,
 * domain-warped noise field; the screen is a grid of dot cells, and a cell shows its dot when a
 * contour passes through it, so every contour is a single row of dots wherever the ground is. Every fifth contour has larger dots, as on a survey map, and the
 * higher ground glows faintly.
 */
export const BACKDROP_VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

export const BACKDROP_FRAGMENT_SHADER = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uScroll;
uniform float uPixelRatio;
uniform vec2 uResolution;
uniform float uScale;
uniform float uLevels;
uniform float uDotSpacing;
uniform float uDotRadius;
uniform vec3 uBase;
uniform vec3 uLine;
uniform vec3 uGlow;

varying vec2 vUv;

float hash(vec2 point) {
  return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 point) {
  vec2 cell = floor(point);
  vec2 local = fract(point);
  vec2 blend = local * local * (3.0 - 2.0 * local);
  return mix(
    mix(hash(cell), hash(cell + vec2(1.0, 0.0)), blend.x),
    mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0, 1.0)), blend.x),
    blend.y
  );
}

float fbm(vec2 point) {
  float total = 0.0;
  float amplitude = 0.5;
  for (int octave = 0; octave < 5; octave++) {
    total += amplitude * noise(point);
    point = point * 2.03 + vec2(1.7, 9.2);
    amplitude *= 0.5;
  }
  return total;
}

void main() {
  // Page pixels from the top of the content, so the map scrolls with the page.
  vec2 page = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y) / uPixelRatio;
  page.y += uScroll;
  vec2 centre = (floor(page / uDotSpacing) + 0.5) * uDotSpacing;
  vec2 point = page / uScale;

  float drift = uTime * 0.025;
  vec2 warp = vec2(fbm(point + vec2(drift, 0.0)), fbm(point + vec2(5.2, 1.3) - drift));
  float height = fbm(point + warp * 1.6);

  float level = height * uLevels;
  // Distance to the nearest contour in screen pixels: a dot shows when that is under half a
  // cell, which keeps contours one dot wide whether the ground is steep or flat.
  float pixelsOffLine = min(fract(level), 1.0 - fract(level)) / fwidth(level) / uPixelRatio;
  float onLine = 1.0 - smoothstep(uDotSpacing * 0.4, uDotSpacing * 0.5, pixelsOffLine);
  float major = 1.0 - step(0.5, mod(floor(level + 0.5), 5.0));
  float radius = uDotRadius * (1.0 + 0.6 * major);
  float dotShape = 1.0 - smoothstep(radius - 0.75, radius + 0.75, length(page - centre));

  float edges = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
  vec3 color = mix(uBase, uGlow, smoothstep(0.5, 0.85, height) * 0.5);
  color += uLine * onLine * dotShape * (0.5 + 0.5 * major) * mix(0.45, 1.0, edges);
  gl_FragColor = vec4(color, 1.0);
  // The colours arrive in linear space; this turns them back into the screen's.
  #include <colorspace_fragment>
}
`
