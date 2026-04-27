interface ViewMeta {
  description: string
  image?: string
}

export const VIEW_META: Record<string, ViewMeta> = {
  // Experiments
  'Landing Page': {
    description: 'Browse all generative art experiments, games, and interactive 3D tools.'
  },
  'Camera Presets': {
    description: 'Explore different Three.js camera configurations and presets.'
  },
  'Complex Animation': {
    description: 'Complex layered animation sequences with Three.js timeline.'
  },
  'Continuous World': {
    description: 'Procedurally generated infinite terrain with real-time chunk streaming.'
  },
  'Draw Path': { description: 'Interactive path drawing tool with smooth curve generation.' },
  'Earth Gazer': { description: 'Realistic 3D Earth globe with atmosphere and cloud layers.' },
  'Earth View': { description: '3D Earth view with satellite imagery and orbit controls.' },
  'Materials List': {
    description:
      'Interactive showcase of all Three.js PBR material types with live property controls.'
  },
  'Model Animation': { description: 'Load and preview animated 3D models with playback controls.' },
  'Moon Two': { description: '3D Moon surface rendering with displacement mapping.' },
  'Moon View': { description: 'Detailed 3D Moon view with realistic surface shading.' },
  'Multiplayer P 2 P': { description: 'Peer-to-peer multiplayer demo using WebRTC data channels.' },
  'Pathfinder Threejs': {
    description: '3D pathfinding visualisation with A* algorithm on a Three.js grid.'
  },
  'Physic Ball': { description: 'Physics simulation with bouncing balls using Rapier.js.' },
  'Physic Basic': { description: 'Basic rigid body physics demo with Rapier.js and Three.js.' },
  'Physic Examples': {
    description: 'Collection of physics interaction examples: joints, colliders, forces.'
  },
  'Physic Fluid': { description: 'Fluid simulation with particle dynamics and surface tension.' },
  'Threejs Example Controller': {
    description: 'Character controller demo with third-person camera.'
  },
  'Threejs Example Controller Tools': {
    description: 'Controller tooling playground for Three.js character movement.'
  },
  'Timeline Game': { description: 'Game built entirely on the custom timeline animation system.' },
  'Visualizer Main': { description: 'Music visualiser with frequency-reactive 3D geometry.' },

  // Games
  'Chick Run': { description: 'Endless runner game — dodge obstacles as a speedy chick.' },
  'Forest Game': {
    description: '3D forest exploration game with character movement and environment.'
  },
  'Goomba Runner': { description: 'Side-scrolling platformer featuring Goomba-style enemies.' },
  'Maze Game': {
    description: '3D maze navigation game with procedural maze generation and pathfinding enemies.'
  },
  Pictionary: {
    description: 'Multiplayer drawing and guessing game with real-time collaboration.'
  },

  // Generative
  'Cube Matrix': { description: 'Animated grid of cubes reacting to noise and mouse interaction.' },
  'Cube Matrix 2': {
    description: 'Second iteration of the cube matrix with enhanced shader effects.'
  },
  'Cube Matrix Threejs': {
    description: 'Three.js GPU-accelerated cube matrix with instanced rendering.'
  },
  'Cube Sequences': { description: 'Sequenced cube animations driven by a custom timeline.' },
  'Cube Shift': { description: 'Cubes shifting position in rhythmic wave patterns.' },
  'Falling View': {
    description: 'Particles falling with physics-inspired motion and colour gradients.'
  },
  'Line Matrix Mouse': { description: 'Interactive line matrix that responds to mouse movement.' },
  'Metal Cubes': {
    description: 'Reflective metallic cubes with PBR shading and environment maps.'
  },
  'Metal Cubes 2': { description: 'Enhanced metallic cube array with dynamic lighting.' },
  'Simplex Cached': { description: 'Simplex noise terrain with chunk caching for performance.' },
  'Simplex Worker': { description: 'Simplex noise generation offloaded to a Web Worker.' },

  // Tools
  'Canvas Texture Editor': {
    description: 'Browser-based canvas texture painting and editing tool.'
  },
  'Mixamo Playground': { description: 'Test and preview Mixamo character animations in 3D.' },
  'Model Loader': {
    description: 'Drag-and-drop 3D model loader supporting GLB, GLTF, FBX formats.'
  },
  'Panels Test': { description: 'Development testbed for the panel and configuration UI system.' },
  'Scene Editor': {
    description: 'Visual 3D scene composition tool with object placement and lighting.'
  },
  'Tools Test': { description: 'Internal tooling test page for development utilities.' }
}
