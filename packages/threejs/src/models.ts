import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import RAPIER from '@dimforge/rapier3d-compat';
import { getAnimationsModel, ComplexModel, Model, CoordinateTuple } from '@webgamekit/animation';
import { ModelOptions } from './types';
import { getPhysic } from './getters';

/**
 * Apply material properties to a mesh
 * @param mesh The mesh to apply materials to
 * @param options Material options
 */
export const applyMaterial = (
  mesh: THREE.Mesh,
  {
    material,
    color,
    opacity,
    reflectivity,
    roughness,
    metalness,
    transmission,
    transparent,
    clearcoat,
    clearcoatRoughness,
    ior,
    thickness,
    envMapIntensity,
  }: ModelOptions
) => {
  if (material) {
    const oldMaterial = mesh.material as any;
    const meshColor = color || (oldMaterial?.color || 0xffffff);
    const materialProps: any = {
      color: meshColor,
      opacity: opacity ?? 1,
      transparent: (opacity ?? 1) < 1,
    };

    if (oldMaterial?.map) {
      materialProps.map = oldMaterial.map;
    }

    if (material === 'MeshPhysicalMaterial') {
      mesh.material = new THREE.MeshPhysicalMaterial({
        ...materialProps,
        reflectivity,
        roughness,
        transmission,
        transparent,
        metalness,
        clearcoat,
        clearcoatRoughness,
        ior,
        thickness,
        envMapIntensity,
      });
    } else if (material === 'MeshStandardMaterial') {
      mesh.material = new THREE.MeshStandardMaterial({
        ...materialProps,
        roughness,
        metalness,
      });
    } else if (material === 'MeshLambertMaterial') {
      mesh.material = new THREE.MeshLambertMaterial({
        ...materialProps,
        flatShading: false,
      });
    } else if (material === 'MeshPhongMaterial') {
      mesh.material = new THREE.MeshPhongMaterial({
        ...materialProps,
        shininess: 30,
      });
    } else if (material === 'MeshBasicMaterial') {
      mesh.material = new THREE.MeshBasicMaterial(materialProps);
    }
  }

  return mesh;
};

export const cloneModel = (model: Model, scene: THREE.Scene, options: ModelOptions[]): void => {
  options.forEach(({ position, rotation, scale }) => {
    const clone = model.clone();
    clone.position.set(...position!);
    clone.rotation.set(...rotation!);
    clone.scale.set(...scale!);
    scene.add(clone);
  });
};

/**
 * Change colors of children contained in a mesh
 * @param mesh 
 * @param materialColors 
 */
export const colorModel = (mesh: Model, materialColors: number[] = []) => {
  let meshIndex = 0;
  mesh.traverse((child: any) => {
    if (child.isMesh && child.material) {
      const material = child.material;
      const targetColor = materialColors[meshIndex % materialColors.length];

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
 * Return all the animations for given filename
 * @param filename 
 * @returns 
 */
export const getAnimations = (mixer: THREE.AnimationMixer, filename: string): Promise<Record<string, THREE.AnimationAction>> => {
  return new Promise((resolve) => {
    const loader = new FBXLoader();
    loader.load(`/${filename}`, (animation) => {
      const mixers = animation.animations.reduce((acc, animation) => {
        return {
          ...acc,
          [animation.name]: mixer.clipAction(animation)
        };
      }, {} as Record<string, THREE.AnimationAction>);
      resolve(mixers);
    });
  });
};

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
    animations,
    shape = 'cuboid',
    materialColors,
  }: ModelOptions = {},
): Promise<ComplexModel> => {
  const initialValues = { size, rotation, position, color };
  const isGLTF = ['glb', '.gltf'].some(extension => path.includes(extension));
  let mesh: Model;
  let gltf: any = {};

  if (isGLTF) {
    const result = await loadGLTF(path, { clearcoat, clearcoatRoughness, ior, thickness, envMapIntensity, position, scale, rotation, color, opacity, material, reflectivity, roughness, metalness, transmission, texture, castShadow, receiveShadow});
    mesh = result.model;
    gltf = result.gltf;
  } else {
    mesh = await loadFBX(path, { clearcoat, clearcoatRoughness, ior, thickness, envMapIntensity, position, scale, rotation, color, opacity, material, reflectivity, roughness, metalness, transmission, texture, castShadow, receiveShadow });
  }

  mesh.traverse((child: any) => {
    if (child.isMesh) {
      child.castShadow = castShadow;
      child.receiveShadow = receiveShadow;
    }
  });

  if (materialColors && materialColors.length > 0) {
    colorModel(mesh, materialColors);
  }

  scene.add(mesh);

  let helper;
  if (showHelper) {
    helper = new THREE.BoxHelper(mesh, 0xff0000);
    scene.add(helper);
  }

  const mixer = new THREE.AnimationMixer(mesh);
  let actions = {};
  if (animations) {
    actions = await getAnimations(mixer, animations);
  }
  if (gltf.animations?.length) {
    actions = getAnimationsModel(mixer, mesh, gltf);
  }

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
  });

  return Object.assign(mesh, {
    userData: {
      body: rigidBody,
      collider,
      initialValues,
      actions,
      mixer,
      helper: helper as any,
      type,
      characterController,
      hasGravity
    }
  });
};

/**
 * Attach animations to a model
 * @param model 
 * @param fileName 
 * @returns 
 */
export const loadAnimation = (model: Model, fileName: string, index: number = 0): Promise<THREE.AnimationMixer> => {
  return new Promise((resolve) => {
    const loader = new FBXLoader();
    loader.load(`/${fileName}`, (animation) => {
      const mixer = new THREE.AnimationMixer(model);
      const action = mixer.clipAction((model?.animations?.length ? model : animation).animations[index]);
      action.play();
      resolve(mixer);
    });
  });
};

export const loadFBX = (
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
 
      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          applyMaterial(child as THREE.Mesh, options);
        }
      });
      
      resolve(model);
    }, undefined, reject);
  });
};

/**
 * Return threeJS valid 3D model
 */
export const loadGLTF = (
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
      
      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          applyMaterial(child as THREE.Mesh, options);
        }
      });
      
      resolve({ model, gltf });
    }, undefined, reject);
  });
};
