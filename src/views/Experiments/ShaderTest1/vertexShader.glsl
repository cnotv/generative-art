varying vec2 vUv;
uniform float uTime;
uniform vec2 uFrequency;
varying float vElevation;

void main() {
  // Basic
  // gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
  
  // Flag static
  // vec4 modelPosition = modelMatrix * vec4(position, 1.0);
  // modelPosition.z += sin(modelPosition.x) * 20.0;

  // Waves static
  // vec4 modelPosition = modelMatrix * vec4(position, 1.0);
  // modelPosition.z += sin(modelPosition.x * uFrequency.x) * 20.0;  
  // modelPosition.z += sin(modelPosition.y * uFrequency.y * 0.01) * 20.0;  
  
  // Waves animation
  vec4 modelPosition = modelMatrix * vec4(position, 1.0);
  float elevation = sin(modelPosition.x * uFrequency.x + uTime) * 10.0;  
  elevation += sin(modelPosition.y * uFrequency.y * 0.01 + uTime) * 10.0;  
  
  modelPosition.z += elevation;

  // Final computation
  vec4 viewPosition = viewMatrix * modelPosition;
  vec4 projectedPosition = projectionMatrix * viewPosition;

  gl_Position = projectedPosition;

  vUv = uv;
  vElevation = elevation;
}