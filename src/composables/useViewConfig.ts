import { ref, shallowReactive, computed, type Ref } from 'vue';
import { useRoute } from 'vue-router';

export type ControlSchema = {
  min?: number;
  max?: number;
  step?: number;
  boolean?: boolean;
  color?: boolean;
  label?: string;
};

export type ConfigControlsSchema = {
  [key: string]: ControlSchema | ConfigControlsSchema;
};

type ConfigEntry = {
  config: Ref<Record<string, any>>;
  schema: ConfigControlsSchema;
};

// Use shallowReactive to prevent Vue from unwrapping nested refs
const registry = shallowReactive<Record<string, ConfigEntry>>({});

// Version counter to force reactivity updates
const version = ref(0);

/**
 * Register a view's config and schema for the controls panel
 */
export const registerViewConfig = (
  routeName: string,
  config: Ref<Record<string, any>>,
  schema: ConfigControlsSchema
) => {
  // eslint-disable-next-line functional/immutable-data
  registry[routeName] = { config, schema };
  version.value++;
};

/**
 * Unregister a view's config when component unmounts
 */
export const unregisterViewConfig = (routeName: string) => {
  // eslint-disable-next-line functional/immutable-data
  delete registry[routeName];
  version.value++;
};

/**
 * Get the current view's config and schema
 */
export const useViewConfig = () => {
  const route = useRoute();

  const currentConfig = computed(() => {
    // Access version to create dependency
    void version.value;
    const routeName = route.name as string;
    const entry = registry[routeName];
    return entry?.config.value ?? null;
  });

  const currentSchema = computed(() => {
    // Access version to create dependency
    void version.value;
    const routeName = route.name as string;
    const entry = registry[routeName];
    return entry?.schema ?? null;
  });

  const hasConfig = computed(() => currentSchema.value !== null);

  const updateConfig = (path: string, value: any) => {
    const routeName = route.name as string;
    const entry = registry[routeName];
    if (!entry) return;

    const keys = path.split('.');
    let object = entry.config.value;

    keys.slice(0, -1).forEach(key => {
      // eslint-disable-next-line functional/immutable-data
      if (object[key] === undefined) object[key] = {};
      object = object[key];
    });

    const lastKey = keys[keys.length - 1];
    // eslint-disable-next-line functional/immutable-data
    object[lastKey] = value;
  };

  const getConfigValue = (path: string): any => {
    if (!currentConfig.value) return undefined;

    const keys = path.split('.');
    let object = currentConfig.value;

    for (const key of keys) {
      if (object === undefined || object === null) return undefined;
      object = object[key];
    }

    return object;
  };

  return {
    currentConfig,
    currentSchema,
    hasConfig,
    updateConfig,
    getConfigValue
  };
};

/**
 * Helper to create a reactive config from a static config object
 */
export const createReactiveConfig = <T extends Record<string, any>>(config: T): Ref<T> => {
  return ref(JSON.parse(JSON.stringify(config))) as Ref<T>;
};

// Export for testing
export const _getRegistry = () => registry;
export const _clearRegistry = () => {
  // eslint-disable-next-line functional/immutable-data
  Object.keys(registry).forEach(key => delete registry[key]);
  version.value++;
};
