import { ref, computed } from 'vue';
import type { ConfigControlsSchema } from './useViewConfig';

export interface ElementPropertiesConfig {
  title: string;
  type?: 'camera' | 'group' | string;
  schema: ConfigControlsSchema;
  getValue: (path: string) => unknown;
  updateValue: (path: string, value: unknown) => void;
}

const selectedElementName = ref<string | null>(null);
const elementPropertiesRegistry = ref<Record<string, ElementPropertiesConfig>>({});

export const useElementProperties = () => {
  const activeProperties = computed<ElementPropertiesConfig | null>(() => {
    if (selectedElementName.value === null) return null;
    return (
      elementPropertiesRegistry.value[selectedElementName.value] ?? {
        title: selectedElementName.value,
        schema: {},
        getValue: () => undefined,
        updateValue: () => {},
      }
    );
  });

  const registerElementProperties = (name: string, config: ElementPropertiesConfig) => {
    elementPropertiesRegistry.value = { ...elementPropertiesRegistry.value, [name]: config };
  };

  const unregisterElementProperties = (name: string) => {
    const { [name]: _removed, ...rest } = elementPropertiesRegistry.value;
    elementPropertiesRegistry.value = rest;
    if (selectedElementName.value === name) {
      selectedElementName.value = null;
    }
  };

  const clearAllElementProperties = () => {
    elementPropertiesRegistry.value = {};
    selectedElementName.value = null;
  };

  const openElementProperties = (name: string) => {
    selectedElementName.value = name;
  };

  return {
    selectedElementName,
    activeProperties,
    registerElementProperties,
    unregisterElementProperties,
    clearAllElementProperties,
    openElementProperties,
  };
};
