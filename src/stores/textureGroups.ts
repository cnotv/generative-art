import { defineStore } from 'pinia';

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

export const useTextureGroupsStore = defineStore('textureGroups', {
  state: () => ({
    groups: [] as TextureGroup[],
    selectedGroupId: null as string | null,
    autoUpdate: true,
    handlers: null as TextureGroupHandlers | null,
  }),

  actions: {
    registerHandlers(newHandlers: TextureGroupHandlers) {
      this.handlers = newHandlers;
    },

    clear() {
      this.groups = [];
      this.selectedGroupId = null;
      this.autoUpdate = true;
      this.handlers = null;
    },
  },
});
