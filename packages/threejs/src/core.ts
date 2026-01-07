import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import RAPIER from '@dimforge/rapier3d-compat';
import { EffectComposer, setupPostprocessing } from './postprocessing';
import { video } from './utils/video';
import { animateTimeline, ComplexModel, CoordinateTuple, Timeline } from '@webgamekit/animation';
import { ToolsConfig, SetupConfig, ModelOptions } from './types';
import { getEnvironment, getLights, getGround, getSky } from './getters';

export const defaultModelOptions: ModelOptions = {
  position: [0, 0, 0],
  color: 0x222222,
  mass: 1,
  density: 1,
  weight: 5,
  friction: 0,
  restitution: 0,
  damping: 0,
  opacity: 1,
  reflectivity: 0.5,
  roughness: 1,
  metalness: 0,
  transmission: 0,
};

/**
 * Initialize ThreeJS and Rapier and retrieve common tools.
 * Add lights, ground, and camera to the scene with default values.
 * Configuration passed through the setup function.
 * Animation allows to define a timeline with looped actions, as well as a before and after function.
 * Stats, configuration and video are handled by other utilities and added by default.
 *
 * Example config for postprocessing shading effects:
 *
 * postprocessing: {
 *   pixelate: { size: 8 },
 *   bloom: { strength: 0.8, threshold: 0.2, radius: 1.0 },
 *   fxaa: {},
 *   dotScreen: { scale: 1.5, angle: Math.PI / 3, center: [0.5, 0.5] },
 *   rgbShift: { amount: 0.002 },
 *   film: { noiseIntensity: 0.5, scanlinesIntensity: 0.05, scanlinesCount: 800, grayscale: true },
 *   glitch: {},
 *   afterimage: {},
 *   ssao: {},
 *   vignette: { offset: 1.2, darkness: 1.3, color: 0x222222 },
 *   colorCorrection: { contrast: 1.2, saturation: 1.1, brightness: 1.0 },
 * }
 *
 * @param {stats, route, canvas} 
 * @param options
 * @returns {setup, animate, clock, delta, frame, renderer, scene, camera, orbit, world}
 */
export const getTools = async ({ stats, route, canvas }: ToolsConfig) => {
  const clock = new THREE.Clock();
  let delta = 0;
  let frame = 0;
  let frameRate = 1 / 60;
  const { renderer, scene, camera, world } = await getEnvironment(canvas);
  let composer: EffectComposer | null = null;
  if (video && route) video.record(canvas, route);
  const getDelta = () => delta;
  const getFrame = () => frame;
  let orbit: OrbitControls | null = null;

  /**
   * Setup scene
   * @param config Configuration for camera, ground and lights
   * @param defineSetup Actions required to be performed before the animation loop
   */
  const setup = async ({
    config = {},
    defineSetup,
  }: {
    config?: SetupConfig,
    defineSetup?: () => Promise<void> | void
  }) => {
    frameRate = config?.global?.frameRate || frameRate;
    if (config.scene?.backgroundColor) scene.background = new THREE.Color(config.scene.backgroundColor);
    if (config.orbit !== false) {
      orbit = new OrbitControls(camera, renderer.domElement);
      if (config.orbit?.target) {
        orbit.target.copy(config.orbit.target as THREE.Vector3);
      }
      orbit.enabled = !(config.orbit?.disabled === true);
    }
    if (config.lights !== false) getLights(scene, config.lights);
    if (config.ground !== false) getGround(scene, world, config?.ground || {});
    if (config.sky !== false) getSky(scene, config?.sky || {});
    
    if (config?.camera) {
      if (config.camera.position)
        if (config.camera.position instanceof Array) {
          camera.position.set(...(config.camera.position as CoordinateTuple));
        } else {
          camera.position.copy(config.camera.position);
        }
      if (config.camera.near) camera.near = config.camera.near;
      if (config.camera.far) camera.far = config.camera.far;
      if (config.camera.fov) camera.fov = config.camera.fov;
      if (config.camera.up) camera.up = config.camera.up;
      if (config.camera.aspect) camera.aspect = config.camera.aspect;
      if (config.camera.zoom) camera.zoom = config.camera.zoom;
      if (config.camera.focus) (camera as any).focus = config.camera.focus;
      if (config.camera.rotation) {
        if (config.camera.rotation instanceof Array) {
          camera.rotation.set(...(config.camera.rotation as CoordinateTuple));
        } else {
          camera.rotation.setFromVector3(config.camera.rotation as THREE.Vector3);
        }
      }
      if (config.camera.lookAt) {
        if (config.camera.lookAt instanceof Array) {
          camera.lookAt(...(config.camera.lookAt));
        } else {
          camera.lookAt(config.camera.lookAt);
        }
      }
      camera.updateProjectionMatrix();
    }

    if (config.postprocessing) composer = await setupPostprocessing({ renderer, scene, camera, config: config.postprocessing });
    if (defineSetup) await defineSetup();
  };

  /**
   * The animation loop.
   * @param beforeTimeline Actions required to be performed before the timeline
   * @param afterTimeline Actions required to be performed after the timeline
   * @param timelines List of animations and loops
   */
  const animate = ({
    beforeTimeline = () => {},
    afterTimeline = () => {},
    timeline = [],
    config = {
      orbit: {
        debug: false,
      }
    }
  }: {
    beforeTimeline?: () => void,
    afterTimeline?: () => void,
      timeline?: Timeline[],
      config?: {
        orbit?: {
          debug?: boolean,
        }
      }
  }) => { 
    function runAnimation() {
      if (stats?.start && route) stats.start(route);
      delta = clock.getDelta();
      frame = requestAnimationFrame(runAnimation);
      world.step();
  
      beforeTimeline();
      animateTimeline(timeline, frame);
      afterTimeline();
      
      if (orbit) {
        orbit.update();
        if (config.orbit?.debug) console.log(camera);
      }
      if (composer) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }

      if (video?.stop && route) video.stop(renderer.info.render.frame ,route);
      if (stats?.end && route) stats.end(route);
    }
    runAnimation();
  };
  
  return {
    setup,
    animate,
    clock,
    getDelta,
    getFrame,
    renderer,
    scene,
    camera,
    orbit,
    world
  };
};

/**
 * Remove elements from the threeJS scene and Rapier world, then return the emptied list
 * @param scene 
 * @param world 
 * @param elements 
 * @returns 
 */
export const removeElements = (scene: THREE.Scene, world: RAPIER.World, meshes: ComplexModel[]) => {
  meshes.forEach((mesh) => {
    scene.remove(mesh);
    if (mesh.userData.body) {
      world.removeRigidBody(mesh.userData.body);
    }
  });

  return [];
};

/**
 * Configuration interface for zigzag texture parameters
 */
interface ZigzagTextureOptions {
  size?: number;
  backgroundColor?: string;
  zigzagColor?: string;
  secondaryColor?: string;
  zigzagHeight?: number;
  zigzagWidth?: number;
  primaryThickness?: number;
  secondaryThickness?: number;
  repeatX?: number;
  repeatY?: number;
}

/**
 * Creates a procedural zigzag pattern texture using Canvas API
 * @param options Configuration options for the zigzag pattern
 * @returns THREE.CanvasTexture with zigzag pattern
 */
export const createZigzagTexture = (options: ZigzagTextureOptions = {}): THREE.CanvasTexture => {
  const {
    size = 64,
    backgroundColor = '#68b469',
    zigzagColor = '#4a7c59',
    zigzagHeight = 16,
    zigzagWidth = 8,
    primaryThickness = 3,
    repeatX = 50,
    repeatY = 50
  } = options;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = zigzagColor;
  ctx.lineWidth = primaryThickness;
  ctx.beginPath();

  const numZigzags = Math.ceil(size / zigzagWidth);

  for (let i = 0; i <= numZigzags; i++) {
    const x = i * zigzagWidth;
    const y = (i % 2 === 0) ? size / 2 - zigzagHeight / 2 : size / 2 + zigzagHeight / 2;
    
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  
  return texture;
};

export const onWindowResize = (camera: THREE.Camera, renderer: THREE.WebGLRenderer) => {
  if (camera instanceof THREE.PerspectiveCamera) {
    camera.updateProjectionMatrix();
  }
  renderer.setSize(window.innerWidth, window.innerHeight);
};

// https://threejs.org/docs/#api/en/objects/InstancedMesh
/**
 * Create multiple instances of a given mesh, based on a configuration
 * @param mesh 
 * @param scene 
 * @param options 
 * @returns 
 */
export const instanceMatrixMesh = (
  mesh: THREE.Mesh | ComplexModel,
  scene: THREE.Scene,
  options: ModelOptions[]
): THREE.InstancedMesh<any, any>[] => {
  const count = options.length;
  const geometry = mesh.geometry;
  const material = mesh.material;
  const instancedMesh = new THREE.InstancedMesh(geometry, material, count);
  instancedMesh.receiveShadow = true;

  return options.map(({position, rotation, scale, textures}, index) => {
    const matrix = new THREE.Matrix4();
    const positionVector = new THREE.Vector3(...(position ?? [0, 0 ,0]));
    const rotationEuler = new THREE.Euler(...(rotation ?? [0, 0, 0]));
    const scaleVector = new THREE.Vector3(...(scale ?? [1, 1, 1]));

    matrix.compose(positionVector, new THREE.Quaternion().setFromEuler(rotationEuler), scaleVector);
    instancedMesh.setMatrixAt(index, matrix);
    if (textures) {
      (mesh.material as THREE.MeshStandardMaterial).map = textures.random ? textures.list[Math.floor(Math.random() * textures.list.length)] : textures.list[index % textures.list.length];
      instancedMesh.material = mesh.material;
    }

    scene.add(instancedMesh);

    return instancedMesh;
  });
};

/**
 * Generate multiple instances for a model based on a configuration
 * @param model 
 * @param scene 
 * @param options 
 */
export const instanceMatrixModel = (model: THREE.Group<THREE.Object3DEventMap>, scene: THREE.Scene, options: ModelOptions[]): void => {
  model.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      instanceMatrixMesh(child as THREE.Mesh, scene, options);
    }
  });
};
