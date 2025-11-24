import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import RAPIER from '@dimforge/rapier3d';
import { times } from '@/utils/lodash';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { video } from '@/utils/video';
import { animateTimeline, getAnimationsModel } from './animation';

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
 * @param {stats, route, canvas} 
 * @param options
 * @returns {setup, animate, clock, delta, frame, renderer, scene, camera, orbit, world}
 */
export const getTools = ({ stats, route, canvas }: any) => {
  const clock = new THREE.Clock();
  let delta = 0;
  let frame = 0;
  let frameRate = 1 / 60;
  const { renderer, scene, camera, world } = getEnvironment(canvas);
  video.record(canvas, route);
  const getDelta = () => delta;
  const getFrame = () => frame;
  let orbit: OrbitControls | null = null;

  /**
   * Setup scene
   * @param config Configuration for camera, ground and lights
   * @param defineSetup Actions required to be performed before the animation loop
   */
  const setup = ({
    config = {},
    defineSetup = () => {},
  }: {
    config?: {
      global?: { frameRate?: number },
      camera?: { position?: CoordinateTuple },
      ground?: { size?: number, color?: number, texture?: string } | false
      sky?: { texture?: string, size?: number } | false
      lights?: { directional?: { intensity?: number } } | false
      orbit?: {target?: THREE.Vector} | false
    },
    defineSetup?: () => void
  }) => {
    frameRate = config?.global?.frameRate || frameRate;
    if (config.orbit !== false) {
      orbit = new OrbitControls(camera, renderer.domElement);
      if (config.orbit?.target) {
        orbit.target = new THREE.Vector3(config.orbit.target);
      }
    }
    if (config.lights !== false) createLights(scene, {directionalLightIntensity: config?.lights?.directional?.intensity });
    if (config.ground !== false) getGround(scene, world, config?.ground || {});
    if (config.sky !== false) getSky(scene, config?.sky || {});

    if (config?.camera?.position) camera.position.set(...(config.camera.position as CoordinateTuple));
    defineSetup();
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
      orbit: {debug: false}
    }
  }: {
    beforeTimeline?: () => void,
    afterTimeline?: () => void,
      timeline?: Timeline[],
      config?: any
  }) => { 
    function runAnimation() {
      if (stats) stats.start(route);
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
      renderer.render( scene, camera );

      video.stop(renderer.info.render.frame ,route);
      if (stats) stats.end(route);
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
  }
}

/**
 * Initialize typical configuration for ThreeJS and Rapier for a given canvas.
 * @param canvas 
 * @param options 
 * @returns 
 */
export const getEnvironment = (canvas: HTMLCanvasElement, options: any = {
  camera: { position: [0, 20, 150], distance: 75 },
  scene: { background: 0xbfd1e5 },
}) => {
  const gravity = { x: 0.0, y: -9.81, z: 0.0 };
  const world = new RAPIER.World(gravity);
  const renderer = getRenderer(canvas);
  const scene = new THREE.Scene();
  const clock = new THREE.Clock();
  scene.background = new THREE.Color(options.scene?.background || 0xbfd1e5);

  const camera = new THREE.PerspectiveCamera(options.camera.distance, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(...(options.camera.position as CoordinateTuple));

  return { renderer, scene, camera, clock, world };
}

export const getOffset = (model: Model, config: any) => {
  const { x, y, z } = config.offset
  const offset = new THREE.Vector3(x, y, z)
  offset.applyQuaternion(model.quaternion)
  offset.add(model.position)

  return offset
}

export const getLookAt = (model: Model, config: any) => {
  const { x, y, z } = config.lookAt
  const lookAt = new THREE.Vector3(x, y, z)
  lookAt.applyQuaternion(model.quaternion)
  lookAt.add(model.position)

  return lookAt
}

/**
 * Set given camera to third person view
 * @param camera 
 * @param config 
 * @param model 
 */
export const setThirdPersonCamera = (
  camera: THREE.PerspectiveCamera,
  config: any,
  model: Model | null
) => {
  if (model) {
    const offset = getOffset(model, config)
    const lookAt = getLookAt(model, config)

    camera.position.copy(offset)
    camera.lookAt(lookAt)
  }
}

export const getRenderer = (canvas: HTMLCanvasElement): THREE.WebGLRenderer => {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0xaaaaff); // Set background color to black
  renderer.shadowMap.enabled = true; // Enable shadow maps
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Use soft shadows
  return renderer;
}

/**
 * Create and return default lights
 * @param scene 
 * @returns 
 */
export const createLights = (scene: THREE.Scene, {
  directionalLightIntensity,
  hemisphere,
  ambient
}: {
  directionalLightIntensity?: number,
  hemisphere?: { colors?: any[] }
  ambient?: { color?: number, intensity?: number }
  } = {
    hemisphere: { colors: [0x555555, 0xffffff] },
    ambient: { color: 0xffffff, intensity: 1 }
  }) => {
  const hemisphereLight =  new THREE.HemisphereLight(...(hemisphere?.colors || []));
  scene.add(hemisphereLight);
  
  // Add directional light with shadows
  const directionalLight = new THREE.DirectionalLight(0xffffff, directionalLightIntensity ?? 1.2);
  directionalLight.position.set(100, 100, 100);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.left = -500;
  directionalLight.shadow.camera.right = 500;
  directionalLight.shadow.camera.top = 500;
  directionalLight.shadow.camera.bottom = -500;
  directionalLight.shadow.camera.near = 0.1;
  directionalLight.shadow.camera.far = 1000;
  directionalLight.shadow.camera.updateProjectionMatrix();
  scene.add(directionalLight);

  // const shadowCameraHelper = new THREE.CameraHelper(directionalLight.shadow.camera);
  // scene.add(shadowCameraHelper);
  
  const ambientLight = new THREE.AmbientLight( ambient?.color, ambient?.intensity );
  ambientLight.position.set(5, 5, 5);
  scene.add(ambientLight)
  
  return { directionalLight, ambientLight };
}

/**
 * Create and return ground with physic, helper and texture
 * @param scene 
 * @param world 
 * @param { size, position, helpers, color, texture } 
 * @returns 
 */
export const getGround = (
  scene: THREE.Scene,
  world: RAPIER.World,
  {
    size = 1000,
    position = [1, -1, 1],
    helpers,
    color = 0x333333,
    texture,
  }: {
    size?: number,
    position?: CoordinateTuple,
    helpers?: boolean,
    color?: number,
    texture?: string,
  },
) => {
    const defaultProps = { color }
    const geometry = new THREE.BoxGeometry(size, 0.5, size);
    const material = new THREE.MeshStandardMaterial({
    ...defaultProps,
    ...texture ? { map: getTextures(texture)} : {},
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  // mesh.rotation.x = -Math.PI / 2 // Rotate the ground to make it horizontal
  mesh.position.set(...position)
  mesh.userData.physics = { mass: 0 };

  scene.add(mesh);

  const { rigidBody, collider } = getPhysic(world, {
    position: mesh.position.toArray(),
    size: [size, 2, size],
    boundary: 0.5,
  })

  // HELPER: Create a mesh to visualize the collider
  const helper = new THREE.BoxHelper(mesh, 0x000000)
  if (helpers) {
    scene.add(helper)
  }

  return { mesh, rigidBody, helper, collider }
}

export const getSky = (
  scene: THREE.Scene,
  {
    color = 0xaaaaff,
    size = 1000,
    texture
  }: {
    color?: number
    texture?: string
    size?: number
  }
) => {
  const skyGeometry = new THREE.SphereGeometry(size, 32, 32);
  const loader = new THREE.TextureLoader();
  const skyMaterial = new THREE.MeshBasicMaterial({
    side: THREE.BackSide,
    color,
    ...texture ? { map: loader.load(new URL(texture!, import.meta.url) as unknown as string)} : {},
  });
  const model = new THREE.Mesh(skyGeometry, skyMaterial)
  scene.add(model)

  return { model }
}

// /**
//  * Set sky for the scene
//  * @param scene 
//  * @param { size, color, texture } 
//  * @returns 
//  */
// export const getSky = (
//   scene: THREE.Scene,
//   {
//     color = 0xaaaaff,
//     size = 1000,
//     texture
//   }: {
//     color?: number
//     texture?: string
//     size?: number
//   }
// ) => {
//   const skyGeometry = new THREE.SphereGeometry(size, 32, 32)
//   const skyMaterial = new THREE.MeshBasicMaterial({
//     side: THREE.BackSide,
//     color,
//     ...texture ? { map: getTextures(texture)} : {},
//   })
//   const model = new THREE.Mesh(skyGeometry, skyMaterial)
//   scene.add(model)

//   return { model }
// }

export const loadFBX = (
  fileName: string,
  {
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = [1, 1, 1],
    material = false,
    color,
    opacity = 1,
    reflectivity = 0.5,
    roughness = 1,
    metalness = 0,
    castShadow = false,
    receiveShadow = false,
    transmission = 0,
    clearcoat = 1.0,
    clearcoatRoughness = 0.05,
    ior = 1.5,
    thickness = 0.5,
    envMapIntensity = 2.0,
  }: ModelOptions = {}
): Promise<Model> => {
  return new Promise((resolve, reject) => {
    const loader = new FBXLoader();
    loader.load(`/${fileName}`, (model) => {
      model.position.set(...position);
      model.scale.set(...scale);
      model.rotation.set(...rotation);
      model.castShadow = castShadow;
      model.receiveShadow = receiveShadow; 
      model.traverse((child) => {
        if (child.isMesh) {
          if (material) {
            child.material = new THREE.MeshPhysicalMaterial({
              color,
              opacity, 
              transparent: opacity < 1,
              reflectivity,
              roughness,
              transmission,
              metalness,
              clearcoat, clearcoatRoughness, ior, thickness, envMapIntensity, 
            });
          }
          child.rotation.set(...rotation);
          child.castShadow = castShadow;
          child.receiveShadow = receiveShadow;
        }
      });
      resolve(model)
    }, undefined, reject);
  });
}

/**
 * Return threeJS valid 3D model
 */
export const loadGLTF = (
  fileName: string,
  {
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = [1, 1, 1],
    material = false,
    color,
    opacity = 1,
    reflectivity = 0.5,
    roughness = 1,
    metalness = 0,
    castShadow = false,
    receiveShadow = false,
    transmission = 0,
    clearcoat = 1.0,
    clearcoatRoughness = 0.05,
    ior = 1.5,
    thickness = 0.5,
    envMapIntensity = 2.0,
  }: ModelOptions = {}
): Promise<{ model: Model, gltf: any }> => {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(`/${fileName}`, (gltf) => {
      const model = gltf.scene;
      model.castShadow = castShadow;
      model.receiveShadow = receiveShadow; 
      model.position.set(...position);
      model.scale.set(...scale);
      model.rotation.set(...rotation);
      model.traverse((child) => {
        if (child.isMesh) {
          if (material) {
            child.material = new THREE.MeshPhysicalMaterial({
              color,
              opacity, 
              transparent: opacity < 1,
              reflectivity,
              roughness,
              transmission,
              metalness,
              clearcoat, clearcoatRoughness, ior, thickness, envMapIntensity, 
            });
          }
          child.rotation.set(...rotation);
          child.castShadow = castShadow;
          child.receiveShadow = receiveShadow;
        }
      });
      resolve({ model, gltf });
    }, undefined, reject);
  });
}

/**
 * Attach animations to a model
 * @param model 
 * @param fileName 
 * @returns 
 */
export const loadAnimation = (model: Model, fileName: string): Promise<THREE.AnimationMixer> => {
  return new Promise((resolve, reject) => {
    // Add animation
    const loader = new FBXLoader();
    loader.load(`/${fileName}`, (animation) => {
    const mixer = new THREE.AnimationMixer(model);
      const action = mixer.clipAction((model?.animations[0] ? model : animation).animations[0]);
      action.play();
      resolve(mixer);
    });
  });
}

/**
 * Populate a given area with a given amount of instances
 * @param config 
 * @param groundSize 
 * @returns 
 */
export const getInstanceConfig = (config: InstanceConfig, groundSize: CoordinateTuple) => times(config.amount, () => {
  const size = Math.random() * config.size + config.sizeDelta;
  const getPosition = () => Math.random() * groundSize[0]/config.area - groundSize[0]/config.area/2

  return {
    position: [getPosition(), 0, getPosition()],
    rotation: [0, Math.random() * 360, 0],
    scale: [size, size, size]
  }
});

// https://threejs.org/docs/#api/en/objects/InstancedMesh
/**
 * Create multiple instances of a given mesh, based on a configuration
 * @param mesh 
 * @param scene 
 * @param options 
 * @returns 
 */
export const instanceMatrixMesh = (
  mesh: Model,
  scene: THREE.Scene,
  options: ModelOptions[]
): THREE.InstancedMesh<any, any, THREE.InstancedMeshEventMap>[] => {
  const count = options.length;
  const geometry = mesh.geometry;
  const material = mesh.material;
  const instancedMesh = new THREE.InstancedMesh(geometry, material, count);
  instancedMesh.receiveShadow = true; // Enable receiving shadows

  return options.map(({position, rotation, scale, textures}, index) => {
    const matrix = new THREE.Matrix4();
    const positionVector = new THREE.Vector3(...(position ?? [0, 0 ,0]));
    const rotationEuler = new THREE.Euler(...(rotation ?? [0, 0, 0]));
    const scaleVector = new THREE.Vector3(...(scale ?? [1, 1, 1]));

    matrix.compose(positionVector, new THREE.Quaternion().setFromEuler(rotationEuler), scaleVector);
    instancedMesh.setMatrixAt(index, matrix);
    if (textures) {
      mesh.material.map = textures.random ? textures.list[Math.floor(Math.random() * textures.list.length)] : textures.list[index % textures.list.length];
      instancedMesh.material = mesh.material;
    }

    scene.add(instancedMesh);

    return instancedMesh;
  });
}

/**
 * Generate multiple instances for a model based on a configuration
 * @param model 
 * @param scene 
 * @param options 
 */
export const instanceMatrixModel = (model: THREE.Group<THREE.Object3DEventMap>, scene: THREE.Scene, options: ModelOptions[]): Model => {
  model.traverse((child) => {
    if (child.isMesh) {
      instanceMatrixMesh(child, scene, options);
    }
  });
}

export const cloneModel = (model: Model, scene: THREE.Scene, options: ModelOptions[]): Model => {
  options.forEach(({ position, rotation, scale }) => {
    const clone = model.clone();
    clone.position.set(...position!);
    clone.rotation.set(...rotation!);
    clone.scale.set(...scale!);
    scene.add(clone);
  });
}

/**
 * Get default textures
 * @param img 
 * @returns 
 */
export const getTextures = (img: string) => {
  const textureLoader = new THREE.TextureLoader();
  const texture = textureLoader.load(img);

  // Adjust the texture offset and repeat
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.offset.set(1, 1); // Offset the texture by 50%
  texture.repeat.set(1, 1); // Repeat the texture 0.5 times in both directions

  return texture;
}

/**
 * Load any type of mode, apply default values and add physic to it
 * @param scene 
 * @param world 
 * @param path Path of the file to be loaded
 * @param {ModelOptions} options Options for the model 
 * @returns 
 */
export const getModel = async (
  scene: THREE.Scene,
  world: RAPIER.World,
  path: string,
  {
    size = 1,
    position = [0, 0, 0],
    rotation = [0, 0, 0] as CoordinateTuple,
    scale = [1, 1, 1],
    color,
    opacity = 1,
    mass = 1,
    density = 1,
    weight = 5,
    friction = 0,
    restitution = 1,
    boundary = 0.5,
    damping = 0,
    angular = 0,
    dominance = 0,
    type = 'dynamic',
    reflectivity = 0.5,
    roughness = 0.1,
    metalness = 0.8,
    material = false,
    transmission = 0.2,
    clearcoat = 1.0,
    clearcoatRoughness = 0.05,
    ior = 1.5,
    thickness = 0.5,
    envMapIntensity = 2.0,
    hasGravity = false,
    castShadow = false,
    receiveShadow = false,
    showHelper = false,
    enabledRotations = [true, true, true],
    texture,
  }: ModelOptions = {},
): Promise<AnimatedComplexModel> => {
  const initialValues = { size, rotation, position, color }
  const isGLTF = ['glb', '.gltf'].some(extension => path.includes(extension))
  const { model: mesh, gltf } = isGLTF
    ? await loadGLTF(path, { clearcoat, clearcoatRoughness, ior, thickness, envMapIntensity, position, scale, rotation, color, opacity, material, reflectivity, roughness, metalness, transmission, texture, castShadow, receiveShadow})
    : await loadFBX(path, { clearcoat, clearcoatRoughness, ior, thickness, envMapIntensity, position, scale, rotation, color, opacity, material, reflectivity, roughness, metalness, transmission, texture, castShadow, receiveShadow })
  scene.add(mesh);

  let helper;
  // Add helper model
  if (showHelper) {
    helper = new THREE.BoxHelper(mesh, 0xff0000); // Red color for the helper
    scene.add(helper);
  }
  
  // Add animation
  const mixer = new THREE.AnimationMixer(mesh);
  const actions = gltf.animations?.length ? getAnimationsModel(mixer, mesh, gltf) : {};

  // Set physic to the model
  const { rigidBody, collider, characterController } = getPhysic(world, {
    position,
    size,
    rotation,
    restitution,
    weight,
    density,
    friction,
    dominance,
    boundary,
    angular,
    damping,
    mass,
    shape: 'ball',
    type,
    enabledRotations,
  })
  
  return { mesh, rigidBody, collider, initialValues, actions, mixer, helper, type, characterController, hasGravity }
}

/**
 * Add physic to the model for a given world, using default values
 * @param world
 * @param position
 * @param size
 * @param {Object} options - The options for the physics body and collider.
 * @param {number} [options.boundary=0] - The boundary size of the collider.
 * @param {number} [options.restitution=0] - The restitution (bounciness) of the collider.
 * @param {number} [options.friction=0] - The friction of the collider against other objects.
 * @param {Rotation} [options.rotation] - The initial rotation of the object.
 * @param {number} [options.weight=1] - The gravity scale applied to the object to simulate the weight.
 * @param {number} [options.mass=1] - The mass in the sense of resistance from movement.
 * @param {number} [options.density=1] - The density of the object.
 * @param {number} [options.dominance=1] - The influence level from other bodies.
 * @param {'fixed' | 'dynamic'} [options.type='fixed'] - The type of the rigid body.
 * @param {'cuboid' | 'ball'} [options.shape='cuboid'] - The shape of the collider.
 * @returns {Object} The created rigid body and collider.

 * @returns
 */
export const getPhysic = (
  world: RAPIER.World,
  {
    rotation,
    position = [0, 0, 0],
    size = [1, 1, 1],
    boundary = 0.5,
    restitution = 1,
    friction = 0,
    damping = 0,
    angular = 1,
    mass = 1,
    density = 1,
    weight = 1,
    dominance = 0,
    shape = 'cuboid',
    type = 'fixed',
    enabledRotations = [true, true, true],
  }: PhysicOptions,
) => {
  // Create a fixed rigid body for the brick block
  const rigidBodyDesc = RAPIER.RigidBodyDesc[type]()
    .setTranslation(...position)
    .setGravityScale(weight)
    .setDominanceGroup(dominance)
    .setLinearDamping(damping)
    .setAngularDamping(angular)
    .enabledRotations(...enabledRotations as [boolean, boolean, boolean])
  const rigidBody = world.createRigidBody(rigidBodyDesc)
  if (rotation) {
    rigidBody.setRotation(rotation, true)
  }
  const colliderShape =
    shape === 'cuboid'
      ? RAPIER.ColliderDesc.cuboid(
          ...((size as CoordinateTuple).map((x) => x * boundary) as CoordinateTuple),
        )
      : RAPIER.ColliderDesc.ball(size as number)
  // Create a cuboid collider attached to the fixed rigid body
  const colliderDesc = colliderShape
    .setRestitution(restitution)
    .setFriction(friction)
    .setMass(mass)
    .setDensity(density)
  const collider = world.createCollider(colliderDesc, rigidBody)

  let characterController

  if (type === 'kinematicPositionBased') {
    // Create a character controller for gravity and collision handling
    characterController = world.createCharacterController(0.01);
    characterController.setUp({ x: 0, y: 1, z: 0 }); // Set the up direction
    characterController.enableSnapToGround(0); // Enable snapping to the ground
    characterController.setMaxSlopeClimbAngle(45); // Set the maximum slope angle
    characterController.setMinSlopeSlideAngle(30); // Set the minimum slope angle
  }

  return { rigidBody, collider, characterController }
}

/**
 * Remove elements from the threeJS scene and Rapier world, then return the emptied list
 * @param scene 
 * @param world 
 * @param elements 
 * @returns 
 */
export const removeElements = (scene: THREE.Scene, world: RAPIER.World, elements: any[]) => {
  elements.forEach(({ mesh, rigidBody }) => {
    scene.remove(mesh);
    world.removeRigidBody(rigidBody);
  });

  return [];
}

/**
 * Change colors of children contained in a mesh
 * @param mesh 
 * @param materialColors 
 */
export const colorModel = (mesh: THREE.Mesh, materialColors: number[] = []) => {
  // Apply colors from array based on mesh index
  let meshIndex = 0;
  mesh.traverse((child: any) => {
    if (child.isMesh && child.material) {
      const material = child.material;
      const targetColor = materialColors[meshIndex % materialColors.length];

      // Apply color to material
      if (Array.isArray(material)) {
        material.forEach((mat: any) => {
          if (mat.isMeshStandardMaterial || mat.isMeshPhongMaterial) {
            mat.color.setHex(targetColor);
          }
        });
      } else if (material.isMeshStandardMaterial || material.isMeshPhongMaterial) {
        material.color.setHex(targetColor);
      }

      meshIndex++;
    }
  });

  return mesh;
};

/**
 * Configuration interface for zigzag texture parameters
 */
export interface ZigzagTextureOptions {
  size?: number;           // Canvas size (default: 64)
  backgroundColor?: string; // Background color (default: '#68b469')
  zigzagColor?: string;    // Primary zigzag line color (default: '#4a7c59')
  secondaryColor?: string; // Secondary zigzag line color (default: '#5a8c69')
  zigzagHeight?: number;   // Amplitude of zigzag pattern (default: 16)
  zigzagWidth?: number;    // Width of each zigzag segment (default: 8)
  primaryThickness?: number; // Line width of primary zigzag (default: 3)
  secondaryThickness?: number; // Line width of secondary zigzag (default: 2)
  repeatX?: number;        // Texture repeat X (default: 50)
  repeatY?: number;        // Texture repeat Y (default: 50)
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

  // Create a canvas for the zigzag pattern
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Fill background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, size, size);

  // Draw primary zigzag pattern
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

  // Create Three.js texture from canvas
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  
  return texture;
};

/**
 * Smoothly tilt the camera for dynamic effects like jump reactions
 * @param camera - The Three.js camera to tilt
 * @param targetTilt - Target tilt angle in radians (positive = tilt up, negative = tilt down)
 * @param lerpFactor - Smoothing factor (0-1, higher = faster transition)
 */
export const tiltCamera = (camera: THREE.Camera, targetTilt: number, lerpFactor: number = 0.1) => {
  // Store original rotation if not already stored
  if (!camera.userData.originalRotation) {
    camera.userData.originalRotation = {
      x: camera.rotation.x,
      y: camera.rotation.y,
      z: camera.rotation.z
    };
  }

  // Smoothly interpolate to target tilt
  const currentTilt = camera.rotation.x - camera.userData.originalRotation.x;
  const tiltDifference = targetTilt - currentTilt;
  const newTilt = currentTilt + tiltDifference * lerpFactor;
  
  // Apply tilt relative to original rotation
  camera.rotation.x = camera.userData.originalRotation.x + newTilt;
};

/**
 * Calculate Out of Sight (OoS) status for background elements
 * @param camera
 * @param background
 */
export const isOoS = (camera: THREE.PerspectiveCamera, background: {
    mesh: THREE.Mesh;
    speed: number;
}) => {
  // Calculate removal distance based on camera cone vision and element depth
  const cameraPos = camera.position;
  const elementDepth = Math.abs(background.mesh.position.z - cameraPos.z);

  // Account for camera field of view cone - wider cone for farther elements
  const fov = camera.fov * (Math.PI / 180); // Convert to radians
  const aspect = window.innerWidth / window.innerHeight;
  const coneWidth = 2 * Math.tan(fov / 2) * elementDepth * aspect;

  // Add significant offset for safe removal (element width + cone width + buffer)
  let elementWidth = 200; // Default fallback
  if (background.mesh.geometry?.boundingBox) {
    elementWidth = background.mesh.geometry.boundingBox.max.x - background.mesh.geometry.boundingBox.min.x;
  } else {
    // Compute bounding box if not available
    background.mesh.geometry.computeBoundingBox();
    if (background.mesh.geometry.boundingBox) {
      elementWidth = background.mesh.geometry.boundingBox.max.x - background.mesh.geometry.boundingBox.min.x;
    }
  }
  const removalOffset = (coneWidth / 2) + elementWidth + 500; // Extra 500 units buffer

  return background.mesh.position.x < cameraPos.x - removalOffset
}
