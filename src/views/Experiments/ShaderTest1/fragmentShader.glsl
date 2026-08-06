varying float vElevation;

void main() {
  vec3 color = vec3(0.3, 0.3, 0.3);
  color.rgb += vElevation * 0.01;

  gl_FragColor = vec4(color, 1.0);
}