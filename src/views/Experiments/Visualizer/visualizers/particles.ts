import * as THREE from "three";
import { getAudioData, getFrequencyRanges } from "../audio";
import type { VisualizerSetup } from ".";

export const particlesVisualizer: VisualizerSetup = {
  name: "Particles",
  
  setup: (scene: THREE.Scene) => {
    const particleCount = 1000;
    const geometry = new THREE.BufferGeometry();
    
    // Create particle positions
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      
      // Position particles in a sphere
      const radius = Math.random() * 50;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      
      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.cos(phi);
      positions[i3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
      
      // Random colors
      colors[i3] = Math.random();
      colors[i3 + 1] = Math.random();
      colors[i3 + 2] = Math.random();
      
      // Random sizes
      sizes[i] = Math.random() * 2 + 1;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        audioLevel: { value: 0 },
        bassLevel: { value: 0 },
        midLevel: { value: 0 },
        trebleLevel: { value: 0 }
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        uniform float time;
        uniform float audioLevel;
        uniform float bassLevel;
        
        void main() {
          vColor = color;
          
          vec3 pos = position;
          
          // Audio-reactive movement
          float distance = length(pos);
          pos += normalize(pos) * sin(time * 2.0 + distance * 0.1) * audioLevel * 5.0;
          
          // Bass-reactive pulsing
          pos += normalize(pos) * bassLevel * 10.0;
          
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          
          // Audio-reactive size
          gl_PointSize = size * (1.0 + audioLevel * 3.0) * (300.0 / -mvPosition.z);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        uniform float midLevel;
        uniform float trebleLevel;
        
        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float distance = length(uv);
          
          if (distance > 0.5) discard;
          
          // Create glowing effect
          float alpha = 1.0 - smoothstep(0.2, 0.5, distance);
          
          // Audio-reactive intensity
          vec3 finalColor = vColor * (1.0 + midLevel * 2.0);
          finalColor += vec3(trebleLevel) * 0.5;
          
          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending
    });
    
    const particles = new THREE.Points(geometry, material);
    scene.add(particles);
    
    return { 
      particles, 
      material, 
      geometry,
    };
  },

  animate: (objects) => {
    const audioData = getAudioData();
    const frequencyRanges = getFrequencyRanges();
    const time = Date.now() * 0.001;
    
    // Calculate average audio level
    const audioLevel = audioData.reduce((sum, val) => sum + val, 0) / audioData.length;
    
    // Update shader uniforms
    objects.material.uniforms.time.value = time;
    objects.material.uniforms.audioLevel.value = audioLevel;
    objects.material.uniforms.bassLevel.value = frequencyRanges.bass;
    objects.material.uniforms.midLevel.value = frequencyRanges.mid;
    objects.material.uniforms.trebleLevel.value = frequencyRanges.treble;
    
    // Rotate the particle system
    objects.particles.rotation.y = time * 0.1;
    objects.particles.rotation.x = Math.sin(time * 0.05) * 0.2;
  }
};
