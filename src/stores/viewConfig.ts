import { defineStore } from 'pinia';
import { ref, shallowReactive, watch } from 'vue';
import type { Ref } from 'vue';
import { debounce } from '@/utils/lodash';

export type ControlOption = {
  value: string;
  label: string;
  color?: string;
  disabled?: boolean;
};

export type ControlSchema = {
  min?: number | { x: number; y: number; z: number };
  max?: number | { x: number; y: number; z: number };
  step?: number | { x: number; y: number; z: number };
  boolean?: boolean;
  checkbox?: boolean;
  color?: boolean;
  bezier?: boolean;
  label?: string;
  options?: string[] | ControlOption[];
  component?: string;
  direction?: 'row' | 'column';
  callback?: string;
  sectionStart?: boolean;
};

export type ConfigControlsSchema = {
  [key: string]: ControlSchema | ConfigControlsSchema;
};

type OnChangeCallback = () => void;

type ConfigEntry = {
  config: Ref<Record<string, unknown>>;
  schema: ConfigControlsSchema;
  onChange?: OnChangeCallback;
  stopWatch?: () => void;
  callbacks?: Record<string, () => void>;
};

const DEFAULT_DEBOUNCE_DELAY = 500;

export const useViewConfigStore = defineStore('viewConfig', () => {
  // shallowReactive prevents Vue from unwrapping nested refs inside entries
  const registry = shallowReactive<Record<string, ConfigEntry>>({});
  const version = ref(0);

  const registerViewConfig = (
    routeName: string,
    config: Ref<Record<string, unknown>>,
    schema: ConfigControlsSchema,
    onChange?: OnChangeCallback,
    callbacks?: Record<string, () => void>
  ) => {
    const existingEntry = registry[routeName];
    if (existingEntry?.stopWatch) {
      existingEntry.stopWatch();
    }

    let stopWatch: (() => void) | undefined;

    if (onChange) {
      const debouncedCallback = debounce(onChange, DEFAULT_DEBOUNCE_DELAY);
      stopWatch = watch(
        () => JSON.stringify(config.value),
        () => { debouncedCallback(); }
      );
    }

    // eslint-disable-next-line functional/immutable-data
    registry[routeName] = { config, schema, onChange, stopWatch, callbacks };
    version.value++;
  };

  const unregisterViewConfig = (routeName: string) => {
    const entry = registry[routeName];
    if (entry?.stopWatch) {
      entry.stopWatch();
    }
    // eslint-disable-next-line functional/immutable-data
    delete registry[routeName];
    version.value++;
  };

  const updateViewSchema = (routeName: string, schema: ConfigControlsSchema) => {
    const entry = registry[routeName];
    if (!entry) return;
    // eslint-disable-next-line functional/immutable-data
    entry.schema = schema;
    version.value++;
  };

  const getConfigValue = (routeName: string, path: string): unknown => {
    const config = registry[routeName]?.config.value;
    if (!config) return undefined;
    return path.split('.').reduce<unknown>(
      (object, key) => (object as Record<string, unknown>)?.[key],
      config
    );
  };

  const updateConfig = (routeName: string, path: string, value: unknown) => {
    const entry = registry[routeName];
    if (!entry) return;

    const keys = path.split('.');
    let object = entry.config.value;

    keys.slice(0, -1).forEach(key => {
      // eslint-disable-next-line functional/immutable-data
      if (object[key] === undefined) object[key] = {};
      object = object[key] as Record<string, unknown>;
    });

    // eslint-disable-next-line functional/immutable-data
    object[keys[keys.length - 1]] = value;
  };

  const invokeCallback = (routeName: string, name: string) => {
    registry[routeName]?.callbacks?.[name]?.();
  };

  const resetState = () => {
    Object.keys(registry).forEach(key => {
      const entry = registry[key];
      if (entry?.stopWatch) entry.stopWatch();
      // eslint-disable-next-line functional/immutable-data
      delete registry[key];
    });
    version.value = 0;
  };

  return {
    registry,
    version,
    registerViewConfig,
    unregisterViewConfig,
    updateViewSchema,
    getConfigValue,
    updateConfig,
    invokeCallback,
    resetState,
  };
});

export const createReactiveConfig = <T extends Record<string, unknown>>(config: T): Ref<T> =>
  ref(JSON.parse(JSON.stringify(config))) as Ref<T>;

// Standalone convenience exports — same call site ergonomics as before
export const registerViewConfig = (
  routeName: string,
  config: Ref<Record<string, unknown>>,
  schema: ConfigControlsSchema,
  onChange?: OnChangeCallback,
  callbacks?: Record<string, () => void>
) => useViewConfigStore().registerViewConfig(routeName, config, schema, onChange, callbacks);

export const unregisterViewConfig = (routeName: string) =>
  useViewConfigStore().unregisterViewConfig(routeName);

export const updateViewSchema = (routeName: string, schema: ConfigControlsSchema) =>
  useViewConfigStore().updateViewSchema(routeName, schema);
