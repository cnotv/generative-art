import { defineStore } from 'pinia';
import { ref } from 'vue';
import { GLOBAL_SCENE_DEFAULTS } from '@webgamekit/threejs';
import type { ConfigControlsSchema } from '@/stores/viewConfig';

export interface SceneConfigRegistration {
  schema: ConfigControlsSchema;
  getValue: (path: string) => unknown;
  updateValue: (path: string, value: unknown) => void;
}

export const globalSceneSchema: ConfigControlsSchema = {
  global: {
    frameRate: { min: 1, max: 120, step: 1, label: 'Frame Rate' },
    textSelection: { boolean: true, label: 'Allow Text Selection' },
  },
  orbit: {
    disabled: { boolean: false, label: 'Disable Orbit Controls' },
  },
  postprocessing: {
    bloom: {
      enabled: { boolean: false, label: 'Bloom' },
      strength: { min: 0, max: 5, step: 0.1, label: 'Strength' },
      threshold: { min: 0, max: 1, step: 0.01, label: 'Threshold' },
      radius: { min: 0, max: 1, step: 0.01, label: 'Radius' },
    },
    vignette: {
      enabled: { boolean: false, label: 'Vignette' },
      offset: { min: 0, max: 1, step: 0.01, label: 'Offset' },
      darkness: { min: 0, max: 1, step: 0.01, label: 'Darkness' },
    },
  },
};

export const useSceneConfigStore = defineStore('sceneConfig', () => {
  const internalConfig = ref<Record<string, unknown>>(JSON.parse(JSON.stringify(GLOBAL_SCENE_DEFAULTS)));
  const schema = ref<ConfigControlsSchema>(globalSceneSchema);
  const externalGetValue = ref<((path: string) => unknown) | null>(null);
  const externalUpdateValue = ref<((path: string, value: unknown) => void) | null>(null);

  const getValue = (path: string): unknown => {
    if (externalGetValue.value) return externalGetValue.value(path);
    return path.split('.').reduce<unknown>(
      (object, key) => (object as Record<string, unknown>)?.[key],
      internalConfig.value
    );
  };

  const updateValue = (path: string, value: unknown): void => {
    if (externalUpdateValue.value) {
      externalUpdateValue.value(path, value);
      return;
    }
    const keys = path.split('.');
    const parent = keys.slice(0, -1).reduce<Record<string, unknown>>(
      (object, key) => (object as Record<string, unknown>)[key] as Record<string, unknown>,
      internalConfig.value as Record<string, unknown>
    );
    // eslint-disable-next-line functional/immutable-data
    parent[keys[keys.length - 1]] = value;
  };

  const registerSceneConfig = (registration: SceneConfigRegistration) => {
    schema.value = registration.schema;
    externalGetValue.value = registration.getValue;
    externalUpdateValue.value = registration.updateValue;
  };

  const unregisterSceneConfig = () => {
    schema.value = globalSceneSchema;
    externalGetValue.value = null;
    externalUpdateValue.value = null;
    internalConfig.value = JSON.parse(JSON.stringify(GLOBAL_SCENE_DEFAULTS));
  };

  return { schema, getValue, updateValue, registerSceneConfig, unregisterSceneConfig };
});

export const registerSceneConfig = (registration: SceneConfigRegistration) =>
  useSceneConfigStore().registerSceneConfig(registration);

export const unregisterSceneConfig = () =>
  useSceneConfigStore().unregisterSceneConfig();
