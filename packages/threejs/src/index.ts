import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import RAPIER from '@dimforge/rapier3d-compat';
import { times } from './utils/lodash';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { video } from './utils/video';
import { animateTimeline, getAnimationsModel, CoordinateTuple, Model, AnimatedComplexModel, Timeline } from '@webgametoolkit/animation';
import { ModelOptions, SetupConfig, PhysicOptions, InstanceConfig, ToolsConfig } from './types';

export * from './types';

const defaultModelOptions: ModelOptions = {
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
const getTools = async ({ stats, route, canvas }: ToolsConfig) => {
  const clock = new THREE.Clock();
  let delta = 0;
  let frame = 0;
  let frameRate = 1 / 60;
  const { renderer, scene, camera, world } = await getEnvironment(canvas);
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
    }
    if (config.lights !== false) createLights(scene, {directionalLightIntensity: config?.lights?.directional?.intensity });
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
      orbit: {debug: false}
    }
  }: {
    beforeTimeline?: () => void,
    afterTimeline?: () => void,
      timeline?: Timeline[],
      config?: any
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
      renderer.render( scene, camera );

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
  }
}

/**
 * Initialize typical configuration for ThreeJS and Rapier for a given canvas.
 * @param canvas 
 * @param options 
 * @returns 
 */
const getEnvironment = async (canvas: HTMLCanvasElement, options: any = {
  camera: { position: [0, 20, 150], distance: 75 },
  scene: { background: 0xbfd1e5 },
}) => {
  await RAPIER.init();
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

const getOffset = (model: Model, config: any) => {
  const { x, y, z } = config.offset
  const offset = new THREE.Vector3(x, y, z)
  offset.applyQuaternion(model.quaternion)
  offset.add(model.position)

  return offset
}

const getLookAt = (model: Model, config: any) => {
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
const setThirdPersonCamera = (
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

const getRenderer = (canvas: HTMLCanvasElement): THREE.WebGLRenderer => {
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
const createLights = (scene: THREE.Scene, config: any = {}) => {
  const {
    ambient = { color: 0xffffff, intensity: 2 },
    directional = {
      color: 0xffffff,
      intensity: 4.0,
      position: [20, 30, 20],
      castShadow: true,
      shadow: {
        mapSize: { width: 4096, height: 4096 },
        camera: {
          near: 0.5,
          far: 500,
          left: -50,
          right: 50,
          top: 50,
          bottom: -50
        },
        bias: -0.0001,
        radius: 1
      }
    },
    hemisphere
  } = config;

  // Add hemisphere light if configured
  if (hemisphere?.colors) {
    const hemisphereLight = new THREE.HemisphereLight(...hemisphere.colors);
    scene.add(hemisphereLight);
  }
  
  // Add ambient light
  const ambientLight = new THREE.AmbientLight(ambient.color, ambient.intensity);
  scene.add(ambientLight);
  
  // Add directional light with shadows
  const directionalLight = new THREE.DirectionalLight(
    directional.color,
    directional.intensity
  );
  directionalLight.position.set(...(directional.position as CoordinateTuple));
  directionalLight.castShadow = directional.castShadow ?? true;
  
  if (directional.shadow) {
    if (directional.shadow.mapSize) {
      directionalLight.shadow.mapSize.width = directional.shadow.mapSize.width;
      directionalLight.shadow.mapSize.height = directional.shadow.mapSize.height;
    }
    
    if (directional.shadow.camera) {
      const cam = directional.shadow.camera;
      if (cam.near !== undefined) directionalLight.shadow.camera.near = cam.near;
      if (cam.far !== undefined) directionalLight.shadow.camera.far = cam.far;
      if (cam.left !== undefined) directionalLight.shadow.camera.left = cam.left;
      if (cam.right !== undefined) directionalLight.shadow.camera.right = cam.right;
      if (cam.top !== undefined) directionalLight.shadow.camera.top = cam.top;
      if (cam.bottom !== undefined) directionalLight.shadow.camera.bottom = cam.bottom;
    }
    
    if (directional.shadow.bias !== undefined) {
      directionalLight.shadow.bias = directional.shadow.bias;
    }
    if (directional.shadow.radius !== undefined) {
      directionalLight.shadow.radius = directional.shadow.radius;
    }
  }
  
  directionalLight.shadow.camera.updateProjectionMatrix();
  scene.add(directionalLight);

  // const shadowCameraHelper = new THREE.CameraHelper(directionalLight.shadow.camera);
  // scene.add(shadowCameraHelper);
  
  return { directionalLight, ambientLight };
}

/**
 * Create and return ground with physic, helper and texture
 * @param scene 
 * @param world 
 * @param { size, position, helpers, color, texture } 
 * @returns 
 */
const getGround = (
  scene: THREE.Scene,
  world: RAPIER.World,
  {
    size = 1000,
    position = [1, -1, 1],
    helpers,
    color = 0x333333,
    texture,
    textureRepeat = [10, 10],
    textureOffset = [0, 0],
  }: {
    size?: number,
    position?: CoordinateTuple,
    helpers?: boolean,
    color?: number,
    texture?: string,
    textureRepeat?: [number, number],
    textureOffset?: [number, number],
  },
) => {
    const defaultProps = { color }
    const geometry = new THREE.BoxGeometry(size, 0.5, size);
    const material = new THREE.MeshStandardMaterial({
    ...defaultProps,
    ...texture ? { map: getTextures(texture, textureRepeat, textureOffset)} : {},
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

const getSky = (
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

/**
 * Apply material properties to a model's meshes
 * @param model The model to apply materials to
 * @param options Material options
 */
const applyMaterialToModel = (
  model: Model,
  {
    rotation,
    material,
    materialType,
    color,
    materialColors,
    opacity,
    reflectivity,
    roughness,
    metalness,
    transmission,
    clearcoat,
    clearcoatRoughness,
    ior,
    thickness,
    envMapIntensity,
    castShadow,
    receiveShadow,
  }: ModelOptions
) => {
  let meshIndex = 0;
  model.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (material) {
        const oldMaterial = mesh.material as any;
        const meshColor = materialColors && materialColors[meshIndex] !== undefined 
          ? materialColors[meshIndex] 
          : (color || (oldMaterial?.color || 0xffffff));
        const materialProps: any = {
          color: meshColor,
          opacity: opacity ?? 1,
          transparent: (opacity ?? 1) < 1,
        };
        meshIndex++;

        // Preserve map/texture from old material if exists
        if (oldMaterial?.map) {
          materialProps.map = oldMaterial.map;
        }

        if (materialType === 'MeshPhysicalMaterial') {
          mesh.material = new THREE.MeshPhysicalMaterial({
            ...materialProps,
            reflectivity,
            roughness,
            transmission,
            metalness,
            clearcoat,
            clearcoatRoughness,
            ior,
            thickness,
            envMapIntensity,
          });
        } else if (materialType === 'MeshStandardMaterial') {
          mesh.material = new THREE.MeshStandardMaterial({
            ...materialProps,
            roughness,
            metalness,
          });
        } else if (materialType === 'MeshLambertMaterial') {
          mesh.material = new THREE.MeshLambertMaterial({
            ...materialProps,
            flatShading: false,
          });
        } else if (materialType === 'MeshPhongMaterial') {
          mesh.material = new THREE.MeshPhongMaterial({
            ...materialProps,
            shininess: 30,
          });
        } else if (materialType === 'MeshBasicMaterial') {
          mesh.material = new THREE.MeshBasicMaterial(materialProps);
        }
      }
      if (rotation) {
        mesh.rotation.set(...rotation);
      }
      mesh.castShadow = castShadow ?? false;
      mesh.receiveShadow = receiveShadow ?? false;
    }
  });
};

const loadFBX = (
  fileName: string,
  options: ModelOptions = {}
): Promise<Model> => {
  const {
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = [1, 1, 1],
    castShadow = false,
    receiveShadow = false,
  } = options;

  return new Promise((resolve, reject) => {
    const loader = new FBXLoader();
    loader.load(`/${fileName}`, (model) => {
      model.position.set(...position);
      model.scale.set(...scale);
      model.rotation.set(...rotation);
      model.castShadow = castShadow;
      model.receiveShadow = receiveShadow;
      
      applyMaterialToModel(model, options);
      
      resolve(model);
    }, undefined, reject);
  });
}

/**
 * Return threeJS valid 3D model
 */
const loadGLTF = (
  fileName: string,
  options: ModelOptions = {}
): Promise<{ model: Model, gltf: any }> => {
  const {
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = [1, 1, 1],
    castShadow = false,
    receiveShadow = false,
  } = options;

  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(`/${fileName}`, (gltf) => {
      const model = gltf.scene;
      model.castShadow = castShadow;
      model.receiveShadow = receiveShadow;
      model.position.set(...position);
      model.scale.set(...scale);
      model.rotation.set(...rotation);
      
      applyMaterialToModel(model, options);
      
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
const loadAnimation = (model: Model, fileName: string, index: number = 0): Promise<THREE.AnimationMixer> => {
  return new Promise((resolve) => {
    // Add animation
    const loader = new FBXLoader();
    loader.load(`/${fileName}`, (animation) => {
      const mixer = new THREE.AnimationMixer(model);
      const action = mixer.clipAction((model?.animations?.length ? model : animation).animations[index]);
      action.play();
      resolve(mixer);
    });
  });
}

/**
 * Return all the animations for given filename
 * @param filename 
 * @returns 
 */
const getAnimations = (mixer: THREE.AnimationMixer, filename: string): Promise<Record<string, THREE.AnimationAction>> => {
  return new Promise((resolve) => {
    const loader = new FBXLoader();
    loader.load(`/${filename}`, (animation) => {
      const mixers = animation.animations.reduce((acc, animation) => {
        return {
          ...acc,
          [animation.name]: mixer.clipAction(animation)
        }
      }, {} as Record<string, THREE.AnimationAction>);
      resolve(mixers);
    });
  });
}

/**
 * Populate a given area with a given amount of instances
 * @param config 
 * @param groundSize 
 * @returns 
 */
const getInstanceConfig = (config: InstanceConfig, groundSize: CoordinateTuple) => times(config.amount, () => {
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
const instanceMatrixMesh = (
  mesh: THREE.Mesh,
  scene: THREE.Scene,
  options: ModelOptions[]
): THREE.InstancedMesh<any, any>[] => {
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
      (mesh.material as THREE.MeshStandardMaterial).map = textures.random ? textures.list[Math.floor(Math.random() * textures.list.length)] : textures.list[index % textures.list.length];
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
const instanceMatrixModel = (model: THREE.Group<THREE.Object3DEventMap>, scene: THREE.Scene, options: ModelOptions[]): void => {
  model.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      instanceMatrixMesh(child as THREE.Mesh, scene, options);
    }
  });
}

const cloneModel = (model: Model, scene: THREE.Scene, options: ModelOptions[]): void => {
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
 * @param repeat 
 * @returns 
 */
const getTextures = (img: string, repeat: [number, number] = [10, 10], offset: [number, number] = [0, 0]) => {
  const textureLoader = new THREE.TextureLoader();
  const texture = textureLoader.load(img);

  // Adjust the texture offset and repeat
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.offset.set(offset[0], offset[1]);
  texture.repeat.set(repeat[0], repeat[1]);

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
const getModel = async (
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
    materialType = 'MeshPhysicalMaterial',
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
    animations,
    shape = 'cuboid',
    materialColors,
  }: ModelOptions = {},
): Promise<AnimatedComplexModel> => {
  const initialValues = { size, rotation, position, color }
  const isGLTF = ['glb', '.gltf'].some(extension => path.includes(extension))
  let mesh: Model;
  let gltf: any = {};

  if (isGLTF) {
    const result = await loadGLTF(path, { clearcoat, clearcoatRoughness, ior, thickness, envMapIntensity, position, scale, rotation, color, opacity, material, materialType, reflectivity, roughness, metalness, transmission, texture, castShadow, receiveShadow});
    mesh = result.model;
    gltf = result.gltf;
  } else {
    mesh = await loadFBX(path, { clearcoat, clearcoatRoughness, ior, thickness, envMapIntensity, position, scale, rotation, color, opacity, material, materialType, reflectivity, roughness, metalness, transmission, texture, castShadow, receiveShadow });
  }
  
  // Apply material colors if provided
  if (materialColors && materialColors.length > 0) {
    colorModel(mesh, materialColors);
  }
  
  scene.add(mesh);

  let helper;
  // Add helper model
  if (showHelper) {
    helper = new THREE.BoxHelper(mesh, 0xff0000); // Red color for the helper
    scene.add(helper);
  }
  
  // Add animation
  const mixer = new THREE.AnimationMixer(mesh);
  let actions = {}
  if (animations) {
    actions = await getAnimations(mixer, animations);
  }
  if (gltf.animations?.length) {
    actions = getAnimationsModel(mixer, mesh, gltf);
  }

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
    shape,
    type,
    enabledRotations,
  })
  
  return { mesh, rigidBody, collider, initialValues, actions, mixer, helper: helper as any, type, characterController, hasGravity }
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
const getPhysic = (
  world: RAPIER.World,
  {
    rotation = [0, 0, 0],
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
  if (rotation && rotation instanceof Array) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation));
    rigidBody.setRotation(q, true)
  }
  const colliderShape =
    shape === 'cuboid'
      ? RAPIER.ColliderDesc.cuboid(
          ...(Array.isArray(size) 
            ? (size.map((x) => x * boundary) as CoordinateTuple)
            : [size * boundary, size * boundary, size * boundary] as CoordinateTuple),
        )
      : RAPIER.ColliderDesc.ball((Array.isArray(size) ? size[0] : size) as number)
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
const removeElements = (scene: THREE.Scene, world: RAPIER.World, elements: any[]) => {
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
const colorModel = (mesh: Model, materialColors: number[] = []) => {
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
interface ZigzagTextureOptions {
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
const createZigzagTexture = (options: ZigzagTextureOptions = {}): THREE.CanvasTexture => {
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
const tiltCamera = (camera: THREE.Camera, targetTilt: number, lerpFactor: number = 0.1) => {
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

const onWindowResize = (camera: THREE.Camera, renderer: THREE.WebGLRenderer) => {
  if (camera instanceof THREE.PerspectiveCamera) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
  renderer.setSize(window.innerWidth, window.innerHeight);
};

/**
 * Camera preset configurations for different viewing styles
 */
interface CameraPresetConfig {
  type: 'perspective' | 'orthographic';
  fov?: number;
  position: CoordinateTuple;
  lookAt?: CoordinateTuple;
  near?: number;
  far?: number;
  frustumSize?: number;
  verticalOffset?: number;
}

/**
 * Dictionary of predefined camera presets for common use cases
 */
const cameraPresets: Record<string, CameraPresetConfig> = {
  /**
   * Standard perspective camera with 75° field of view
   * Good for general 3D scenes with natural depth perception
   */
  perspective: {
    type: 'perspective',
    fov: 75,
    position: [0, 5, 20],
    near: 0.1,
    far: 1000,
  },
  
  /**
   * Wide-angle fisheye perspective with 120° field of view
   * Creates dramatic distortion effect, useful for immersive views
   */
  fisheye: {
    type: 'perspective',
    fov: 120,
    position: [0, 5, 20],
    near: 0.1,
    far: 1000,
  },
  
  /**
   * Narrow cinematic perspective with 35° field of view
   * Mimics telephoto lens, reduces distortion, good for dramatic scenes
   */
  cinematic: {
    type: 'perspective',
    fov: 35,
    position: [0, 5, 20],
    near: 0.1,
    far: 1000,
  },
  
  /**
   * Free orbit perspective for user-controlled camera movement
   * Typically used with OrbitControls for interactive exploration
   */
  orbit: {
    type: 'perspective',
    fov: 75,
    position: [0, 10, 15],
    near: 0.1,
    far: 1000,
  },
  
  /**
   * Isometric orthographic camera with elevated diagonal view
   * No perspective distortion, ideal for strategy games and technical views
   */
  orthographic: {
    type: 'orthographic',
    position: [10, 12, 10],
    lookAt: [0, -15, 0],
    frustumSize: 40,
    verticalOffset: 15,
    near: 0.1,
    far: 1000,
  },
  
  /**
   * Following orthographic camera that tracks targets
   * Maintains constant scale while following moving objects
   */
  'orthographic-following': {
    type: 'orthographic',
    position: [0, 5, 20],
    frustumSize: 30,
    verticalOffset: 10,
    near: 0.1,
    far: 1000,
  },
  
  /**
   * Top-down orthographic view
   * Perfect for 2D-style games or map views
   */
  'top-down': {
    type: 'orthographic',
    position: [0, 50, 0],
    lookAt: [0, 0, 0],
    frustumSize: 50,
    verticalOffset: 0,
    near: 0.1,
    far: 1000,
  },
};

/**
 * Apply a predefined camera preset to an existing camera
 * @param camera - The Three.js camera to configure (PerspectiveCamera or OrthographicCamera)
 * @param presetName - Name of the preset from cameraPresets dictionary
 * @param aspect - Optional aspect ratio (defaults to current window aspect ratio)
 * @returns The configured camera, or null if preset not found
 * 
 * @example
 * ```typescript
 * const camera = new THREE.PerspectiveCamera();
 * setCameraPreset(camera, 'cinematic'); // Applies cinematic preset
 * 
 * // With custom aspect ratio
 * setCameraPreset(camera, 'fisheye', 16/9);
 * ```
 */
const setCameraPreset = (
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  presetName: keyof typeof cameraPresets,
  aspect: number = window.innerWidth / window.innerHeight
): THREE.Camera | null => {
  const preset = cameraPresets[presetName];
  
  if (!preset) {
    console.warn(`Camera preset "${presetName}" not found. Available presets: ${Object.keys(cameraPresets).join(', ')}`);
    return null;
  }

  // Set common properties
  camera.position.set(...preset.position);
  
  if (preset.near !== undefined) camera.near = preset.near;
  if (preset.far !== undefined) camera.far = preset.far;

  // Apply preset-specific properties based on camera type
  if (preset.type === 'perspective' && camera instanceof THREE.PerspectiveCamera) {
    if (preset.fov !== undefined) {
      camera.fov = preset.fov;
    }
    camera.aspect = aspect;
  } else if (preset.type === 'orthographic' && camera instanceof THREE.OrthographicCamera) {
    const frustumSize = preset.frustumSize || 40;
    const verticalOffset = preset.verticalOffset || 0;
    
    camera.left = (frustumSize * aspect) / -2;
    camera.right = (frustumSize * aspect) / 2;
    camera.top = frustumSize / 2 + verticalOffset;
    camera.bottom = frustumSize / -2 + verticalOffset;
  }

  // Apply lookAt if specified
  if (preset.lookAt) {
    camera.lookAt(...preset.lookAt);
  }

  camera.updateProjectionMatrix();
  
  return camera;
};

export {
  defaultModelOptions,
  getAnimations,
  getTools,
  getEnvironment,
  getOffset,
  getLookAt,
  setThirdPersonCamera,
  getRenderer,
  createLights,
  getGround,
  getSky,
  loadFBX,
  loadGLTF,
  loadAnimation,
  getInstanceConfig,
  instanceMatrixMesh,
  instanceMatrixModel,
  cloneModel,
  getTextures,
  getModel,
  getPhysic,
  removeElements,
  colorModel,
  createZigzagTexture,
  tiltCamera,
  onWindowResize,
  cameraPresets,
  setCameraPreset,
};
