---
sidebar_position: 1
---

# Monorepo Architecture

WebGameKit is organized as a **pnpm workspace monorepo** with multiple packages and a main application.

## Structure Overview

```
generative-art/
├── src/                      # Main Vue.js application
│   ├── views/               # Route-based scenes
│   │   ├── Games/          # Game implementations
│   │   ├── Experiments/    # Three.js experiments
│   │   ├── Generative/     # Generative art
│   │   └── Tools/          # Development tools
│   ├── components/          # Shared Vue components
│   └── utils/              # Application utilities
├── packages/                # Workspace packages
│   ├── @webgamekit/threejs # Three.js + Rapier core
│   ├── @webgamekit/animation # Animation system
│   ├── @webgamekit/controls # Input controllers
│   ├── @webgamekit/game    # Game state management
│   └── @webgamekit/audio   # Audio utilities
└── documentation/           # This documentation site
```

## Package System

### Why a Monorepo?

- **Code reusability**: Share game engine code across multiple projects
- **Version management**: Keep packages in sync
- **Development workflow**: Hot Module Replacement across packages
- **Type safety**: Shared TypeScript types across packages

### Workspace Configuration

The monorepo uses pnpm workspaces, configured in `pnpm-workspace.yaml`:

```yaml
packages:
  - 'packages/*'
```

### Package Dependencies

Packages are linked using workspace protocol:

```json
{
  "dependencies": {
    "@webgamekit/threejs": "workspace:^",
    "@webgamekit/controls": "workspace:^"
  }
}
```

## Development Workflow

### Working on Packages

1. **Edit package source**: Changes in `packages/*/src/**` hot-reload automatically
2. **Vite aliases**: Development resolves to source files, not builds
3. **No manual builds needed**: During development, imports resolve to `/src/index.ts`

### Building for Production

```bash
# Build all packages
pnpm -r run build

# Build specific package
cd packages/threejs && pnpm build
```

Each package builds:
- **ESM bundle** (`dist/index.js`)
- **UMD bundle** (`dist/index.umd.cjs`)
- **TypeScript declarations** (`dist/**/*.d.ts`)

### Testing

```bash
# Run all tests
pnpm test:unit

# Watch mode
pnpm test:unit -- --watch
```

## Package Details

### @webgamekit/threejs

**Core 3D engine** with Three.js and Rapier physics integration.

**Key modules**:
- `getTools()`: Scene initialization
- `setup()`: Configure camera, lights, ground
- `animate()`: Timeline-based animation loop
- Model loading and physics helpers

**Technologies**:
- Three.js (3D rendering)
- Rapier3D (physics engine)
- Post-processing effects

### @webgamekit/animation

**Animation utilities** for character movement and timelines.

**Features**:
- Physics-based character movement
- Timeline system for animations
- Model type definitions
- Coordinate tuple utilities

### @webgamekit/controls

**Multi-input controller** supporting keyboard, gamepad, touch, and mouse.

**Features**:
- Unified action mapping
- Virtual joystick for mobile
- Gamepad support with fallback
- Event-driven architecture

### @webgamekit/game

**Reactive game state management**.

**Features**:
- Shallow reactivity for performance
- Action-based state updates
- Framework-agnostic core

### @webgamekit/audio

**Audio playback utilities** for background music and sound effects.

**Features**:
- Simple audio playback API
- Volume control
- Multiple audio source support

## Adding New Packages

1. **Create package directory**:
```bash
mkdir -p packages/my-package/src
cd packages/my-package
```

2. **Initialize package.json**:
```json
{
  "name": "@webgamekit/my-package",
  "version": "0.0.1",
  "main": "./dist/index.umd.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.umd.cjs"
    }
  },
  "scripts": {
    "build": "vite build && tsc",
    "test": "vitest"
  }
}
```

3. **Create vite.config.ts** (copy from existing package)

4. **Add to Vite aliases** in root `vite.config.ts`:
```typescript
resolve: {
  alias: {
    '@webgamekit/my-package': fileURLToPath(
      new URL('./packages/my-package/src/index.ts', import.meta.url)
    )
  }
}
```

5. **Install in main app**:
```bash
pnpm add @webgamekit/my-package -w
```

## Publishing Packages

:::warning
Packages are currently private and not published to npm.
:::

To publish packages:

1. Update version in `package.json`
2. Build package: `pnpm build`
3. Publish: `pnpm publish --access public`

## Best Practices

### Package Design

- **Framework-agnostic**: Keep packages independent of Vue/React
- **Pure functions**: Prefer functional programming patterns
- **Export types**: Always export TypeScript types from `index.ts`
- **Barrel exports**: Use `index.ts` to export public APIs

### Development

- **Test coverage**: Write unit tests for all packages
- **Type safety**: Use strict TypeScript configuration
- **Documentation**: Document public APIs with JSDoc
- **Linting**: All code must pass ESLint checks

### Code Organization

```
package-name/
├── src/
│   ├── index.ts           # Public API exports
│   ├── types.ts           # Type definitions
│   ├── core.ts            # Main implementation
│   ├── core.test.ts       # Unit tests
│   └── helpers/           # Internal utilities
├── vite.config.ts         # Build configuration
├── tsconfig.json          # TypeScript config
└── package.json           # Package manifest
```
