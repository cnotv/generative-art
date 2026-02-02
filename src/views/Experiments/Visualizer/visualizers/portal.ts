import * as THREE from "three";
import { getAudioData, getFrequencyBands, getAudioSource } from "../audio";
import type { VisualizerSetup } from "../visualizer";

const config = {
  channelCount: 32,
  torusRadius: 5.6,
  tubeRadius: 0.3,
  maxDeformation: 2,
  emissiveIntensity: 1.5,
  metalness: 0.1,
  roughness: 0.1,
  segments: 64,
  ringSpacing: 4,
  frequencyBands: {
    low: { start: 0, end: 10, color: 0x62c1e5, position: 0, brightness: 1.5, effectIntensity: 0.8 },
    mid: { start: 11, end: 21, color: 0x62c1e5, position: 0, brightness: 1.0, effectIntensity: 1.2 },
    high: { start: 22, end: 31, color: 0x62c1e5, position: 0, brightness: 0.6, effectIntensity: 3 }
  },
  sourceMultiplier: {
    song: 0.4,
    mic: 1.6
  }
};

const WAVE_CONFIGS = {
  low: [
    { freq: 2, speed: 1, multiply: 8, amplitude: 0.8, useU: true },
    { freq: 3, speed: 0.8, multiply: 0, amplitude: 0.5, useU: true, vMult: 4 },
    { freq: 6, speed: 1.2, multiply: 6, amplitude: 0.6, useU: false }
  ],
  mid: [
    { freq: 3, speed: 1.5, multiply: 10, amplitude: 0.6, useU: true },
    { freq: 4, speed: 1.2, multiply: 0, amplitude: 0.4, useU: true, vMult: 6 },
    { freq: 8, speed: 2, multiply: 8, amplitude: 0.5, useU: false }
  ],
  high: [
    { freq: 4, speed: 2.5, multiply: 12, amplitude: 0.4, useU: true },
    { freq: 6, speed: 2, multiply: 0, amplitude: 0.3, useU: true, vMult: 10 },
    { freq: 15, speed: 3, multiply: 10, amplitude: 0.3, useU: false }
  ]
};

/**
 * Calculates 3D coordinates for a torus given parametric coordinates u and v
 * @param u - Angle around the tube (0 to 2π)
 * @param v - Angle around the torus (0 to 2π)
 * @returns Object with x, y, z coordinates
 */
const calculateTorusCoordinates = (u: number, v: number): { x: number; y: number; z: number } => {
  const x = (config.torusRadius + config.tubeRadius * Math.cos(v)) * Math.cos(u);
  const y = (config.torusRadius + config.tubeRadius * Math.cos(v)) * Math.sin(u);
  const z = config.tubeRadius * Math.sin(v);
  return { x, y, z };
};

/**
 * Gets the audio value for a specific position on the torus based on angle
 * Maps the position angle to a frequency band index and returns the corresponding audio value
 * @param audioData - Array of audio frequency data
 * @param x - X coordinate of the position
 * @param y - Y coordinate of the position
 * @param band - Frequency band configuration (start, end, color, etc.)
 * @returns Audio value at that position (0-1)
 */
const getAudioValueForPosition = (
  audioData: number[], 
  x: number, 
  y: number, 
  band: typeof config.frequencyBands.low
): number => {
  const angle = Math.atan2(y, x);
  const normalizedAngle = (angle + Math.PI) / (2 * Math.PI);
  const bandRange = band.end - band.start + 1;
  const bandIndex = Math.floor(normalizedAngle * bandRange) + band.start;
  return audioData[Math.min(bandIndex, audioData.length - 1)] || 0;
};

/**
 * Calculates wave-based deformation for the torus geometry
 * Creates complex wave patterns using multiple sine/cosine functions with different frequencies
 * @param u - Parametric coordinate u
 * @param v - Parametric coordinate v
 * @param time - Current time for animation
 * @param audioValue - Audio intensity value
 * @param bandType - Type of frequency band (low, mid, high)
 * @returns Combined wave deformation value
 */
const calculateWaveDeformation = (
  u: number, 
  v: number, 
  time: number, 
  audioValue: number, 
  bandType: 'low' | 'mid' | 'high'
): number => {
  const waves = WAVE_CONFIGS[bandType].map((config, index) => {
    const baseFreq = config.useU ? u * config.freq : v * config.freq;
    const timeComponent = time * config.speed;
    const audioComponent = audioValue * config.multiply;
    const vComponent = config.vMult ? v * config.vMult : 0;
    const waveFunction = index === 2 ? Math.cos : Math.sin;
    return waveFunction(baseFreq + timeComponent + audioComponent + vComponent) * audioValue * config.amplitude;
  });
  return waves.reduce((sum, wave) => sum + wave, 0);
};

/**
 * Applies radial displacement to vertex positions based on wave deformation
 * Displaces vertices outward from the center based on audio-reactive wave intensity
 * @param x - Original X coordinate
 * @param y - Original Y coordinate
 * @param z - Original Z coordinate
 * @param totalWave - Combined wave deformation value
 * @param bandValue - Audio band intensity value
 * @param band - Frequency band configuration
 * @returns New displaced coordinates
 */
const applyDisplacement = (
  x: number, 
  y: number, 
  z: number, 
  totalWave: number, 
  bandValue: number, 
  band: typeof config.frequencyBands.low
): { x: number; y: number; z: number } => {
  const angle = Math.atan2(y, x);
  const intensity = bandValue * config.maxDeformation * band.effectIntensity;
  const displaceX = Math.cos(angle) * totalWave * intensity;
  const displaceY = Math.sin(angle) * totalWave * intensity;
  const displaceZ = totalWave * intensity * 0.8;
  return {
    x: x + displaceX,
    y: y + displaceY,
    z: z + displaceZ
  };
};

/**
 * Applies a spiral twist effect to vertex positions
 * Creates a dynamic twisting motion based on audio intensity and position
 * @param x - X coordinate to twist
 * @param y - Y coordinate to twist
 * @param audioValue - Audio intensity for twist amount
 * @param tubularPosition - Position along the tube for twist variation
 * @returns New twisted X and Y coordinates
 */
const applySpiralTwist = (
  x: number, 
  y: number, 
  audioValue: number, 
  tubularPosition: number
): { x: number; y: number } => {
  const radialDistance = Math.hypot(x, y);
  const angle = Math.atan2(y, x);
  const twist = audioValue * Math.PI * 0.3;
  const twistedAngle = angle + twist * (tubularPosition / Math.PI);
  return {
    x: radialDistance * Math.cos(twistedAngle),
    y: radialDistance * Math.sin(twistedAngle)
  };
};

/**
 * Generates triangle indices for torus geometry
 * Creates the index buffer that defines how vertices connect to form triangles
 * @param radialSegments - Number of segments around the ring
 * @param tubularSegments - Number of segments around the tube
 * @returns Array of indices for triangle rendering
 */
const generateTorusIndices = (radialSegments: number, tubularSegments: number): number[] => {
  const indices: number[] = [];
  for (let index = 1; index <= radialSegments; index++) {
    for (let i = 1; i <= tubularSegments; i++) {
      const a = (tubularSegments + 1) * index + i - 1;
      const b = (tubularSegments + 1) * (index - 1) + i - 1;
      const c = (tubularSegments + 1) * (index - 1) + i;
      const d = (tubularSegments + 1) * index + i;
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }
  return indices;
};

/**
 * Creates audio-reactive torus geometry for a specific frequency band
 * Generates a complete BufferGeometry with deformed vertices based on audio data
 * @param audioData - Array of audio frequency data
 * @param time - Current time for animation
 * @param bandType - Type of frequency band (low, mid, high)
 * @param bandValue - Intensity value for this frequency band
 * @returns Three.js BufferGeometry with audio-reactive deformations
 */
const createFrequencyBandTorusGeometry = (
  audioData: number[], 
  time: number, 
  bandType: 'low' | 'mid' | 'high',
  bandValue: number
): THREE.BufferGeometry => {
  const geometry = new THREE.BufferGeometry();
  const band = config.frequencyBands[bandType];
  const radialSegments = 16;
  const tubularSegments = config.segments;
  const vertices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  for (let index = 0; index <= radialSegments; index++) {
    for (let i = 0; i <= tubularSegments; i++) {
      const u = (i / tubularSegments) * Math.PI * 2;
      const v = (index / radialSegments) * Math.PI * 2;
      const basePos = calculateTorusCoordinates(u, v);
      const audioValue = getAudioValueForPosition(audioData, basePos.x, basePos.y, band);
      const totalWave = calculateWaveDeformation(u, v, time, audioValue, bandType);
      const displaced = applyDisplacement(basePos.x, basePos.y, basePos.z, totalWave, bandValue, band);
      const twisted = applySpiralTwist(displaced.x, displaced.y, audioValue, v);
      vertices.push(twisted.x, twisted.y, displaced.z);
      const normal = new THREE.Vector3(basePos.x, basePos.y, basePos.z).normalize();
      normals.push(normal.x, normal.y, normal.z);
      uvs.push(i / tubularSegments, index / radialSegments);
    }
  }

  const indices = generateTorusIndices(radialSegments, tubularSegments);
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
};

/**
 * Creates background elements like planes for scene depth and atmosphere
 * Adds geometric elements that react to audio and provide visual context
 * @param scene - Three.js scene to add background elements to
 * @returns Array of background mesh elements
 */
const createBackgroundElements = (scene: THREE.Scene): THREE.Mesh[] => {
  const backgroundElements: THREE.Mesh[] = [];
  const planeGeometry = new THREE.PlaneGeometry(300, 300);
  const planeMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xa0d9ef,
    transmission: 0.6,
    roughness: 0,
    opacity: 1,
    metalness: 0.7,
    reflectivity: 2,
  });
  const backPlane = new THREE.Mesh(planeGeometry, planeMaterial);
  backPlane.position.set(0, 0, -5);
  scene.add(backPlane);
  backgroundElements.push(backPlane);
  return backgroundElements;
};

/**
 * Creates a material for a specific frequency band with appropriate colors and properties
 * Sets up transparent, emissive materials that react to audio
 * @param bandConfig - Configuration for the frequency band (color, brightness, etc.)
 * @returns Three.js MeshStandardMaterial configured for the band
 */
const createFrequencyBandMaterial = (bandConfig: typeof config.frequencyBands.low): THREE.MeshStandardMaterial => {
  return new THREE.MeshStandardMaterial({
    color: bandConfig.color,
    emissive: new THREE.Color(bandConfig.color).multiplyScalar(0.1),
    emissiveIntensity: config.emissiveIntensity,
    metalness: config.metalness,
    roughness: config.roughness,
    transparent: true,
    opacity: 0.5,
  });
};

/**
 * Processes audio data and applies source-specific multipliers
 * Gets frequency band data and adjusts intensity based on audio source type
 * @returns Object with processed low, mid, and high frequency values
 */
const getProcessedAudioBands = (): { [key: string]: number } => {
  const source = getAudioSource();
  const sourceMultiplier = source === 'song' ? config.sourceMultiplier.song : config.sourceMultiplier.mic;
  const bands = getFrequencyBands(config.frequencyBands);
  
  return {
    low: bands.low * sourceMultiplier,
    mid: bands.mid * sourceMultiplier,
    high: bands.high * sourceMultiplier
  };
};

/**
 * Updates a frequency band ring's geometry, scaling, and material properties
 * Recreates geometry with audio-reactive deformations and updates visual properties
 * @param ring - Three.js mesh representing the frequency band ring
 * @param material - Material to update with new colors and properties
 * @param bandType - Type of frequency band (low, mid, high)
 * @param bandValue - Current audio intensity for this band
 * @param bandConfig - Configuration for this frequency band
 * @param audioData - Array of audio frequency data
 * @param time - Current time for animation
 */
const updateRing = (
  ring: THREE.Mesh,
  material: THREE.MeshStandardMaterial,
  bandType: 'low' | 'mid' | 'high',
  bandValue: number,
  bandConfig: typeof config.frequencyBands.low,
  audioData: number[],
  time: number
): void => {
  const newGeometry = createFrequencyBandTorusGeometry(audioData, time, bandType, bandValue);
  if (ring.geometry) {
    ring.geometry.dispose();
  }
  ring.geometry = newGeometry;
  const scale = 1 + bandValue * 0.5;
  ring.scale.set(scale, scale, scale);
  material.emissiveIntensity = config.emissiveIntensity * (0.2 + bandValue * 3);
  const baseColor = new THREE.Color(bandConfig.color);
  const brightness = (0.6 + bandValue * 0.4) * bandConfig.brightness;
  const currentColor = baseColor.clone().multiplyScalar(brightness);
  material.color = currentColor;
  const emissiveColor = baseColor.clone().multiplyScalar(brightness * 0.3);
  material.emissive = emissiveColor;
};

/**
 * Updates background elements with subtle audio-reactive effects
 * Applies gentle emissive glow and movement to background elements based on audio
 * @param backgroundElements - Array of background mesh elements
 * @param overallIntensity - Combined audio intensity from all bands
 * @param time - Current time for animation
 */
const updateBackgroundElements = (
  backgroundElements: THREE.Mesh[],
  overallIntensity: number,
  time: number
): void => {
  backgroundElements.forEach((element: THREE.Mesh, index: number) => {
    if (element.material instanceof THREE.MeshStandardMaterial) {
      const reactivity = 0.05 + overallIntensity * 0.1;
      element.material.emissive.setScalar(reactivity);
      if (index > 1) {
        element.position.y += Math.sin(time * 0.5 + index) * 0.02;
        element.rotation.x += 0.005;
        element.rotation.y += 0.003;
      }
    }
  });
};

export const circularTubesVisualizer: VisualizerSetup = {
  name: "Portal",
  song: 0,
  camera: {
    position: [0, 0, 25],
  },

  setup: (scene: THREE.Scene) => {
    scene.background = new THREE.Color(0x0a0a0a);
    const backgroundElements = createBackgroundElements(scene);

    // Initialize containers
    const materials: { [key: string]: THREE.MeshStandardMaterial } = {};
    const rings: { [key: string]: THREE.Mesh } = {};

    // Create materials, rings, and lights for each frequency band
    Object.entries(config.frequencyBands).forEach(([bandType, bandConfig]) => {
      materials[bandType] = createFrequencyBandMaterial(bandConfig);
      
      rings[bandType] = new THREE.Mesh(new THREE.BufferGeometry(), materials[bandType]);
      rings[bandType].position.set(0, 0, 0);
      scene.add(rings[bandType]);
    });

    return { rings, materials, backgroundElements };
  },

  getTimeline: (getObjects: () => Record<string, any>) => [{
    action: () => {
      const { rings, materials, backgroundElements } = getObjects();
      if (!rings || !materials) return;

      const audioData = getAudioData();
      const time = Date.now() * 0.001;
      const bands = getProcessedAudioBands();

      // Update each frequency band ring
      Object.entries(config.frequencyBands).forEach(([bandType, bandConfig]) => {
        const ring = rings[bandType];
        const material = materials[bandType];
        const bandValue = bands[bandType];

        if (!ring || !material) return;

        // Update ring geometry and material
        updateRing(ring, material, bandType as 'low' | 'mid' | 'high', bandValue, bandConfig, audioData, time);
      });

      // Update background elements
      if (backgroundElements) {
        const overallIntensity = Object.values(bands).reduce((sum, value) => sum + value, 0) / 3;
        updateBackgroundElements(backgroundElements, overallIntensity, time);
      }
    }
  }]
};
