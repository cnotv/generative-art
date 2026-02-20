import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { times } from './utils/lodash';
import { CoordinateTuple, Model } from '@webgamekit/animation';
import { GeneratedInstanceConfig, InstanceConfig, PhysicOptions } from './types';

/**
 * Initialize typical configuration for ThreeJS and Rapier for a given canvas.
 * @param canvas 
 * @param options 
 * @returns 
 */
export const getEnvironment = async (canvas: HTMLCanvasElement, options: any = {
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
};

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
    size = [1000, 0.01, 1000],
    position = [1, -1, 1],
    helpers,
    color = 0x333333,
    texture,
    textureRepeat = [10, 10],
    textureOffset = [0, 0],
  }: {
    size?: CoordinateTuple | number,
    position?: CoordinateTuple,
    helpers?: boolean,
    color?: number,
    texture?: string,
    textureRepeat?: [number, number],
    textureOffset?: [number, number],
  },
) => {
  const defaultProps = { color };
  const groundSizes: CoordinateTuple = Array.isArray(size) ? size : [size, 0.01, size];
  position[1] = position[1] - (groundSizes[1] || 0.01) / 2;
  const geometry = new THREE.BoxGeometry(...groundSizes);
  const material = new THREE.MeshStandardMaterial({
    ...defaultProps,
    ...texture ? { map: getTextures(texture, textureRepeat, textureOffset)} : {},
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'ground';
  mesh.receiveShadow = true;
  mesh.position.set(...position);
  mesh.userData.physics = { mass: 0 };

  scene.add(mesh);

  const { rigidBody, collider } = getPhysic(world, {
    position: mesh.position.toArray(),
    size: groundSizes,
    boundary: 0.5,
  });

  const helper = new THREE.BoxHelper(mesh, 0x000000);
  if (helpers) {
    scene.add(helper);
  }

  return { mesh, rigidBody, helper, collider };
};

/**
 * Populate a given area with a given amount of instances
 * @param {InstanceConfig} config - Instance configuration object
 * @param {number} [config.amount] - Number of instances to create
 * @param {CoordinateTuple} [config.size] - Base size [x, y, z] of each instance
 * @param {CoordinateTuple} [config.sizeVariation] - Random size variation [x, y, z] to add to base size
 * @param {CoordinateTuple} [config.position] - Base position [x, y, z] of instances
 * @param {CoordinateTuple} [config.positionVariation] - Random position variation [x, y, z] range
 * @param {CoordinateTuple} [config.rotation] - Base rotation [x, y, z] in degrees
 * @param {CoordinateTuple} [config.rotationVariation] - Random rotation variation [x, y, z] range in degrees
 * @param {number} [config.area] - Area divisor for legacy positioning
 * @param {number} [config.ratio] - Width to height ratio multiplier (legacy)
 * @param {number} [config.spacing] - Spacing between instances along X axis (legacy)
 * @param {number} [config.opacity] - Opacity value (stored but not used in generation)
 * @param {CoordinateTuple} groundSize - Ground dimensions [width, height, depth]
 * @returns {GeneratedInstanceConfig} Array of instance configurations
 */
export const getInstanceConfig = ({
  size = [1, 1, 1],
  sizeVariation = [0, 0, 0],
  position = [0, 0, 0],
  positionVariation = [0, 0, 0],
  rotation = [0, 0, 0],
  rotationVariation = [0, 0, 0],
  amount = 1,
  ratio = 1,
  spacing = 0,
  textures
}: InstanceConfig): GeneratedInstanceConfig => {
  const generatedConfig =  times(amount, (index) => {
    const newSize: CoordinateTuple = [
      size[0] + (Math.random() - 0.5) * sizeVariation[0],
      size[1] + (Math.random() - 0.5) * sizeVariation[1],
      size[2] + (Math.random() - 0.5) * sizeVariation[2],
    ];
    
    const baseX = index * spacing - (amount * spacing) / 2;
    const xVariable = positionVariation[0] > 0 ? (Math.random() - 0.5) * positionVariation[0] : 0;
    const newPosition: CoordinateTuple = [
      baseX + xVariable,
      position[1] + (Math.random() - 0.5) * positionVariation[1],
      position[2] + (Math.random() - 0.5) * positionVariation[2],
    ];
    
    // Calculate rotation with variation
    const newRotation: CoordinateTuple = [
      rotation[0] + (Math.random() - 0.5) * rotationVariation[0],
      rotation[1] + (Math.random() - 0.5) * rotationVariation[1],
      rotation[2] + (Math.random() - 0.5) * rotationVariation[2],
    ];
    
    const scale: CoordinateTuple = ratio !== 1 
      ? [newSize[0] * ratio, newSize[1], newSize[2]]
      : newSize;

    return {
      position: newPosition,
      rotation: newRotation,
      scale,
      textures
    };
  });

  return generatedConfig;
};

/**
 * Create and return default lights
 * @param scene 
 * @returns 
 */
export const getLights = (scene: THREE.Scene, config: any = {}) => {
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
          left: -150,
          right: 150,
          top: 150,
          bottom: -150
        },
        bias: -0.0001,
        radius: 1
      }
    },
    hemisphere
  } = config;

  if (hemisphere?.colors) {
    const hemisphereLight = new THREE.HemisphereLight(...hemisphere.colors);
    scene.add(hemisphereLight);
  }
  
  const ambientLight = new THREE.AmbientLight(ambient.color, ambient.intensity);
  ambientLight.name = 'ambient-light';
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(
    directional.color,
    directional.intensity
  );
  directionalLight.name = 'directional-light';
  if (directional.position) directionalLight.position.set(...(directional.position as CoordinateTuple));
  directionalLight.castShadow = directional.castShadow ?? true;

  // Always apply shadow camera defaults so scenes that omit the shadow key
  // still get a large-enough frustum (Three.js default is only ~±5 units).
  const shadow = directional.shadow ?? {};
  const shadowCam = shadow.camera ?? {};
  const mapSize = shadow.mapSize ?? {};
  directionalLight.shadow.mapSize.width = mapSize.width ?? 4096;
  directionalLight.shadow.mapSize.height = mapSize.height ?? 4096;
  directionalLight.shadow.camera.near = shadowCam.near ?? 0.5;
  directionalLight.shadow.camera.far = shadowCam.far ?? 500;
  directionalLight.shadow.camera.left = shadowCam.left ?? -150;
  directionalLight.shadow.camera.right = shadowCam.right ?? 150;
  directionalLight.shadow.camera.top = shadowCam.top ?? 150;
  directionalLight.shadow.camera.bottom = shadowCam.bottom ?? -150;
  if (shadow.bias !== undefined) directionalLight.shadow.bias = shadow.bias;
  if (shadow.radius !== undefined) directionalLight.shadow.radius = shadow.radius;
  
  directionalLight.shadow.camera.updateProjectionMatrix();
  scene.add(directionalLight);
  
  return { directionalLight, ambientLight };
};

export const getOffset = (model: Model, config: any) => {
  const { x, y, z } = config.offset;
  const offset = new THREE.Vector3(x, y, z);
  offset.applyQuaternion(model.quaternion);
  offset.add(model.position);
  return offset;
};

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
  const rigidBodyDesc = RAPIER.RigidBodyDesc[type]()
    .setTranslation(...position)
    .setGravityScale(weight)
    .setDominanceGroup(dominance)
    .setLinearDamping(damping)
    .setAngularDamping(angular)
    .enabledRotations(...enabledRotations as [boolean, boolean, boolean]);
  const rigidBody = world.createRigidBody(rigidBodyDesc);
  if (rotation && rotation instanceof Array) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation));
    rigidBody.setRotation(q, true);
  }
  const colliderShape =
    shape === 'cuboid'
      ? RAPIER.ColliderDesc.cuboid(
          ...(Array.isArray(size) 
            ? (size.map((x) => x * boundary) as CoordinateTuple)
            : [size * boundary, size * boundary, size * boundary] as CoordinateTuple),
        )
      : RAPIER.ColliderDesc.ball((Array.isArray(size) ? size[0] : size) as number);
  const colliderDesc = colliderShape
    .setRestitution(restitution)
    .setFriction(friction)
    .setMass(mass)
    .setDensity(density);
  const collider = world.createCollider(colliderDesc, rigidBody);
  
  let characterController;
  if (type === 'kinematicPositionBased') {
    characterController = world.createCharacterController(0.01);
    characterController.setUp({ x: 0, y: 1, z: 0 });
    characterController.enableSnapToGround(0);
    characterController.setMaxSlopeClimbAngle(45);
    characterController.setMinSlopeSlideAngle(30);
  }
  
  return { rigidBody, collider, characterController };
};

export const getRenderer = (canvas: HTMLCanvasElement): THREE.WebGLRenderer => {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0xaaaaff);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
};

export const getSky = (
  scene: THREE.Scene,
  {
    color = 0xaaaaff,
    size = 1000,
    texture
  }: {
    color?: number,
    texture?: string,
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
  const model = new THREE.Mesh(skyGeometry, skyMaterial);
  model.name = 'sky';
  scene.add(model);
  return { model };
};

/**
 * Get default textures
 * @param img 
 * @param repeat 
 * @returns 
 */
export const getTextures = (img: string, repeat: [number, number] = [1, 1], offset: [number, number] = [0, 0]) => {
  const textureLoader = new THREE.TextureLoader();
  const texture = textureLoader.load(img);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.offset.set(offset[0], offset[1]);
  texture.repeat.set(repeat[0], repeat[1]);
  return texture;
};
