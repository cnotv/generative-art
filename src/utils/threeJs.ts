import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import RAPIER from '@dimforge/rapier3d';

export const config = {
  show: {
    trees: false,
    grass: true,
    mushrooms: false,
  },
  fov: 60,
  aspect: window.innerWidth / window.innerHeight,
  far: 1000.0,
  offset: {
    x: -20,
    y: 20,
    z: 40
  },
  lookAt: {
    x: 0,
    y: 10,
    z: 50
  },
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
  const renderer = new THREE.WebGLRenderer({ canvas: canvas });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0xaaaaff); // Set background color to black
  renderer.shadowMap.enabled = true; // Enable shadow maps
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Use soft shadows
  return renderer;
}

export const createLights = (scene: THREE.Scene) => {
  // Add directional light with shadows
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
  directionalLight.position.set(5, 5, 5);
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

/**
 * Get default textures
 * @param img 
 * @returns 
 */
export const loadTextures = (img: string) => {
  const textureLoader = new THREE.TextureLoader();
  const texture = textureLoader.load(img);

  // Adjust the texture offset and repeat
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.offset.set(1, 1); // Offset the texture by 50%
  texture.repeat.set(20, 20); // Repeat the texture 0.5 times in both directions

  return texture;
}

/**
 * Create scene ground with physics, texture, and shadow
 * @param size 
 * @param position 
 * @param scene 
 * @param world 
 */
export const getGround = (
  size: CoordinateTuple,
  position: CoordinateTuple,
  scene: THREE.Scene,
  world: RAPIER.World,
  terrainTextureAsset: string
) => {
  // Create and add model
  const texture = loadTextures(terrainTextureAsset);
  const material = new THREE.MeshPhysicalMaterial({
    map: texture,
    reflectivity: 0.3,
  });
  const geometry = new THREE.BoxGeometry( ...size);
  const ground = new THREE.Mesh(geometry, material);
  ground.position.set(...position);
  ground.receiveShadow = true;
  scene.add(ground);

  // Create a dynamic rigid-body.
  let rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(...position);

  // Create a cuboid collider attached to the dynamic rigidBody.
  let colliderDesc = RAPIER.ColliderDesc.cuboid(...size).setTranslation(...position);
  let collider = world.createCollider(colliderDesc);

  return { ground, collider, texture };
}

export const loadFBX = (fileName: string, { position, scale }: ModelOptions = {}): Promise<Model> => {
  return new Promise((resolve, reject) => {
    const loader = new FBXLoader();
    loader.load(`/${fileName}`, (model) => {
      if (position) model.position.set(...position);
      if (scale) model.scale.set(...scale);
      model.castShadow = true;
      model.receiveShadow = false; //default
      model.traverse((child) => {
        if (child.isMesh) {
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
export const loadGLTF = (fileName: string, { position, scale }: ModelOptions = {}): Promise<{ model: Model, gltf: any}> => {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(`/${fileName}`, (gltf) => {
      const model = gltf.scene;
      model.castShadow = true;
      model.receiveShadow = false; //default
      if (position) model.position.set(...position);
      if (scale) model.scale.set(...scale);
      model.traverse((child) => {
        if (child.isMesh) {
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

// https://threejs.org/docs/#api/en/objects/InstancedMesh
export const cloneModel = (model: Model, scene: THREE.Scene, options: ModelOptions[]): Model => {
  options.forEach(({position, rotation, scale}) => {
    const clone = model.clone();
    clone.position.set(...position!);
    clone.rotation.set(...rotation!);
    clone.scale.set(...scale!);
    scene.add(clone);
  });
}
