import { ref } from 'vue';

interface SceneElement {
  name: string;
  type: string;
  hidden?: boolean;
}

interface DebugSceneHandlers {
  onToggleVisibility: (name: string) => void;
  onRemove: (name: string) => void;
}

const sceneElements = ref<SceneElement[]>([]);
const handlers = ref<DebugSceneHandlers | null>(null);

export const useDebugScene = () => {
  const setSceneElements = (elements: SceneElement[], newHandlers: DebugSceneHandlers) => {
    sceneElements.value = elements;
    handlers.value = newHandlers;
  };

  const clearSceneElements = () => {
    sceneElements.value = [];
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
    setSceneElements,
    clearSceneElements,
    handleToggleVisibility,
    handleRemove,
  };
};
