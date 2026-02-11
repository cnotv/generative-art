import { ref, shallowReactive, computed, watch, type Ref } from 'vue';
import { useRoute } from 'vue-router';
import { debounce } from '@/utils/lodash';

export type ControlSchema = {
  min?: number;
  max?: number;
  step?: number;
  boolean?: boolean;
  color?: boolean;
  label?: string;
  options?: string[];
};

export type ConfigControlsSchema = {
  [key: string]: ControlSchema | ConfigControlsSchema;
};

type OnChangeCallback = () => void;

type ConfigEntry = {
  config: Ref<Record<string, any>>;
  schema: ConfigControlsSchema;
  sceneConfig?: Ref<Record<string, any>>;
  sceneSchema?: ConfigControlsSchema;
  onChange?: OnChangeCallback;
  stopWatch?: () => void;
  stopSceneWatch?: () => void;
};

// Use shallowReactive to prevent Vue from unwrapping nested refs
const registry = shallowReactive<Record<string, ConfigEntry>>({});

// Default debounce delay in milliseconds
const DEFAULT_DEBOUNCE_DELAY = 500;

// Version counter to force reactivity updates
const version = ref(0);

/**
 * Register a view's config and schema for the controls panel
 * @param routeName - The route name to register the config for
 * @param config - The reactive config ref (for reactive game settings)
 * @param schema - The schema for the controls panel (Config tab)
 * @param sceneConfig - Optional reactive scene config ref (for setupConfig settings)
 * @param sceneSchema - Optional schema for scene controls (Scene tab)
 * @param onChange - Optional callback that fires when config changes (auto-debounced)
 * @param debounceDelay - Custom debounce delay in ms (default: 500)
 */
export const registerViewConfig = (
  routeName: string,
  config: Ref<Record<string, any>>,
  schema: ConfigControlsSchema,
  sceneConfig?: Ref<Record<string, any>>,
  sceneSchema?: ConfigControlsSchema,
  onChange?: OnChangeCallback,
  debounceDelay: number = DEFAULT_DEBOUNCE_DELAY
) => {
  // Clean up any existing watchers
  const existingEntry = registry[routeName];
  if (existingEntry?.stopWatch) {
    existingEntry.stopWatch();
  }
  if (existingEntry?.stopSceneWatch) {
    existingEntry.stopSceneWatch();
  }

  let stopWatch: (() => void) | undefined;
  let stopSceneWatch: (() => void) | undefined;

  // Set up debounced watcher for main config if onChange callback provided
  if (onChange) {
    const debouncedCallback = debounce(onChange, debounceDelay);
    stopWatch = watch(
      () => JSON.stringify(config.value),
      () => {
        debouncedCallback();
      }
    );
  }

  // Set up debounced watcher for scene config if provided
  if (sceneConfig && onChange) {
    const debouncedCallback = debounce(onChange, debounceDelay);
    stopSceneWatch = watch(
      () => JSON.stringify(sceneConfig.value),
      () => {
        debouncedCallback();
      }
    );
  }

  // eslint-disable-next-line functional/immutable-data
  registry[routeName] = { config, schema, sceneConfig, sceneSchema, onChange, stopWatch, stopSceneWatch };
  version.value++;
};

/**
 * Unregister a view's config when component unmounts
 */
export const unregisterViewConfig = (routeName: string) => {
  const entry = registry[routeName];
  // Clean up watchers if they exist
  if (entry?.stopWatch) {
    entry.stopWatch();
  }
  if (entry?.stopSceneWatch) {
    entry.stopSceneWatch();
  }
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

  const currentSceneConfig = computed(() => {
    // Access version to create dependency
    void version.value;
    const routeName = route.name as string;
    const entry = registry[routeName];
    return entry?.sceneConfig?.value ?? null;
  });

  const currentSceneSchema = computed(() => {
    // Access version to create dependency
    void version.value;
    const routeName = route.name as string;
    const entry = registry[routeName];
    return entry?.sceneSchema ?? null;
  });

  const hasConfig = computed(() => currentSchema.value !== null);
  const hasSceneConfig = computed(() => currentSceneSchema.value !== null);

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

  const updateSceneConfig = (path: string, value: any) => {
    const routeName = route.name as string;
    const entry = registry[routeName];
    if (!entry?.sceneConfig) return;

    const keys = path.split('.');
    let object = entry.sceneConfig.value;

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

  const getSceneConfigValue = (path: string): any => {
    if (!currentSceneConfig.value) return undefined;

    const keys = path.split('.');
    let object = currentSceneConfig.value;

    for (const key of keys) {
      if (object === undefined || object === null) return undefined;
      object = object[key];
    }

    return object;
  };

  return {
    currentConfig,
    currentSchema,
    currentSceneConfig,
    currentSceneSchema,
    hasConfig,
    hasSceneConfig,
    updateConfig,
    updateSceneConfig,
    getConfigValue,
    getSceneConfigValue
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
