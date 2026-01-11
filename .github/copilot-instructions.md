# Generative Art - WebGameKit Project

This is monorepo containing mainly 2 parts:
- An agnostic toolkit for creating 3D environment, games and animations, as well as all-in-on controls, audio and more
- A personal playground where to try the toolkit, as well as interactive generative art, Three.js and Rapier physics experiments

## Architecture Overview

The project is organized as a **pnpm workspace monorepo**:
- **Main app** (`src/`): Vue 3 SPA with route-based scene organization
- **Packages** (`packages/@webgamekit/*`): Reusable game development libraries
  - `threejs`: Three.js + Rapier physics integration, scene setup, model loading
  - `animation`: Character animation, physics-based movement, timeline system
  - `controls`: Multi-input controller (keyboard, gamepad, touch, mouse)
  - `game`: Reactive game state management
  - `audio`: Audio playback utilities

### Data Flow Pattern
1. Views import from `@webgamekit/*` packages (aliased in vite.config.ts)
2. Each view is a self-contained scene
3. `getTools()` initializes Three.js renderer, scene, camera, Rapier world
4. `setup()` configures lights, ground, sky, camera, and defines scene objects
5. `animate()` runs timeline-based update loops (physics, animations, controls)

## Code Style & Best Practices

### Uncertainty & Debugging
- **Ask before assuming**: If uncertain about expected behavior, physics interactions, or edge cases, ask for clarification before implementing
- **Request logs/metrics**: When debugging 3D/physics issues, ask for console logs, position values, raycast results, or visual debug helpers
- **Propose debug additions**: Suggest adding temporary `console.log()` statements, Three.js helpers (AxesHelper, ArrowHelper), or Rapier debug renderer to understand the problem
- **Validate assumptions**: For movement, collision, or animation issues, request screenshots, video, or specific numeric values (positions, distances, angles)
- **Iterative approach**: Complex 3D behaviors often need iterative refinement - propose small testable changes rather than large rewrites

### Functional Programming
- **Prefer pure functions**: Avoid side effects, return new values instead of mutating
- **Function composition**: Chain small, reusable functions rather than large imperative blocks
- **Immutability**: Use `const`, spread operators, and avoid direct mutations
- **Array methods**: Prefer `map`, `filter`, `reduce` over `for` loops

### TypeScript
- **Always use TypeScript**: All new code must be TypeScript (`.ts`, `.vue` with `<script setup lang="ts">`)
- **Explicit types**: Define types/interfaces for configs, function parameters, and return values
- **Type safety**: Use `CoordinateTuple` for position/rotation/scale arrays, avoid `any`
- **Export types**: Re-export types from package `index.ts` for public APIs

### Modular Architecture
- **Barrel exports**: Use `index.ts` files to export public APIs (see `packages/*/src/index.ts`)
- **Abstract functions**: Extract reusable logic into separate functions/modules
- **Single responsibility**: Keep functions focused on one task
- **Framework-agnostic packages**: `@webgamekit/*` packages must not depend on Vue/React

### Testing
- **Always add unit tests**: Create `.test.ts` files alongside implementation files
- **Test framework**: Use Vitest (`pnpm test:unit`)
- **Test coverage**: Test core logic, edge cases, and public APIs
- **Example pattern**: See `packages/controls/src/core.test.ts`
- **No watch mode in automation**: When running tests programmatically, always use `--run` flag to prevent watch mode (e.g., `pnpm test:unit -- --run`). Kill any existing watch processes before starting new test runs with `pkill -f vitest || true`

### CSS Conventions
- **BEM methodology**: Use Block__Element--Modifier naming for all CSS classes
- **Scoped styles**: Use `<style scoped>` in Vue components
- **Example**: `.player-controls__button--active`, `.game-ui__score-display`

### Linting
- **Run lint before commit**: Husky + lint-staged enforces this automatically
- **ESLint config**: Follow project's ESLint rules (Vue + TypeScript + Prettier)
- **Fix on save**: Run `pnpm lint` to auto-fix issues
- **No warnings**: Address all lint warnings, don't suppress without reason

### Documentation
- **Use Docusaurus**: All project documentation lives in `documentation/` folder
- **Never create standalone .md files**: Use Docusaurus for all documentation needs
- **Documentation structure**:
  - `documentation/docs/packages/` - Package API documentation
  - `documentation/docs/architecture/` - Project architecture docs
  - `documentation/docs/guides/` - How-to guides and tutorials
- **Run docs locally**: `cd documentation && pnpm start`
- **Adding new docs**: Create `.md` files in appropriate `docs/` subfolder with frontmatter:
  ```markdown
  ---
  sidebar_position: 1
  ---
  
  # Your Title Here
  ```

## Key Development Patterns

### Creating a New 3D Scene/Game View

**File structure**: Create `src/views/{Group}/{SceneName}/{SceneName}.vue` (or `index.vue`)
   - Router auto-discovers views matching pattern `{Dir}/{Name}/{Name}.vue`
   - Example: `src/views/Games/ForestGame/ForestGame.vue`


### Working with @webgamekit Packages

**Import from source during development** (not build artifacts):
- Vite aliases resolve to `packages/{pkg}/src/index.ts` for HMR
- Changes to packages hot-reload without rebuilding

### Configuration Separation

Keep scene configs in separate `config.ts` files:
- Model configurations (player, obstacles, illustrations)
- Setup config (camera, lights, ground, postprocessing)
- Control bindings
- Game settings (speeds, distances)
- Asset paths

Example: [ForestGame/config.ts](src/views/Games/ForestGame/config.ts)

## Build & Development

**Commands**:
- `pnpm dev` - Start dev server
- `pnpm host --port 3000` - Network-accessible dev server
- `pnpm build` - Production build (type-checks first)
- `pnpm test:unit` - Run Vitest tests
- `pnpm lint` - ESLint fix

**Package development**: Edit `packages/*/src/**` files directly. Vite resolves aliases for HMR.

**Docker**: Use `docker-compose up` for containerized development (runs `pnpm host`)

## Router Conventions

- Routes auto-generate from `src/views/{Group}/{Name}/{Name}.vue` structure
- Group directories: `Games/`, `Experiments/`, `Generative/`, `Tools/`, `Stages/`
- Component name becomes route: `GoombaRunner/GoombaRunner.vue` → `/games/GoombaRunner`
- Index files: `SceneName/index.vue` also supported
- Route titles auto-format: `CubeMatrix` → "Cube Matrix"

## Common Gotchas

- **WASM loading**: Rapier physics requires `vite-plugin-wasm` and `optimizeDeps.exclude: ['@dimforge/rapier3d-compat']`
- **Cleanup**: Always call `destroyControls()` and cleanup functions in `onUnmounted`
- **Reactive state**: Use `shallowRef` for game state to avoid deep reactivity overhead
- **Canvas ref**: Ensure canvas ref is not null before calling `getTools()`
- **CoordinateTuple**: Always type position/rotation/scale arrays as `CoordinateTuple` for type safety

## File Organization

```
src/
  views/{Group}/{SceneName}/
    {SceneName}.vue     # Main scene component
    config.ts           # Configuration separate from logic
    helpers/            # Scene-specific utilities
  config/
    router.ts           # Auto-route generation
    scenes.ts           # Shared scene configs
  utils/                # Global utilities

packages/@webgamekit/
  {pkg}/src/
    index.ts            # Public API exports
    types.ts            # Type definitions
    core.ts             # Main implementation
```
