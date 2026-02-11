import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import RAPIER from '@dimforge/rapier3d-compat';
import { getAnimationsModel, CoordinateTuple } from '@webgamekit/animation';
import { ModelOptions, ComplexModel, Model } from './types';
import { getPhysic } from './getters';
import { applyOriginTranslation } from './core';

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
    depthWrite,
    alphaTest,
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
    const isTransparent = transparent ?? (opacity ?? 1) < 1;

    // Common properties for all materials that support them
    const baseProperties: any = {
      opacity: opacity ?? 1,
      transparent: isTransparent,
      depthWrite: depthWrite ?? (isTransparent ? false : true),
      alphaTest: alphaTest ?? 0,
    };

    if (oldMaterial?.map) {
      baseProperties.map = oldMaterial.map;
    }

    if (material === 'MeshPhysicalMaterial') {
      const physicalMaterialProperties: any = {
        ...baseProperties,
        color: meshColor,
      };

      if (reflectivity !== undefined) physicalMaterialProperties.reflectivity = reflectivity;
      if (roughness !== undefined) physicalMaterialProperties.roughness = roughness;
      if (transmission !== undefined) physicalMaterialProperties.transmission = transmission;
      if (metalness !== undefined) physicalMaterialProperties.metalness = metalness;
      if (clearcoat !== undefined) physicalMaterialProperties.clearcoat = clearcoat;
      if (clearcoatRoughness !== undefined) physicalMaterialProperties.clearcoatRoughness = clearcoatRoughness;
      if (ior !== undefined) physicalMaterialProperties.ior = ior;
      if (thickness !== undefined) physicalMaterialProperties.thickness = thickness;
      if (envMapIntensity !== undefined) physicalMaterialProperties.envMapIntensity = envMapIntensity;

      mesh.material = new THREE.MeshPhysicalMaterial(physicalMaterialProperties);
    } else if (material === 'MeshStandardMaterial') {
      const standardMaterialProperties: any = {
        ...baseProperties,
        color: meshColor,
      };

      if (roughness !== undefined) standardMaterialProperties.roughness = roughness;
      if (metalness !== undefined) standardMaterialProperties.metalness = metalness;

      mesh.material = new THREE.MeshStandardMaterial(standardMaterialProperties);
    } else if (material === 'MeshLambertMaterial') {
      mesh.material = new THREE.MeshLambertMaterial({
        ...baseProperties,
        color: meshColor,
        flatShading: false,
      });
    } else if (material === 'MeshPhongMaterial') {
      mesh.material = new THREE.MeshPhongMaterial({
        ...baseProperties,
        color: meshColor,
        shininess: 30,
      });
    } else if (material === 'MeshBasicMaterial') {
      mesh.material = new THREE.MeshBasicMaterial({
        ...baseProperties,
        color: meshColor,
      });
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
export const getAnimations = (mixer: THREE.AnimationMixer, filenames: string | string[]): Promise<Record<string, THREE.AnimationAction>> => {
  const files = Array.isArray(filenames) ? filenames : [filenames];
  return new Promise((resolve, reject) => {
    const loader = new FBXLoader();
    const allActions: Record<string, THREE.AnimationAction> = {};
    let loadedCount = 0;
    if (files.length === 0) {
      resolve(allActions);
      return;
    }
    files.forEach((filename) => {
      loader.load(
        `/${filename}`,
        (animation) => {
          animation.animations.forEach((anim) => {
            // Use filename (without extension) as base name
            let baseName = filename.split('/').pop() || filename;
            baseName = baseName.replace(/\.[^./]+$/, "");
            let name = baseName;
            let index = 1;
            while (Object.prototype.hasOwnProperty.call(allActions, name)) {
              name = `${baseName}_${index++}`;
            }
            allActions[name] = mixer.clipAction(anim);
          });
          loadedCount++;
          if (loadedCount === files.length) {
            resolve(allActions);
          }
        },
        undefined,
        (error) => {
          reject(error);
        }
      );
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
    onSpawn,
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
    actions = {...actions, ...await getAnimations(mixer, animations)};
  }
  if (gltf.animations?.length) {
    actions = {...actions, ...getAnimationsModel(mixer, mesh, gltf)};
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

  const complexModel = Object.assign(mesh, {
    userData: {
      body: rigidBody,
      collider,
      initialValues,
      actions,
      mixer,
      helper: helper as any,
      type,
      characterController,
      hasGravity,
      onSpawn
    }
  });

  // Invoke onSpawn callback if provided
  if (onSpawn) {
    onSpawn();
  }

  return complexModel;
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

/**
 * Create a ball with physics, texture, and shadow
 * Friction and bounciness is size based
 * @param scene
 * @param world
 * @param options
 */
export const getBall = (
  scene: THREE.Scene,
  world: RAPIER.World,
  {
    size = 1,
    position = [0, 0, 0],
    color = 0x222222,
    mass = 1,
    density = 1,
    weight = 50,
    friction = 1,
    restitution = 0,
    damping = 0,
    angular = 0,
    opacity = 1,
    reflectivity = 0.5,
    roughness = 1,
    metalness = 0,
    transmission = 0,
    type = 'dynamic',
    castShadow = true,
    showHelper = false,
    hasGravity = false,
    receiveShadow = true,
    material = 'MeshPhysicalMaterial',
    texture,
    onSpawn,
  }: ModelOptions = {},
): ComplexModel => {
  const initialValues = { size, rotation: [0, 0, 0] as CoordinateTuple, position, color };

  // Create and add model
  const geometry = new THREE.SphereGeometry(size as number);
  const mesh = applyMaterial(new THREE.Mesh(geometry), {
    color,
    transmission,
    opacity,
    transparent: opacity < 1,
    reflectivity,
    roughness,
    metalness,
    material,
  });

  if (texture) {
    const textureLoader = new THREE.TextureLoader();
    if (Array.isArray(mesh.material)) {
      (mesh.material[0] as THREE.MeshStandardMaterial).map = textureLoader.load(texture);
    } else {
      (mesh.material as THREE.MeshStandardMaterial).map = textureLoader.load(texture);
    }
  }

  mesh.position.set(...(position as CoordinateTuple));
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  scene.add(mesh);

  const { rigidBody, collider, characterController } = getPhysic(world, {
    position,
    size,
    boundary: 0.8,
    rotation: [0.5, 0.5, 0.5] as CoordinateTuple,
    restitution,
    friction,
    weight,
    density,
    damping,
    angular,
    mass,
    shape: 'ball',
    type,
  });

  let helper;
  if (showHelper) {
    helper = new THREE.BoxHelper(mesh, 0x000000);
    scene.add(helper);
  }

  const complexModel = Object.assign(mesh, {
    userData: {
      body: rigidBody,
      collider,
      initialValues,
      actions: {},
      mixer: undefined,
      helper: helper as any,
      type,
      characterController,
      hasGravity,
      onSpawn
    }
  });

  // Invoke onSpawn callback if provided
  if (onSpawn) {
    onSpawn();
  }

  return complexModel;
};

/**
 * Create a cube with physics, texture, and shadow
 * Friction and bounciness is size based
 * @param scene
 * @param world
 * @param options
 */
export const getCube = (
  scene: THREE.Scene,
  world: RAPIER.World,
  {
    size = [5, 5, 5] as CoordinateTuple,
    rotation = [0, 0, 0] as CoordinateTuple,
    position = [0, 0, 0],
    color = 0x222222,
    mass = 1,
    density = 1,
    weight = 5,
    friction = 1,
    dominance = 0,
    restitution = 1,
    damping = 0,
    angular = 0,
    opacity = 1,
    reflectivity = 0,
    roughness = 1,
    metalness = 0,
    transmission = 0,
    boundary = 0.5,
    castShadow = true,
    receiveShadow = true,
    texture,
    hasGravity = false,
    showHelper = false,
    material = 'MeshPhysicalMaterial',
    type = 'dynamic',
    transparent = false,
    origin = { y: 0 },
    depthWrite = true,
    alphaTest = 0.5,
    renderOrder = 0,
    side,
    onSpawn,
  }: ModelOptions = {},
): ComplexModel => {
  const initialValues = { size, rotation, position, color };

  // Create and add model
  const sizeArray = typeof size === 'number' ? [size, size, size] as CoordinateTuple : size;
  const geometry = new THREE.BoxGeometry(...sizeArray);

  // Apply origin translation to position edges at specified coordinates
  applyOriginTranslation(geometry, sizeArray, origin);

  const mesh = applyMaterial(new THREE.Mesh(geometry), {
    color,
    transmission,
    opacity,
    transparent: transparent ?? opacity < 1,
    reflectivity,
    roughness,
    metalness,
    material,
    depthWrite,
    alphaTest,
    side,
  });

  if (texture) {
    const textureLoader = new THREE.TextureLoader();
    const loadedTexture = textureLoader.load(texture);
    (mesh.material as THREE.MeshStandardMaterial).map = loadedTexture;
  }

  mesh.position.set(...(position as CoordinateTuple));
  mesh.rotation.set(...rotation);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  mesh.renderOrder = renderOrder;
  scene.add(mesh);

  const { rigidBody, collider, characterController } = getPhysic(world, {
    position,
    size,
    rotation,
    restitution,
    friction,
    weight,
    density,
    damping,
    angular,
    dominance,
    boundary,
    mass,
    shape: 'cuboid',
    type,
  });

  let helper;
  if (showHelper) {
    helper = new THREE.BoxHelper(mesh, 0x000000);
    scene.add(helper);
  }

  const complexModel = Object.assign(mesh, {
    userData: {
      body: rigidBody,
      collider,
      initialValues,
      actions: {},
      mixer: undefined,
      helper: helper as any,
      type,
      characterController,
      hasGravity,
      onSpawn
    }
  });

  // Invoke onSpawn callback if provided
  if (onSpawn) {
    onSpawn();
  }

  return complexModel;
};

/**
 * Create walls around a space
 * @param scene
 * @param world
 * @param options
 */
export const getWalls = (
  scene: THREE.Scene,
  world: RAPIER.World,
  {
    length = 200,
    height = 50,
    depth = 0.2,
    opacity = 1,
  } = {},
): ComplexModel[] => {
  return [
    { position: [0, 0, 0], size: [length, depth, length] },
    { position: [-length/2, 0, 0], size: [depth, height, length] },
    { position: [length/2, 0, 0], size: [depth, height, length] },
    { position: [0, 0, length/2], size: [length, height, depth] },
    { position: [0, 0, -length/2], size: [length, height, depth] },
  ].map(({ position, size }) => 
    getCube(scene, world, {
      color: 0xcccccc,
      opacity,
      size: size as CoordinateTuple,
      position: position as CoordinateTuple,
      type: 'fixed',
    })
  );
};
