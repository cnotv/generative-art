import * as THREE from 'three';
import { getCube, generateAreaPositions } from '@webgamekit/threejs';
import type { CoordinateTuple, AreaConfig } from '@webgamekit/threejs';
import type { TextureGroup, GroupConfig } from '@/stores/textureGroups';

const MAX_INSTANCES = 2000;

export const densityToCount = (density: number): number => {
  if (density <= 0) return 1;
  return Math.min(MAX_INSTANCES, Math.max(1, Math.round(density)));
};

export const removeGroupMeshes = (scene: THREE.Scene, groupId: string): void => {
  const prefix = `grp-${groupId}-`;
  const wireframeName = `wireframe-${groupId}`;
  scene.children
    .filter(child => child.name?.startsWith(prefix) || child.name === wireframeName)
    .forEach(child => scene.remove(child));
};

const HALF = 0.5;

const randomVariation = (base: number, variation: number): number =>
  base + (Math.random() - HALF) * variation;

export const createTextureInstances = (
  groups: TextureGroup[],
  getGroupConfig: (groupId: string) => GroupConfig
) => {
  return groups
    .filter(group => !group.hidden && group.textures.length > 0)
    .flatMap(group => {
      const gc = getGroupConfig(group.id);

      const areaConfig: AreaConfig = {
        center: gc.area.center,
        size: gc.area.size,
        count: densityToCount(gc.instances.density),
        pattern: gc.instances.pattern,
        seed: gc.instances.seed,
        sizeVariation: gc.textures.sizeVariation,
        rotationVariation: gc.textures.rotationVariation,
      };

      const allPositions = generateAreaPositions(areaConfig);
      const { sizeVariation, rotationVariation, baseSize } = gc.textures;
      const hasVariation = sizeVariation.some(v => v !== 0) || rotationVariation.some(v => v !== 0);

      const positionsByVariant = allPositions.reduce<CoordinateTuple[][]>(
        (accumulator, position) => {
          const randomIndex = Math.floor(Math.random() * group.textures.length);
          return accumulator.map((positions, i) => i === randomIndex ? [...positions, position] : positions);
        },
        group.textures.map(() => [])
      );

      return group.textures.map((item, index) => ({
        texture: item.url,
        filename: item.filename,
        groupId: group.id,
        groupConfig: gc,
        positions: positionsByVariant[index],
        instances: hasVariation
          ? positionsByVariant[index].map(position => ({
              position,
              scale: [
                randomVariation(baseSize[0], sizeVariation[0]),
                randomVariation(baseSize[1], sizeVariation[1]),
                randomVariation(baseSize[2], sizeVariation[2]),
              ] as CoordinateTuple,
              rotation: [
                randomVariation(0, rotationVariation[0]),
                randomVariation(0, rotationVariation[1]),
                randomVariation(0, rotationVariation[2]),
              ] as CoordinateTuple,
            }))
          : [] as Array<{ position: CoordinateTuple; scale: CoordinateTuple; rotation: CoordinateTuple }>,
      }));
    });
};

export const addGroupMeshes = (
  scene: THREE.Scene,
  world: unknown,
  group: TextureGroup,
  getGroupConfig: (groupId: string) => GroupConfig,
  onDone?: () => void
): void => {
  if (group.textures.length === 0) return;

  const gc = getGroupConfig(group.id);

  if (group.showWireframe) {
    getCube(scene, world, {
      name: `wireframe-${group.id}`,
      size: gc.area.size,
      position: gc.area.center,
      color: 0x00ff00,
      material: 'MeshBasicMaterial',
      wireframe: true,
      type: 'fixed' as const,
      castShadow: false,
      receiveShadow: false,
      physics: false,
    });
  }

  const variantData = createTextureInstances([group], getGroupConfig);

  variantData.forEach(variant => {
    const elementsData =
      variant.instances.length > 0
        ? variant.instances
        : variant.positions.map((pos: CoordinateTuple) => ({ position: pos }));

    elementsData.forEach((elementData, index) => {
      const meshSize = (elementData as { scale?: CoordinateTuple }).scale || variant.groupConfig.textures.baseSize;
      const meshPosition = elementData.position;
      const meshRotation = (elementData as { rotation?: CoordinateTuple }).rotation || ([0, 0, 0] as CoordinateTuple);

      if (!group.hidden) {
        getCube(scene, world, {
          name: `grp-${group.id}-${variant.filename}-${index}`,
          size: meshSize,
          position: meshPosition,
          rotation: meshRotation,
          texture: variant.texture,
          material: 'MeshBasicMaterial',
          opacity: 1,
          color: 0xffffff,
          type: 'fixed' as const,
          castShadow: false,
          physics: false,
          receiveShadow: false,
        });
      }
    });
  });

  onDone?.();
};
