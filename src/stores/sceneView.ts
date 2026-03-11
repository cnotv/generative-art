import { defineStore } from 'pinia';
import { ref } from 'vue';
import * as THREE from 'three';
import { getTools, getCube, generateAreaPositions } from '@webgamekit/threejs';
import type { SetupConfig, CoordinateTuple, AreaConfig } from '@webgamekit/threejs';
import { createTimelineManager } from '@webgamekit/animation';
import { usePanelsStore } from '@/stores/panels';
import { useViewPanelsStore } from '@/stores/viewPanels';
import { useDebugSceneStore } from '@/stores/debugScene';
import type { SceneElement } from '@/stores/debugScene';
import { useElementPropertiesStore } from '@/stores/elementProperties';
import { useTextureGroupsStore } from '@/stores/textureGroups';
import type { TextureGroup, GroupConfig } from '@/stores/textureGroups';
import { addGroupMeshes, removeGroupMeshes } from '@/utils/groupMeshes';
import { toggleObjectVisibility, updateCameraFov, replaceGeometry } from '@/utils/threeObjectUpdaters';
import { cameraSchema, groundSchema, lightsSchema, skySchema, configControls } from '@/views/Tools/SceneEditor/config';

type Vec3 = { x: number; y: number; z: number };
type OrbitControls = { target: THREE.Vector3; update: () => void; addEventListener: (event: string, callback: () => void) => void };

const getNestedValue = (object: Record<string, unknown>, path: string): unknown =>
  path.split('.').reduce<unknown>((current, key) => (current as Record<string, unknown>)?.[key], object);

const setNestedValueImmutable = (
  object: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> => {
  const [first, ...rest] = path.split('.');
  if (rest.length === 0) {
    return { ...object, [first]: value };
  }
  return {
    ...object,
    [first]: setNestedValueImmutable(
      ((object[first] ?? {}) as Record<string, unknown>),
      rest.join('.'),
      value
    ),
  };
};

interface TextureGroupDefinition {
  id: string;
  name: string;
  textures: { id: string; name: string; filename: string; url: string }[];
}

interface DefineSetupContext {
  ground: { mesh?: THREE.Mesh } | null;
  scene: THREE.Scene;
  camera: THREE.Camera;
  world: import('@dimforge/rapier3d-compat').default.World;
  getDelta: () => number;
  clock: THREE.Clock;
  animate: (options: {
    beforeTimeline?: () => void;
    afterTimeline?: () => void;
    timeline: ReturnType<typeof createTimelineManager>;
  }) => void;
}

export interface InitOptions {
  defineSetup?: (context: DefineSetupContext) => Promise<void> | void;
  viewPanels?: Record<string, boolean>;
  playMode?: boolean;
}

export interface TextureAreaDefinition {
  name: string;
  schema: Record<string, unknown>;
  initialData: Record<string, unknown>;
  meshPrefix: string;
  textures?: { id: string; name: string; filename: string; url: string }[];
}

export const useSceneViewStore = defineStore('sceneView', () => {
  // Per-section reactive config refs (immutable updates via .value replacement)
  const cameraConfig = ref<Record<string, unknown>>({});
  const groundConfig = ref<Record<string, unknown>>({});
  const lightsConfig = ref<Record<string, unknown>>({});
  const skyConfig = ref<Record<string, unknown>>({});
  const groupConfigs = ref<Record<string, Record<string, unknown>>>({});

  const threeScene = ref<THREE.Scene | null>(null);
  const threeWorld = ref<unknown>(null);
  const threeCamera = ref<THREE.Camera | null>(null);
  const orbitReference = ref<OrbitControls | null>(null);
  const groundReference = ref<{ mesh?: THREE.Mesh } | null>(null);
  const ambientLightReference = ref<THREE.Light | null>(null);
  const directionalLightReference = ref<THREE.Light | null>(null);
  const skyMeshReference = ref<THREE.Mesh | null>(null);
  const isInitialized = ref(false);
  const playMode = ref(false);
  const textureAreaConfigs = ref<Record<string, Record<string, unknown>>>({});
  const textureAreaDefinitions = ref<TextureAreaDefinition[]>([]);
  const areaMeshCache = ref<Record<string, THREE.Object3D[]>>({});

  const panelsStore = usePanelsStore();
  const viewPanelsStore = useViewPanelsStore();
  const debugSceneStore = useDebugSceneStore();
  const elementPropertiesStore = useElementPropertiesStore();
  const textureStore = useTextureGroupsStore();

  const getAreaMeshes = (areaName: string): THREE.Object3D[] =>
    areaMeshCache.value[areaName] ?? [];

  const buildAreaMeshCache = () => {
    const scene = threeScene.value;
    if (!scene) return;

    areaMeshCache.value = textureAreaDefinitions.value.reduce<Record<string, THREE.Object3D[]>>(
      (cache, area) => {
        const prefix = `${area.meshPrefix}-`;
        return {
          ...cache,
          [area.name]: scene.children.filter(child => child.name?.startsWith(prefix)),
        };
      },
      {}
    );
  };

  const buildSceneElements = (): SceneElement[] => {
    const scene = threeScene.value;
    const camera = threeCamera.value;
    if (!scene || !camera) return [];

    const textureGroups = textureStore.groups;
    const cachedMeshNames = new Set(
      Object.values(areaMeshCache.value).flatMap(meshes => meshes.map(m => m.name))
    );
    const cameraElement: SceneElement = { name: 'Camera', type: camera.type, hidden: false };

    const sceneChildren: SceneElement[] = scene.children
      .filter(child => !cachedMeshNames.has(child.name))
      .map(child => {
        const groupId = textureGroups.find(g =>
          child.name?.startsWith(`grp-${g.id}-`) || child.name === `wireframe-${g.id}`
        )?.id;
        return {
          name: child.name || child.type,
          type: groupId ? 'TextureArea' : child.type,
          hidden: false,
          groupId,
        };
      });

    const textureGroupElements: SceneElement[] = textureGroups.map(g => ({
      name: g.id,
      type: 'TextureArea',
      hidden: false,
      groupId: g.id,
    }));

    return [cameraElement, ...sceneChildren, ...textureGroupElements];
  };

  const updateSceneElements = () => {
    const defaultGroups = Object.fromEntries(
      textureStore.groups.map(g => [g.id, g.name])
    );

    debugSceneStore.setSceneElements(
      buildSceneElements(),
      {
        onToggleVisibility: (name: string) => {
          const scene = threeScene.value;
          const camera = threeCamera.value;
          if (!scene) return;

          // Check if it's a texture area
          const cachedMeshes = getAreaMeshes(name);
          if (cachedMeshes.length > 0) {
            cachedMeshes.forEach(child => toggleObjectVisibility(child));
          } else {
            const object = name === 'Camera'
              ? (camera as unknown as THREE.Object3D)
              : scene.getObjectByName(name);
            if (object) toggleObjectVisibility(object);
          }

          debugSceneStore.$patch({
            sceneElements: debugSceneStore.sceneElements.map(
              element => element.name === name ? { ...element, hidden: !element.hidden } : element
            ),
          });
        },
        onRemove: (name: string) => {
          const scene = threeScene.value;
          if (!scene) return;

          // Check if it's a texture area
          const cachedMeshes = getAreaMeshes(name);
          if (cachedMeshes.length > 0) {
            cachedMeshes.forEach(mesh => scene.remove(mesh));
            const { [name]: _removed, ...remainingCache } = areaMeshCache.value;
            areaMeshCache.value = remainingCache;
            textureAreaDefinitions.value = textureAreaDefinitions.value.filter(a => a.name !== name);
            elementPropertiesStore.unregisterElementProperties(name);
          } else {
            const object = scene.getObjectByName(name);
            if (object) scene.remove(object);
          }
          updateSceneElements();
        },
      },
      defaultGroups
    );
  };

  const applyCameraUpdate = (path: string, value: unknown) => {
    const camera = threeCamera.value;
    const orbit = orbitReference.value;
    if (!camera) return;
    if (path === 'fov' && camera instanceof THREE.PerspectiveCamera) {
      updateCameraFov(camera, value as number);
    } else if (path === 'position') {
      const pos = value as Vec3;
      camera.position.set(pos.x, pos.y, pos.z);
    } else if (path === 'orbitTarget' && orbit) {
      const target = value as Vec3;
      orbit.target.set(target.x, target.y, target.z);
      orbit.update();
    }
  };

  const applyGroundUpdate = (path: string, value: unknown) => {
    const ground = groundReference.value;
    if (!ground?.mesh) return;
    if (path === 'color') {
      (ground.mesh.material as THREE.MeshStandardMaterial).color.set(value as number);
    } else if (path === 'size') {
      const size = value as Vec3;
      replaceGeometry(ground.mesh, new THREE.BoxGeometry(size.x, size.y, size.z));
    }
  };

  const applyLightsUpdate = (path: string, value: unknown) => {
    const [group, field] = path.split('.');
    if (group === 'ambient' && ambientLightReference.value) {
      if (field === 'intensity') ambientLightReference.value.intensity = value as number;
      else if (field === 'color') ambientLightReference.value.color.set(value as number);
    } else if (group === 'directional' && directionalLightReference.value) {
      if (field === 'intensity') directionalLightReference.value.intensity = value as number;
      else if (field === 'color') directionalLightReference.value.color.set(value as number);
      else if (field === 'position') {
        const pos = value as Vec3;
        directionalLightReference.value.position.set(pos.x, pos.y, pos.z);
      }
    }
  };

  const applySkyUpdate = (path: string, value: unknown) => {
    const mesh = skyMeshReference.value;
    if (!mesh) return;
    if (path === 'color') {
      (mesh.material as THREE.MeshBasicMaterial).color.set(value as number);
    } else if (path === 'size') {
      replaceGeometry(mesh, new THREE.SphereGeometry(value as number, 32, 32));
    }
  };

  const registerCameraProperties = () => {
    if (Object.keys(cameraConfig.value).length === 0) return;

    elementPropertiesStore.registerElementProperties('Camera', {
      title: 'Camera',
      type: 'camera',
      schema: cameraSchema,
      getValue: (path) => getNestedValue(cameraConfig.value, path),
      updateValue: (path, value) => {
        cameraConfig.value = setNestedValueImmutable(cameraConfig.value, path, value);
        applyCameraUpdate(path, value);
      },
    });
  };

  const registerGroundProperties = () => {
    if (Object.keys(groundConfig.value).length === 0) return;

    elementPropertiesStore.registerElementProperties('ground', {
      title: 'Ground',
      schema: groundSchema,
      getValue: (path) => getNestedValue(groundConfig.value, path),
      updateValue: (path, value) => {
        groundConfig.value = setNestedValueImmutable(groundConfig.value, path, value);
        applyGroundUpdate(path, value);
      },
    });
  };

  const registerLightsProperties = () => {
    if (Object.keys(lightsConfig.value).length === 0) return;

    elementPropertiesStore.registerElementProperties('lights', {
      title: 'Lights',
      schema: lightsSchema,
      getValue: (path) => getNestedValue(lightsConfig.value, path),
      updateValue: (path, value) => {
        lightsConfig.value = setNestedValueImmutable(lightsConfig.value, path, value);
        applyLightsUpdate(path, value);
      },
    });
  };

  const registerSkyProperties = () => {
    if (Object.keys(skyConfig.value).length === 0) return;

    elementPropertiesStore.registerElementProperties('sky', {
      title: 'Sky',
      schema: skySchema,
      getValue: (path) => getNestedValue(skyConfig.value, path),
      updateValue: (path, value) => {
        skyConfig.value = setNestedValueImmutable(skyConfig.value, path, value);
        applySkyUpdate(path, value);
      },
    });
  };

  const getGroupConfig = (groupId: string): GroupConfig => {
    const config = groupConfigs.value[groupId] as unknown as GroupConfig | undefined;
    return config ?? textureStore.createDefaultGroupConfig();
  };

  const regenerateGroup = (groupId: string) => {
    const scene = threeScene.value;
    const group = textureStore.groups.find(g => g.id === groupId);
    if (!scene || !group) return;
    removeGroupMeshes(scene, groupId);
    addGroupMeshes(scene, threeWorld.value, group, getGroupConfig);
  };

  const registerGroupProperties = (group: TextureGroup) => {
    const config = groupConfigs.value[group.id];
    if (!config) return;

    elementPropertiesStore.registerElementProperties(group.id, {
      title: group.name,
      type: 'group',
      schema: configControls,
      getValue: (path) => getNestedValue(groupConfigs.value[group.id], path),
      updateValue: (path, value) => {
        groupConfigs.value = {
          ...groupConfigs.value,
          [group.id]: setNestedValueImmutable(groupConfigs.value[group.id], path, value),
        };
        if (textureStore.autoUpdate) {
          regenerateGroup(group.id);
        }
      },
    });
  };

  const HALF = 0.5;

  const regenerateTextureArea = (area: TextureAreaDefinition) => {
    const scene = threeScene.value;
    const world = threeWorld.value;
    if (!scene) return;

    // Remove old meshes
    getAreaMeshes(area.name).forEach(mesh => scene.remove(mesh));

    // Get updated config
    const config = textureAreaConfigs.value[area.name] as unknown as GroupConfig;
    if (!config?.area || !config?.textures || !config?.instances) return;

    const group = textureStore.groups.find(g => g.id === area.name);
    const textures = group?.textures ?? [];
    if (textures.length === 0) return;

    // Generate positions from config
    const areaConfig: AreaConfig = {
      center: config.area.center,
      size: config.area.size,
      count: Math.min(2000, Math.max(1, Math.round(config.instances.density))),
      pattern: config.instances.pattern,
      seed: config.instances.seed,
      sizeVariation: config.textures.sizeVariation,
      rotationVariation: config.textures.rotationVariation,
    };

    const allPositions = generateAreaPositions(areaConfig);
    const { baseSize, sizeVariation, rotationVariation } = config.textures;
    const hasVariation = sizeVariation.some(v => v !== 0) || rotationVariation.some(v => v !== 0);

    const newMeshes = allPositions.map((position: CoordinateTuple, index: number) => {
      const textureIndex = Math.floor(Math.random() * textures.length);
      const meshSize: CoordinateTuple = hasVariation
        ? [
            baseSize[0] + (Math.random() - HALF) * sizeVariation[0],
            baseSize[1] + (Math.random() - HALF) * sizeVariation[1],
            baseSize[2] + (Math.random() - HALF) * sizeVariation[2],
          ]
        : baseSize;
      const meshRotation: CoordinateTuple = hasVariation
        ? [
            (Math.random() - HALF) * rotationVariation[0],
            (Math.random() - HALF) * rotationVariation[1],
            (Math.random() - HALF) * rotationVariation[2],
          ]
        : [0, 0, 0];

      return getCube(scene, world, {
        name: `${area.meshPrefix}-${index}`,
        size: meshSize,
        position,
        rotation: meshRotation,
        texture: textures[textureIndex].url,
        material: 'MeshBasicMaterial',
        color: 0x000000,
        transparent: true,
        castShadow: false,
        receiveShadow: false,
        physic: false,
      });
    });

    // Update cache
    areaMeshCache.value = { ...areaMeshCache.value, [area.name]: newMeshes };
  };

  const registerTextureAreas = (areas: TextureAreaDefinition[]) => {
    textureAreaDefinitions.value = [...textureAreaDefinitions.value, ...areas];

    textureAreaConfigs.value = areas.reduce(
      (accumulator, area) => ({
        ...accumulator,
        [area.name]: { ...area.initialData },
      }),
      { ...textureAreaConfigs.value }
    );

    // Register as texture groups for ElementGroup rendering
    textureStore.$patch({
      groups: [
        ...textureStore.groups,
        ...areas.map(area => ({
          id: area.name,
          name: area.name,
          textures: area.textures ?? [],
        })),
      ],
    });

    // Register handlers for texture area interactions
    textureStore.registerHandlers({
      onSelectGroup: (id) => {
        elementPropertiesStore.openElementProperties(id);
      },
      onRemoveGroup: (id) => {
        const scene = threeScene.value;
        if (scene) {
          getAreaMeshes(id).forEach(mesh => scene.remove(mesh));
        }
        const { [id]: _removed, ...remainingCache } = areaMeshCache.value;
        areaMeshCache.value = remainingCache;
        textureStore.$patch({
          groups: textureStore.groups.filter(g => g.id !== id),
        });
        textureAreaDefinitions.value = textureAreaDefinitions.value.filter(a => a.name !== id);
        elementPropertiesStore.unregisterElementProperties(id);
        updateSceneElements();
      },
      onRemoveTexture: () => {},
      onToggleVisibility: (id) => {
        const group = textureStore.groups.find(g => g.id === id);
        if (!group) return;

        const newHidden = !group.hidden;
        textureStore.$patch({
          groups: textureStore.groups.map(
            g => g.id === id ? { ...g, hidden: newHidden } : g
          ),
        });

        getAreaMeshes(id).forEach(child => toggleObjectVisibility(child));
      },
      onToggleWireframe: (id) => {
        const scene = threeScene.value;
        const world = threeWorld.value;
        const group = textureStore.groups.find(g => g.id === id);
        const config = textureAreaConfigs.value[id] as unknown as GroupConfig;
        if (!group || !scene || !config?.area) return;

        const newShowWireframe = !group.showWireframe;
        textureStore.$patch({
          groups: textureStore.groups.map(
            g => g.id === id ? { ...g, showWireframe: newShowWireframe } : g
          ),
        });

        const wireframeName = `wireframe-${id}`;
        const existing = scene.getObjectByName(wireframeName);
        if (existing) {
          scene.remove(existing);
        }
        if (newShowWireframe) {
          getCube(scene, world, {
            name: wireframeName,
            size: config.area.size,
            position: config.area.center,
            color: 0x00ff00,
            material: 'MeshBasicMaterial',
            wireframe: true,
            castShadow: false,
            receiveShadow: false,
            physic: false,
          });
        }
      },
      onAddTextureToGroup: () => {},
      onAddNewGroup: () => {},
      onManualUpdate: () => {
        textureAreaDefinitions.value.forEach(area => regenerateTextureArea(area));
      },
      onAddElement: () => {},
    });

    // Register element properties for each area
    areas.forEach(area => {
      elementPropertiesStore.registerElementProperties(area.name, {
        title: area.name,
        type: 'TextureArea',
        schema: configControls,
        getValue: (path) => getNestedValue(textureAreaConfigs.value[area.name], path),
        updateValue: (path, value) => {
          textureAreaConfigs.value = {
            ...textureAreaConfigs.value,
            [area.name]: setNestedValueImmutable(textureAreaConfigs.value[area.name], path, value),
          };
          if (textureStore.autoUpdate) {
            regenerateTextureArea(area);
          }
        },
      });
    });

    // Set scene group labels
    const areaGroups = Object.fromEntries(areas.map(a => [a.name, a.name]));
    debugSceneStore.$patch({ sceneGroups: { ...debugSceneStore.sceneGroups, ...areaGroups } });

    buildAreaMeshCache();
    updateSceneElements();
  };

  const init = async (canvas: HTMLCanvasElement, config: SetupConfig, options?: InitOptions) => {
    playMode.value = options?.playMode ?? false;

    // Build reactive config sections from SetupConfig
    if (config.camera) {
      const position = config.camera.position as number[] | undefined;
      cameraConfig.value = {
        position: { x: position?.[0] ?? 0, y: position?.[1] ?? 20, z: position?.[2] ?? 150 },
        fov: config.camera.fov ?? 75,
        orbitTarget: { x: 0, y: 0, z: 0 },
      };
    }
    if (config.ground && config.ground !== false) {
      const ground = config.ground as { color?: number; size?: number | number[] };
      const size = ground.size;
      groundConfig.value = {
        color: ground.color ?? 0x333333,
        size: Array.isArray(size)
          ? { x: size[0], y: size[1], z: size[2] }
          : { x: size ?? 100, y: 0.1, z: size ?? 100 },
      };
    }
    if (config.lights && config.lights !== false) {
      lightsConfig.value = JSON.parse(JSON.stringify(config.lights));
    }
    if (config.sky && config.sky !== false) {
      skyConfig.value = JSON.parse(JSON.stringify(config.sky));
    }

    const { setup, animate: toolsAnimate, scene, camera, world, getDelta, clock } = await getTools({ canvas });

    let ground: { mesh?: THREE.Mesh } | null = null;
    let orbit: OrbitControls | null = null;

    if (options?.defineSetup) {
      const result = await setup({
        config,
        defineSetup: async (setupContext) => {
          await options.defineSetup!({
            ground: setupContext.ground,
            scene,
            camera,
            world,
            getDelta,
            clock,
            animate: toolsAnimate,
          });
        },
      });
      ground = result.ground;
      orbit = result.orbit as OrbitControls;
    } else {
      const result = await setup({ config });
      ground = result.ground;
      orbit = result.orbit as OrbitControls;
      toolsAnimate({ timeline: createTimelineManager() });
    }

    threeScene.value = scene;
    threeCamera.value = camera;
    threeWorld.value = world;
    orbitReference.value = orbit;
    groundReference.value = ground;

    ambientLightReference.value = (scene.getObjectByName('ambient-light') as THREE.Light) ?? null;
    directionalLightReference.value = (scene.getObjectByName('directional-light') as THREE.Light) ?? null;
    skyMeshReference.value = (scene.getObjectByName('sky') as THREE.Mesh) ?? null;

    // Register element properties for each config section
    registerCameraProperties();
    if (config.ground !== false) registerGroundProperties();
    if (config.lights !== false) registerLightsProperties();
    if (config.sky !== false) registerSkyProperties();

    // Sync orbit controls → camera config (skip in play mode to avoid per-frame reactivity)
    if (!playMode.value) {
      const orbitDisabled = config.orbit && 'disabled' in config.orbit && config.orbit.disabled;
      if (!orbitDisabled) {
        orbit?.addEventListener('change', () => {
          cameraConfig.value = {
            ...cameraConfig.value,
            position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
            orbitTarget: orbit
              ? { x: orbit.target.x, y: orbit.target.y, z: orbit.target.z }
              : cameraConfig.value.orbitTarget,
          };
        });
      }
    }

    // Open panels
    viewPanelsStore.setViewPanels(options?.viewPanels ?? {});
    panelsStore.openPanel('elements');

    updateSceneElements();
    isInitialized.value = true;
  };

  const initTextureGroups = (
    groups: TextureGroupDefinition[],
    defaultGroups: Record<string, string>,
    initialConfigs?: Record<string, GroupConfig>
  ) => {
    // Store group configs immutably
    groupConfigs.value = groups.reduce(
      (accumulator, group) => ({
        ...accumulator,
        [group.id]: (groupConfigs.value[group.id]
          ?? (initialConfigs?.[group.id] as unknown as Record<string, unknown>)
          ?? textureStore.createDefaultGroupConfig()) as unknown as Record<string, unknown>,
      }),
      { ...groupConfigs.value }
    );

    // Add groups to texture store immutably
    textureStore.$patch({
      groups: [
        ...textureStore.groups,
        ...groups.map(g => ({
          id: g.id,
          name: g.name,
          textures: [...g.textures],
        })),
      ],
    });

    // Register texture group handlers
    textureStore.registerHandlers({
      onSelectGroup: (id) => {
        elementPropertiesStore.openElementProperties(id);
      },
      onRemoveGroup: (id) => {
        const scene = threeScene.value;
        if (scene) removeGroupMeshes(scene, id);
        textureStore.$patch({
          groups: textureStore.groups.filter(g => g.id !== id),
        });
        elementPropertiesStore.unregisterElementProperties(id);
        updateSceneElements();
      },
      onRemoveTexture: () => {},
      onToggleVisibility: (id) => {
        const scene = threeScene.value;
        const group = textureStore.groups.find(g => g.id === id);
        if (!group) return;

        const newHidden = !group.hidden;
        textureStore.$patch({
          groups: textureStore.groups.map(
            g => g.id === id ? { ...g, hidden: newHidden } : g
          ),
        });

        if (scene) {
          const prefix = `grp-${id}-`;
          scene.children
            .filter(child => child.name?.startsWith(prefix))
            .forEach(child => toggleObjectVisibility(child));
        }
      },
      onToggleWireframe: (id) => {
        const group = textureStore.groups.find(g => g.id === id);
        if (group) {
          textureStore.$patch({
            groups: textureStore.groups.map(
              g => g.id === id ? { ...g, showWireframe: !g.showWireframe } : g
            ),
          });
          regenerateGroup(id);
        }
      },
      onAddTextureToGroup: (groupId, event) => {
        const target = event.target as HTMLInputElement;
        const files = target.files;
        if (!files || files.length === 0) return;

        const file = files[0];
        const url = URL.createObjectURL(file);
        const filename = file.name.replace(/\.[^./]+$/, '');
        const textureId = `texture-${Date.now()}`;

        const group = textureStore.groups.find(g => g.id === groupId);
        if (group) {
          textureStore.$patch({
            groups: textureStore.groups.map(g =>
              g.id === groupId
                ? { ...g, textures: [...g.textures, { id: textureId, name: filename, filename, url }] }
                : g
            ),
          });
          regenerateGroup(groupId);
        }
        target.value = '';
      },
      onAddNewGroup: (event) => {
        const target = event.target as HTMLInputElement;
        const files = target.files;
        if (!files || files.length === 0) return;

        const file = files[0];
        const url = URL.createObjectURL(file);
        const filename = file.name.replace(/\.[^./]+$/, '');
        const textureId = `texture-${Date.now()}`;
        const groupId = `group-${Date.now()}`;

        const newGroup: TextureGroup = {
          id: groupId,
          name: filename,
          textures: [{ id: textureId, name: filename, filename, url }],
        };

        const defaultConfig = textureStore.createDefaultGroupConfig();
        groupConfigs.value = {
          ...groupConfigs.value,
          [groupId]: defaultConfig as unknown as Record<string, unknown>,
        };

        textureStore.$patch({
          groups: [...textureStore.groups, newGroup],
        });

        registerGroupProperties(newGroup);
        elementPropertiesStore.openElementProperties(groupId);

        const scene = threeScene.value;
        if (scene) {
          addGroupMeshes(scene, threeWorld.value, newGroup, getGroupConfig);
        }
        updateSceneElements();
        target.value = '';
      },
      onManualUpdate: () => {
        textureStore.groups.forEach(group => regenerateGroup(group.id));
      },
      onAddElement: () => {},
    });

    // Add meshes and register properties for each group
    const scene = threeScene.value;
    const world = threeWorld.value;
    if (scene) {
      textureStore.groups.forEach(group => {
        addGroupMeshes(scene, world, group, getGroupConfig);
        registerGroupProperties(group);
      });
    }

    // Update scene elements with groups
    debugSceneStore.$patch({ sceneGroups: defaultGroups });
    updateSceneElements();
  };

  const cleanup = () => {
    viewPanelsStore.clearViewPanels();
    debugSceneStore.clearSceneElements();
    elementPropertiesStore.clearAllElementProperties();
    textureStore.clear();
    cameraConfig.value = {};
    groundConfig.value = {};
    lightsConfig.value = {};
    skyConfig.value = {};
    groupConfigs.value = {};
    textureAreaConfigs.value = {};
    textureAreaDefinitions.value = [];
    areaMeshCache.value = {};
    playMode.value = false;
    threeScene.value = null;
    threeWorld.value = null;
    threeCamera.value = null;
    orbitReference.value = null;
    groundReference.value = null;
    ambientLightReference.value = null;
    directionalLightReference.value = null;
    skyMeshReference.value = null;
    isInitialized.value = false;
  };

  return {
    cameraConfig,
    groundConfig,
    lightsConfig,
    skyConfig,
    groupConfigs,
    textureAreaConfigs,
    textureAreaDefinitions,
    threeScene,
    threeWorld,
    threeCamera,
    orbitReference,
    isInitialized,
    playMode,
    init,
    initTextureGroups,
    registerTextureAreas,
    cleanup,
    getGroupConfig,
    regenerateGroup,
  };
});
