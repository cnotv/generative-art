import { defineStore } from 'pinia';
import type { CoordinateTuple } from '@webgamekit/threejs';

export interface TextureItem {
  id: string;
  name: string;
  filename: string;
  url: string;
}

export interface TextureGroup {
  id: string;
  name: string;
  textures: TextureItem[];
  hidden?: boolean;
  showWireframe?: boolean;
}

export interface GroupConfig {
  area: {
    center: CoordinateTuple;
    size: CoordinateTuple;
  };
  textures: {
    baseSize: CoordinateTuple;
    sizeVariation: CoordinateTuple;
    rotationVariation: CoordinateTuple;
  };
  instances: {
    density: number;
    pattern: 'random' | 'grid' | 'grid-jitter';
    seed: number;
  };
}

export interface TextureGroupHandlers {
  onSelectGroup: (id: string) => void;
  onRemoveGroup: (id: string) => void;
  onRemoveTexture: (groupId: string, textureId: string) => void;
  onToggleVisibility: (id: string) => void;
  onToggleWireframe: (id: string) => void;
  onAddTextureToGroup: (groupId: string, event: Event) => void;
  onAddNewGroup: (event: Event) => void;
  onManualUpdate: () => void;
  onAddElement: (type: 'camera' | 'mesh') => void;
}

const DEFAULT_BASE_SIZE = 20;

const DEFAULT_GROUP_CONFIG: GroupConfig = {
  area: {
    center: [0, 0, 0] as CoordinateTuple,
    size: [0, 0, 0] as CoordinateTuple,
  },
  textures: {
    baseSize: [DEFAULT_BASE_SIZE, DEFAULT_BASE_SIZE, 0] as CoordinateTuple,
    sizeVariation: [10, 10, 0] as CoordinateTuple,
    rotationVariation: [0, 0, 0] as CoordinateTuple,
  },
  instances: { density: 0, pattern: 'random', seed: 1000 },
};

export const useTextureGroupsStore = defineStore('textureGroups', {
  state: () => ({
    groups: [] as TextureGroup[],
    selectedGroupId: null as string | null,
    autoUpdate: true,
    handlers: null as TextureGroupHandlers | null,
    groupConfigRegistry: {} as Record<string, GroupConfig>,
  }),

  actions: {
    registerHandlers(newHandlers: TextureGroupHandlers) {
      this.handlers = newHandlers;
    },

    createDefaultGroupConfig(): GroupConfig {
      return {
        area: {
          center: [...DEFAULT_GROUP_CONFIG.area.center] as CoordinateTuple,
          size: [...DEFAULT_GROUP_CONFIG.area.size] as CoordinateTuple,
        },
        textures: {
          baseSize: [...DEFAULT_GROUP_CONFIG.textures.baseSize] as CoordinateTuple,
          sizeVariation: [...DEFAULT_GROUP_CONFIG.textures.sizeVariation] as CoordinateTuple,
          rotationVariation: [...DEFAULT_GROUP_CONFIG.textures.rotationVariation] as CoordinateTuple,
        },
        instances: { ...DEFAULT_GROUP_CONFIG.instances },
      };
    },

    saveGroupConfig(name: string, config: GroupConfig) {
      this.groupConfigRegistry[name] = config;
    },

    deleteGroupConfig(name: string) {
      delete this.groupConfigRegistry[name];
    },

    clear() {
      this.groups = [];
      this.selectedGroupId = null;
      this.autoUpdate = true;
      this.handlers = null;
      this.groupConfigRegistry = {};
    },
  },
});
