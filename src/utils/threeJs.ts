import { stats } from './stats';
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import RAPIER from '@dimforge/rapier3d';
import { times } from '@/utils/lodash';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { video } from '@/utils/video';

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
 * @returns 
 */
export const getTools = ({stats, route, canvas}: any  ) => {
  const clock = new THREE.Clock();
  let delta = 0;
  let frame = 0;
  const { renderer, scene, camera, orbit, world } = getEnvironment(canvas, { camera: { position: [-35, 80, -115] } });
  video.record(canvas, route);

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
      camera?: { position?: CoordinateTuple },
      ground?: { size?: number } | false
      lights?: { directional?: { intensity?: number } } | false
    },
    defineSetup?: () => void
  }) => {
    if (config.lights !== false) createLights(scene, {directionalLightIntensity: config?.lights?.directional?.intensity });
    if (config.ground !== false) getGround(scene, world, { size: config?.ground?.size });
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
    timelines = []
  }: {
    beforeTimeline?: () => void,
    afterTimeline?: () => void,
    timelines?: { list: Timeline[], args: any }[]
  }) => { 
    function runAnimation() {
      if (stats) stats.start(route);
      delta = clock.getDelta();
      frame = requestAnimationFrame(runAnimation);
      world.step();
  
      beforeTimeline();
      timelines.forEach(({ list, args }) => animateTimeline(list, frame, args));
      afterTimeline();
  
      orbit.update();
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
    delta,
    frame,
    renderer,
    scene,
    camera,
    orbit,
    world
  }
}

export const getEnvironment = (canvas: HTMLCanvasElement, options: any = {
  camera: { position: [0, 10, -30] },
}) => {
  const gravity = { x: 0.0, y: -9.81, z: 0.0 };
  const world = new RAPIER.World(gravity);
  const renderer = getRenderer(canvas);
  const scene = new THREE.Scene();
  const clock = new THREE.Clock();

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(...(options.camera.position as CoordinateTuple));
  const orbit = new OrbitControls(camera, renderer.domElement);

  return { renderer, scene, camera, clock, orbit, world };
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

export const getRenderer = (canvas: HTMLCanvasElement) => {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0xaaaaff); // Set background color to black
  renderer.shadowMap.enabled = true; // Enable shadow maps
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Use soft shadows
  return renderer;
}

export const createLights = (scene: THREE.Scene, { directionalLightIntensity }: {directionalLightIntensity?: number} = {}) => {
  // Add directional light with shadows
  const directionalLight = new THREE.DirectionalLight(0xffffff, directionalLightIntensity ?? 1.2);
  directionalLight.position.set(5, 10, -2);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 100;

  // Camera frustum
  directionalLight.shadow.camera.left = -200;
  directionalLight.shadow.camera.right = 200;
  directionalLight.shadow.camera.top = 200;
  directionalLight.shadow.camera.bottom = -200;
  directionalLight.shadow.bias = -0.0001;
  scene.add(directionalLight);

  // const shadowCameraHelper = new THREE.CameraHelper(directionalLight.shadow.camera);
  // scene.add(shadowCameraHelper);
  
  const ambientLight = new THREE.AmbientLight( 0xffffff, 0.5 );
  ambientLight.position.set(5, 5, 5);
  scene.add(ambientLight)
  
  return { directionalLight, ambientLight };
}

export const getGround = (
  scene: THREE.Scene,
  world: RAPIER.World,
  {
    size,
    helpers,
    color = 0x333333,
    texture,
  }: any,
) => {
  const geometry = new THREE.PlaneGeometry(size, size)
  const defaultProps = { color }
  const material = new THREE.MeshPhysicalMaterial({
    ...defaultProps,
    ...texture ? { map: getTextures(texture)} : {},
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.rotation.x = -Math.PI / 2 // Rotate the ground to make it horizontal
  mesh.position.set(1, -1, 1)
  mesh.receiveShadow = true
  scene.add(mesh)

  const { rigidBody, collider } = getPhysic(world, {
    position: mesh.position.toArray(),
    size: [size, 2, size],
    boundary: 0.1,
  })

  // HELPER: Create a mesh to visualize the collider
  const helper = new THREE.BoxHelper(mesh, 0x000000)
  if (helpers) {
    scene.add(helper)
  }

  return { mesh, rigidBody, helper, collider }
}

export const loadFBX = (
  fileName: string,
  {
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = [1, 1, 1],
    color,
    opacity = 1,
    reflectivity = 0.5,
    roughness = 1,
    metalness = 0,
    transmission = 0,
  }: ModelOptions = {}
): Promise<Model> => {
  return new Promise((resolve, reject) => {
    const loader = new FBXLoader();
    loader.load(`/${fileName}`, (model) => {
      model.position.set(...position);
      model.scale.set(...scale);
      model.rotation.set(...rotation);
      model.castShadow = true;
      model.receiveShadow = false; 
      model.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshPhysicalMaterial({
            color,
            opacity: 0.9, 
            transparent: opacity < 1,
            reflectivity,
            roughness,
            transmission,
            metalness
          });
          child.rotation.set(...rotation);
          child.castShadow = true;
          child.receiveShadow = true;
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
    color,
    opacity = 1,
    reflectivity = 0.5,
    roughness = 1,
    metalness = 0,
    transmission = 0,
  }: ModelOptions = {}
): Promise<{ model: Model, gltf: any }> => {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(`/${fileName}`, (gltf) => {
      const model = gltf.scene;
      model.castShadow = true;
      model.receiveShadow = false; 
      model.position.set(...position);
      model.scale.set(...scale);
      model.rotation.set(...rotation);
      model.traverse((child) => {
        if (child.isMesh) {
          if (color) {
            child.material = new THREE.MeshPhysicalMaterial({
              color,
              opacity: 0.9, 
              transparent: opacity < 1,
              reflectivity,
              roughness,
              transmission,
              metalness
            });
          }
          child.rotation.set(...rotation);
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      resolve({ model, gltf });
    }, undefined, reject);
  });
}

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
    type = 'dynamic',
    reflectivity = 0.5,
    roughness = 0.1,
    metalness = 0.8,
    transmission = 0.2,
    texture,
  }: ModelOptions = {},
) => {
  const initialValues = { size, rotation, position, color }
  const isGLTF = ['glb', '.gltf'].some(extension => path.includes(extension))
  const { model: mesh } = isGLTF
    ? await loadGLTF(path, { position, scale, rotation, color, opacity, reflectivity, roughness, metalness, transmission })
    : await loadFBX(path, { position, scale, rotation, color, opacity, reflectivity, roughness, metalness, transmission })
  scene.add(mesh);

  const { rigidBody, collider } = getPhysic(world, {
    position,
    size,
    rotation,
    restitution,
    weight,
    density,
    friction,
    boundary,
    angular,
    damping,
    mass,
    shape: 'ball',
    type,
  })
  
  return { mesh, rigidBody, collider, initialValues }
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
  }: PhysicOptions,
) => {
  // Create a fixed rigid body for the brick block
  const rigidBodyDesc = RAPIER.RigidBodyDesc[type]()
    .setTranslation(...position)
    .setGravityScale(weight)
    .setDominanceGroup(dominance)
    .setLinearDamping(damping)
    .setAngularDamping(angular)
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

  return { rigidBody, collider }
}

/**
 * 
 * @param element THREE mesh
 * @param timeline List of actions to perform
 * @param frame Current frame (to do not confuse with delta as for animation)
 * @example
 * // Sequence of 3 animations
  { start: 0, end: 100, action: (mesh) => { mesh.rotation.x += 0.01; } },
  { start: 100, end: 200, action: (mesh) => { mesh.rotation.y += 0.01; } },
  { start: 200, end: 300, action: (mesh) => { mesh.rotation.z += 0.01; } },
  
  // Alternated animations
  { interval: [100, 100], action: (mesh) => { mesh.rotation.y += 0.01; } },
  { delay: 100, interval: [100, 100], action: (mesh) => { mesh.rotation.z += 0.01; } },
 */
export const animateTimeline = <T>(timeline: Timeline[], frame: number, args?: T) => {
  timeline.forEach(({ start, end, frequency, delay, interval, action, actionStart }) => {
    let cycle = 0;
    let frameCycle = 0;
    let loop = 0;
    if (start && frame < start) return;
    if (end && frame > end) return;
    if (delay && frame < delay) return;
    if (interval) {
      const [length, pause] = interval;
      cycle = length + pause;
      frameCycle = (frame + (delay ?? 0) + (start ?? 0)) % cycle;
      loop = frame / cycle;
      if (frameCycle >= length) return;
    }

    if (!frequency || (frequency && frame % frequency === 0)) {
      if (actionStart && frameCycle === 0) {
        actionStart(loop, args);
      } else {
        action(args)
      }
    }
  });
}

/**
 * Bind physic to models to update animation
 * @param elements 
 */
export const bindAnimatedElements = (elements: any[]) => {
  elements.forEach(({ mesh, rigidBody }) => {
    const position = rigidBody.translation();
    mesh.position.set(position.x, position.y, position.z);
    const rotation = rigidBody.rotation();
    mesh.rotation.set(rotation.x, rotation.y, rotation.z);
  });
}

/**
 * Reset models and bodies to their initial state
 * @param elements 
 */
export const resetAnimation = (elements: any[]) => {
  elements.forEach(({ rigidBody, initialValues: { position: [x, y, z]} }) => {
    rigidBody.resetForces(true);
    rigidBody.resetTorques(true);
    rigidBody.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    rigidBody.setTranslation({ x, y, z }, true);
  });

  return elements;
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
