import js from '@eslint/js';
import pluginVue from 'eslint-plugin-vue';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import vueParser from 'vue-eslint-parser';
import functional from 'eslint-plugin-functional';
import unicorn from 'eslint-plugin-unicorn';
import prettierConfig from 'eslint-config-prettier';

export default [
  // Base recommended configs
  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],

  // Global ignores
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.vite/**',
      '**/documentation/.docusaurus/**',
      '**/documentation/build/**',
      '**/coverage/**',
    ],
  },

  // Main configuration for JS/TS files (Vue handled separately)
  {
    files: ['**/*.{js,mjs,cjs,ts,mts}'],

    plugins: {
      '@typescript-eslint': tseslint,
      functional,
      unicorn,
    },

    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.vue'],
      },
      globals: {
        process: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        document: 'readonly',
        window: 'readonly',
        navigator: 'readonly',
        HTMLCanvasElement: 'readonly',
        HTMLVideoElement: 'readonly',
        HTMLImageElement: 'readonly',
        Image: 'readonly',
        File: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        Worker: 'readonly',
        MessageEvent: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        KeyboardEvent: 'readonly',
        MouseEvent: 'readonly',
        WheelEvent: 'readonly',
        TouchEvent: 'readonly',
        PointerEvent: 'readonly',
        GamepadEvent: 'readonly',
        ResizeObserver: 'readonly',
        IntersectionObserver: 'readonly',
        MutationObserver: 'readonly',
        performance: 'readonly',
        AudioContext: 'readonly',
        webkitAudioContext: 'readonly',
        // TypeScript globals
        Record: 'readonly',
        Partial: 'readonly',
        Required: 'readonly',
        Readonly: 'readonly',
        Pick: 'readonly',
        Omit: 'readonly',
        Exclude: 'readonly',
        Extract: 'readonly',
        NonNullable: 'readonly',
        ReturnType: 'readonly',
        InstanceType: 'readonly',
        Parameters: 'readonly',
        ConstructorParameters: 'readonly',
      },
    },

    rules: {
      // ====================
      // FUNCTIONAL PROGRAMMING RULES
      // ====================

      // Prevent classes (align with project philosophy)
      'functional/no-classes': 'error', // Keep as error - no classes allowed

      // Prevent mutations
      'functional/immutable-data': ['error', {
        ignoreIdentifierPattern: '^(this|module|exports)',
        ignoreAccessorPattern: [
          '**.current.**', // Allow React refs
          '**.value', // Allow Vue refs
          '**.position.**', // Allow Three.js mutations
          '**.rotation.**',
          '**.scale.**',
          '**.material.**',
          '**.userData.**',
        ],
      }],

      // Prefer functional alternatives but allow loops when necessary
      'functional/no-loop-statements': 'warn',

      // Prefer const over let
      'functional/no-let': ['warn', {
        allowInForLoopInit: false,
        allowInFunctions: true, // Allow let in function scope for closures
      }],

      // Prevent try-catch (use Result types instead)
      'functional/no-try-statements': 'off', // Too strict for real-world apps

      // ====================
      // UNICORN RULES (Modern Best Practices)
      // ====================

      // Prevent abbreviations (prefer full words)
      'unicorn/prevent-abbreviations': ['error', {
        allowList: {
          // Common abbreviations to allow
          args: true,
          db: true,
          dir: true,
          e: true,  // Event in catch
          env: true,
          fn: true,
          i: true,  // Index in specific contexts
          id: true,
          params: true,
          props: true,
          ref: true,
          refs: true,
          req: true,
          res: true,
          src: true,
          url: true,
          http: true,
          https: true,
          // Three.js specific
          ctx: true,
          x: true,
          y: true,
          z: true,
          // Common dev abbreviations
          dev: true,
          prod: true,
          temp: true,
          // Game dev & physics
          max: true,
          min: true,
          fps: true,
          // Ref-like is common pattern
          RefLike: true,
        },
      }],

      // Prefer modern array methods
      'unicorn/prefer-array-flat-map': 'error',
      'unicorn/prefer-array-some': 'error',
      'unicorn/prefer-array-find': 'error',

      // Prefer spread over Array.from
      'unicorn/prefer-spread': 'error',

      // Consistent error handling
      'unicorn/prefer-modern-math-apis': 'error',

      // Better regex
      'unicorn/better-regex': 'error',

      'unicorn/numeric-separators-style': 'off',

      // ====================
      // COMPLEXITY RULES
      // ====================

      // Max cyclomatic complexity (common standard)
      'complexity': ['warn', { max: 15 }],

      // Max nested callbacks
      'max-depth': ['error', { max: 4 }],

      // Max lines per function
      'max-lines-per-function': ['warn', {
        max: 100,
        skipBlankLines: true,
        skipComments: true,
        IIFEs: true,
      }],

      // Max parameters
      'max-params': ['warn', { max: 5 }],

      // ====================
      // TYPESCRIPT NAMING CONVENTIONS
      // ====================

      // Disabled because it requires type information which isn't available for all files
      '@typescript-eslint/naming-convention': 'off',

      // Use simpler camelcase rule
      'camelcase': ['warn', {
        properties: 'never',
        ignoreDestructuring: true,
        ignoreImports: true,
        allow: ['^UNSAFE_', '^unstable_', '^_'], // React conventions and private vars
      }],

      // ====================
      // MAGIC NUMBERS
      // ====================

      'no-magic-numbers': ['warn', {
        ignore: [0, 1, -1, 2, 3, 4, 5, 10, 100, 1000], // Common constants
        ignoreArrayIndexes: true,
        ignoreDefaultValues: true,
        ignoreClassFieldInitialValues: true,
        enforceConst: true,
        detectObjects: false,
      }],

      // ====================
      // GENERAL CODE QUALITY
      // ====================

      // Prefer const
      'prefer-const': 'error',

      // No var
      'no-var': 'error',

      // Arrow functions for callbacks
      'prefer-arrow-callback': 'error',

      // Template literals over concatenation
      'prefer-template': 'error',

      // No console in production
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // No debugger in production
      'no-debugger': 'warn',

      // Consistent return
      'consistent-return': 'warn',

      // No unused vars
      'no-unused-vars': 'off', // Turn off base rule
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],

      // Explicit function return types
      '@typescript-eslint/explicit-function-return-type': 'off', // Too verbose for all cases

      // No explicit any
      '@typescript-eslint/no-explicit-any': 'warn',

      // ====================
      // VUE-SPECIFIC OVERRIDES
      // ====================

      'vue/multi-word-component-names': 'off', // Allow single-word components
    },
  },

  // Vue files specific configuration
  {
    files: ['**/*.vue'],
    plugins: {
      '@typescript-eslint': tseslint,
      functional,
      unicorn,
    },
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsparser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        projectService: false,
        extraFileExtensions: ['.vue'],
      },
      globals: {
        process: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        document: 'readonly',
        window: 'readonly',
        navigator: 'readonly',
        HTMLCanvasElement: 'readonly',
        HTMLVideoElement: 'readonly',
        HTMLImageElement: 'readonly',
        Image: 'readonly',
        File: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        Worker: 'readonly',
        MessageEvent: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        KeyboardEvent: 'readonly',
        MouseEvent: 'readonly',
        WheelEvent: 'readonly',
        TouchEvent: 'readonly',
        PointerEvent: 'readonly',
        GamepadEvent: 'readonly',
        Gamepad: 'readonly',
        ResizeObserver: 'readonly',
        IntersectionObserver: 'readonly',
        MutationObserver: 'readonly',
        Performance: 'readonly',
        performance: 'readonly',
        AudioContext: 'readonly',
        AudioBuffer: 'readonly',
        GainNode: 'readonly',
        fetch: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        Float32Array: 'readonly',
        Uint8Array: 'readonly',
        Uint16Array: 'readonly',
        Uint32Array: 'readonly',
        Int8Array: 'readonly',
        Int16Array: 'readonly',
        Int32Array: 'readonly',
        ArrayBuffer: 'readonly',
        DataView: 'readonly',
        WebSocket: 'readonly',
        WebGLRenderingContext: 'readonly',
        WebGL2RenderingContext: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        location: 'readonly',
        history: 'readonly',
        screen: 'readonly',
        crypto: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        structuredClone: 'readonly',
        postMessage: 'readonly',
        onmessage: 'readonly',
        onerror: 'readonly',
        self: 'readonly',
        importScripts: 'readonly',
        close: 'readonly',
        DOMParser: 'readonly',
        XMLSerializer: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
      },
    },
    rules: {
      // Disable type-aware rules for Vue files (no projectService)
      // vue-tsc handles type checking for Vue files
      'functional/immutable-data': 'off',
      'functional/no-let': 'off',
      '@typescript-eslint/naming-convention': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'consistent-return': 'off',
      'vue/multi-word-component-names': 'off',
      'no-undef': 'off', // TypeScript handles this via vue-tsc
      'no-unused-vars': 'off', // TypeScript handles this via vue-tsc
    },
  },

  // Three.js files - allow necessary mutations for 3D objects
  {
    files: ['packages/threejs/**/*.ts', 'src/views/**/*.ts'],
    rules: {
      // Three.js requires mutating objects for position, rotation, etc.
      'functional/immutable-data': 'warn',
      'max-lines-per-function': ['warn', { max: 150 }],
      'complexity': ['warn', { max: 20 }],
    },
  },

  // Animation package - timeline management requires mutable state
  {
    files: ['packages/animation/**/*.ts'],
    rules: {
      'functional/immutable-data': 'warn',
      'functional/no-let': 'warn',
    },
  },

  // Declaration files - skip type checking and no-undef
  {
    files: ['**/*.d.ts'],
    languageOptions: {
      parserOptions: {
        projectService: false,
      },
    },
    rules: {
      'no-undef': 'off', // Declaration files define types
      '@typescript-eslint/no-unused-vars': 'off',
      'no-redeclare': 'off', // Type declarations are redeclaring types
    },
  },

  // Utility files often need to mutate state
  {
    files: ['src/utils/**/*.ts', 'src/router/**/*.ts', 'src/config/**/*.ts', 'packages/controls/**/*.ts', 'packages/audio/**/*.ts', 'packages/game/**/*.ts'],
    rules: {
      'functional/immutable-data': 'warn',
      'functional/no-let': 'warn',
    },
  },

  // Test files specific configuration
  {
    files: ['**/*.test.ts', '**/*.test.js', '**/*.spec.ts', '**/*.spec.js'],
    languageOptions: {
      parserOptions: {
        projectService: false,
      },
    },
    rules: {
      // Relax some rules for tests
      'max-lines-per-function': 'off',
      'no-magic-numbers': 'off',
      '@typescript-eslint/naming-convention': 'off',
      'functional/no-let': 'off',
      'functional/immutable-data': 'off',
    },
  },

  // Config files and scripts - disable type checking
  {
    files: ['*.config.{js,ts,mjs,cjs}', '.eslintrc.{js,cjs}', '**/vite.config.ts', 'scripts/**/*.js'],
    languageOptions: {
      parserOptions: {
        projectService: false,
      },
    },
    rules: {
      // Relax rules for config files
      'no-magic-numbers': 'off',
      '@typescript-eslint/naming-convention': 'off',
      'unicorn/prevent-abbreviations': 'off',
      'no-undef': 'off',
    },
  },

  // JavaScript files - disable TypeScript-specific rules
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      parserOptions: {
        projectService: false,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-undef': 'off',
      'functional/immutable-data': 'off', // Can't use type info on JS files
      'consistent-return': 'off',
    },
  },

  // Apply Prettier config (should be last to override formatting rules)
  prettierConfig,
];
