import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface SceneElement {
  name: string;
  type: string;
  hidden?: boolean;
  groupId?: string;
}

export interface DebugSceneHandlers {
  onToggleVisibility: (name: string) => void;
  onRemove: (name: string) => void;
}

export const useDebugSceneStore = defineStore('debugScene', () => {
  const sceneElements = ref<SceneElement[]>([]);
  const sceneGroups = ref<Record<string, string>>({});
  const handlers = ref<DebugSceneHandlers | null>(null);

  const setSceneElements = (
    elements: SceneElement[],
    newHandlers: DebugSceneHandlers,
    groups?: Record<string, string>
  ) => {
    sceneElements.value = elements;
    handlers.value = newHandlers;
    sceneGroups.value = groups ?? {};
  };

  const registerSceneElements = (
    camera: { type: string },
    objects: Array<{ name?: string; type: string }>,
    elementHandlers?: Partial<DebugSceneHandlers>
  ) => {
    setSceneElements(
      [
        { name: 'Camera', type: camera.type, hidden: false },
        ...objects.map(element => ({ name: element.name || element.type, type: element.type, hidden: false })),
      ],
      {
        onToggleVisibility: elementHandlers?.onToggleVisibility ?? (() => {}),
        onRemove: elementHandlers?.onRemove ?? (() => {}),
      }
    );
  };

  const clearSceneElements = () => {
    sceneElements.value = [];
    sceneGroups.value = {};
    handlers.value = null;
  };

  const handleToggleVisibility = (name: string) => {
    handlers.value?.onToggleVisibility(name);
  };

  const handleRemove = (name: string) => {
    handlers.value?.onRemove(name);
  };

  return {
    sceneElements,
    sceneGroups,
    setSceneElements,
    registerSceneElements,
    clearSceneElements,
    handleToggleVisibility,
    handleRemove,
  };
});
