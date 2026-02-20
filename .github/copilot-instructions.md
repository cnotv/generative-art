# Generative Art - WebGameKit Project

## Quick Rules

1. **TDD - Test-Driven Development**: ALWAYS write unit tests FIRST before implementing any feature. Present test specifications to user for confirmation before writing implementation code.
2. **Document before coding**: Add implementation plan as comment to GitHub issue before writing code
3. **Ask questions**: When multiple approaches exist, ask which to use
4. **Use debugger**: Prefer `debugger` statements over `console.log()`
5. **Run tests**: `pnpm test:unit` (not `vitest` directly)

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

## GitHub Issue Workflow

### Before Implementation
1. **Sync with main branch**: ALWAYS fetch and rebase main before creating a new branch
   - Command: `git checkout main && git fetch origin main && git pull origin main`
   - This prevents lockfile churn and merge conflicts
2. **Create feature branch**: ALWAYS create a new branch before starting work on an issue
   - Use format: `<type>/<issue-number>-<description>`
   - Examples: `feat/4-animation-clip-blocking`, `fix/12-collision-bug`
   - Branch from `main` (or current base branch)
   - Command: `git checkout -b feat/9-issue-description`
3. **Document plan in issue**: Before writing any code, add a comment to the GitHub issue describing:
   - What you plan to implement
   - Files to be modified/created
   - Key design decisions
   - Any questions or uncertainties
4. **Ask questions first**: If requirements are unclear or multiple approaches exist, ask in the issue before coding
5. **Wait for approval**: For non-trivial changes, wait for confirmation before implementing

### During Implementation
1. **Add findings to issue**: Post discoveries, architectural insights, or approach changes as issue comments
2. **Rebase before PR**: ALWAYS rebase onto main before creating a pull request
   - Command: `git fetch origin main && git rebase origin/main`
   - Resolve any conflicts, then force push: `git push --force-with-lease`
   - CI will fail if branch is behind main
3. **Update PR after pushing**: After pushing commits, ALWAYS update the PR description using `gh pr edit` to reflect the latest changes
4. **Comprehensive PR descriptions**: Include summary, key changes, test plan, and documentation. PR descriptions should be self-contained and explain all work done
5. **Monitor CI after PR**: After creating or updating a PR, monitor CI checks with `gh pr checks <number> --watch` until all checks complete. If any check fails, inspect the logs with `gh run view <run-id> --log-failed`, identify the root cause, fix it, commit, and push. Repeat until all checks pass.

### PR Description Format
```markdown
## Summary
- Brief bullet points of what was implemented

## Key Changes
- File-by-file or module-by-module breakdown of changes

## Test Plan
- [ ] Checklist of testing performed

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

### Issue Comment Format
```markdown
## Implementation Plan

### Changes
- `path/to/file.ts` - Description of changes

### Approach
Brief explanation of the chosen approach

### Questions
- [ ] Any clarifications needed?
```

### Branch Naming
Use format: `<type>/<issue-number>-<description>`
- Examples: `feat/4-animation-clip-blocking`, `fix/12-collision-bug`
- Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

## Code Style & Best Practices

### Uncertainty & Debugging
- **Ask before assuming**: If uncertain about expected behavior, physics interactions, or edge cases, ask for clarification before implementing
- **Always ask when choices exist**: When multiple implementation approaches are possible, ask the user which direction to take before coding
- **Use debugger, not console.log**: Prefer `debugger` statements over `console.log()` for debugging. Use browser DevTools breakpoints and step-through debugging
- **Three.js debug helpers**: Use AxesHelper, ArrowHelper, BoxHelper, or Rapier debug renderer to visualize 3D issues
- **Validate assumptions**: For movement, collision, or animation issues, request screenshots, video, or specific numeric values (positions, distances, angles)
- **Iterative approach**: Complex 3D behaviors often need iterative refinement - propose small testable changes rather than large rewrites

### Comments
- **Meaningful comments only**: Add comments only when they explain WHY, not WHAT the code does
- **Self-documenting code**: If code needs a comment to explain what it does, refactor for clarity instead
- **No debug comments**: Never commit commented-out debug notes, thought processes, or "was X, now Y" annotations
- **No redundant comments**: Avoid comments that repeat what the code already says (e.g., `// Set rotation` before `setRotation()`)
- **JSDoc for public APIs**: Use JSDoc for exported functions with `@param` and `@returns`, but keep descriptions concise

### Functional Programming
- **NEVER use classes**: ALWAYS use functional programming patterns. Use functions, types, and composition instead of classes
- **NEVER use for loops**: Use `map`, `filter`, `reduce`, `flatMap`, `Array.from`, etc. instead of for/for-of/for-in/while loops
- **Prefer pure functions**: Avoid side effects, return new values instead of mutating
- **Function composition**: Chain small, reusable functions rather than large imperative blocks
- **Split large functions**: Break down complex logic into small, single-purpose functions with descriptive names
- **Long descriptive names**: Prefer verbose, readable variable/function names over short abbreviations (e.g., `elementCount` over `count`, `randomGenerator` over `rng`)
- **Immutability**: Use `const`, spread operators, and avoid direct mutations
- **State management**: Use closures, tuples, or plain objects instead of class instances
- **No legacy/deprecated support**: Never add overloads or backward compatibility for old function signatures. When refactoring APIs, update all usages across the codebase instead of maintaining legacy signatures
- **Fix, don't patch**: Always fix issues properly instead of adding workarounds or retrocompatibility layers. If an API needs to change, update all consumers rather than supporting multiple signatures

### TypeScript
- **Always use TypeScript**: All new code must be TypeScript (`.ts`, `.vue` with `<script setup lang="ts">`)
- **Explicit types**: Define types/interfaces for configs, function parameters, and return values
- **Type safety**: Use `CoordinateTuple` for position/rotation/scale arrays, avoid `any`
- **Export types**: Re-export types from package `index.ts` for public APIs

### Style Organization
- **Variables**: All CSS variables and theme definitions belong in `src/assets/styles/_variables.scss`
  - Define both light and dark theme colors
  - Use semantic naming (e.g., `--color-background`, `--color-primary`)
  - Include spacing, border-radius, typography, shadows, and z-index scales
- **Panels**: Shared panel/sheet/dialog styles in `src/assets/styles/panels.scss`
  - Import `_variables.scss` at the top
  - Only include layout and structural styles shared across panels
- **Vendor**: Third-party library overrides in `src/assets/styles/vendor.scss`
  - Radix UI, Tailwind, and other external library customizations
  - Keep vendor-specific selectors isolated from application styles
- **Component styles**: Component-specific styles MUST be in the Vue SFC `<style scoped>` section
  - Never put component-specific styles in global stylesheets
  - Use CSS variables from `_variables.scss` for theming
  - Keep styles close to the components that use them

### Modular Architecture
- **Reuse existing components**: ALWAYS check and use existing components/libraries before creating new ones. Check `src/components/ui/` for shadcn UI components (Button, Sheet, Tabs, Input, Select, etc.) and other reusable components in `src/components/`. Never reinvent the wheel.
- **Barrel exports**: Use `index.ts` files to export public APIs (see `packages/*/src/index.ts`)
- **Package export prefixes**: Functions exported from packages MUST have a prefix matching the package name to avoid namespace collisions. Examples:
  - `recording` package: `recordCreate`, `recordDestroy`, `recordStart`, `recordStop`
  - `animation` package: `animateTimeline`, `animationCreate`
  - `controls` package: `controlsCreate`, `controlsDestroy`
- **Abstract functions**: Extract reusable logic into separate functions/modules
- **Single responsibility**: Keep functions focused on one task
- **Framework-agnostic packages**: `@webgamekit/*` packages must not depend on Vue/React

### Testing (Test-Driven Development)
- **TDD Workflow - MANDATORY**:
  1. Write test specifications FIRST describing expected behavior
  2. Present tests to user for confirmation BEFORE implementation
  3. Only after test approval, write implementation to make tests pass
  4. Never skip this workflow - finishing without tests means the feature is incomplete
- **Always add unit tests**: Create `.test.ts` files alongside implementation files
- **Test framework**: Use Vitest
- **Run tests**: Use `pnpm test:unit` (runs once and exits, watch mode disabled by default)
- **Watch mode**: Use `pnpm test:watch` only when explicitly needed for development
- **Test coverage**: Test core logic, edge cases, and public APIs
- **AAA pattern**: Structure tests with Arrange, Act, Assert sections
- **Parameterization - CRITICAL**: ALWAYS use `it.each()` for testing multiple similar cases. Never write multiple separate tests when they test the same logic with different inputs. Parameterized tests are more maintainable, easier to read, and prevent code duplication.
- **Example pattern**: See `packages/controls/src/core.test.ts`
- **CRITICAL**: The `test:unit` script uses `vitest run` which exits after completion. Never use raw `vitest` command without `run` subcommand or `--run` flag

### CSS Conventions
- **BEM methodology**: Use Block__Element--Modifier naming for all CSS classes
- **Scoped styles**: Use `<style scoped>` in Vue components
- **Example**: `.player-controls__button--active`, `.game-ui__score-display`
- **Light and dark theme**: Always provide both light and dark mode colors when adding custom styles. Use CSS variables from `_variables.scss` where possible, and add `@media (prefers-color-scheme: dark)` overrides for any hardcoded color values

### Git Hooks
- **Never use `--no-verify`**: NEVER use `--no-verify` flag on git commit or git push. If hooks fail, fix the underlying issue instead of bypassing them

### Linting
- **Run lint before commit**: Husky + lint-staged enforces this automatically
- **ESLint config**: Follow project's ESLint rules (Vue + TypeScript + Prettier)
- **Fix on save**: Run `pnpm lint` to auto-fix issues
- **No warnings**: Address all lint warnings, don't suppress without reason
- **Never disable ESLint rules**: NEVER use `eslint-disable`, `eslint-disable-next-line`, or `eslint-disable-line` comments. Fix the code to comply with the rules instead

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

**UI Interaction via Panels — MANDATORY**:
All user-facing controls for a view MUST live inside existing panels (Config panel, Scene panel, etc.), NOT as overlays or floating elements on the canvas. The only exception is content explicitly defined otherwise (e.g., a score HUD that is part of the game scene, or a minimal action toolbar that was explicitly requested).

- Use `registerViewConfig` to expose runtime-adjustable settings through the Config and Scene panels
- For selection-style controls, use `ButtonSelector` (`component: 'ButtonSelector'` in the schema) for visible multi-option button groups with optional color swatches
- If a panel requires a new input type not covered by existing components (`Slider`, `Switch`, `Select`, `ColorPicker`, `CoordinateInput`, `ButtonSelector`), **request a new component and describe its requirements before implementing**. Do not build ad-hoc input widgets inside view templates.
- Never use `<Teleport>` to inject content into panel slots; instead rely on the schema-driven `registerViewConfig` pipeline

**Configuration Panel Setup**:
When creating a new view, register two separate configurations for the configuration panel:

1. **Config Tab** (reactive game settings):
   - Player settings (speed, jump height, etc.)
   - Game mechanics
   - Interactive elements
   - Any runtime-adjustable parameters

2. **Scene Tab** (setupConfig-related settings):
   - Camera settings (preset, FOV, position)
   - Environment (ground color, sky color)
   - Lighting
   - Post-processing effects
   - Scene elements (illustration counts, etc.)

**Panels to show by default**: Always call `setViewPanels({ showConfig: true, showScene: true })` in `onMounted` so that both the Config and Scene panels are visible when the view loads. Only omit a panel if it has no content for that view.

**Example registration** (in `onMounted`):
```typescript
import { registerViewConfig, createReactiveConfig } from "@/composables/useViewConfig";

// Config tab - reactive game settings
const reactiveConfig = createReactiveConfig({
  player: {
    speed: { movement: 2, turning: 4, jump: 4 },
    maxJump: 4,
  },
});

// Scene tab - setupConfig-related settings
const sceneConfig = createReactiveConfig({
  camera: {
    preset: 'perspective',
    fov: 80,
    position: { x: 0, y: 7, z: 35 },
  },
  ground: { color: 0x98887d },
  sky: { color: 0x00aaff },
});

// Define control schemas
const configControls = {
  player: {
    speed: {
      movement: { min: 0.5, max: 5, step: 0.5 },
      turning: { min: 1, max: 10 },
      jump: { min: 1, max: 10 },
    },
    maxJump: { min: 1, max: 20 },
  },
};

const sceneControls = {
  camera: {
    preset: {
      label: 'Camera Preset',
      options: ['perspective', 'orthographic', 'fisheye', 'cinematic', 'orbit']
    },
    fov: { min: 30, max: 120 },
    position: {
      x: { min: -50, max: 50 },
      y: { min: 0, max: 50 },
      z: { min: 10, max: 100 },
    },
  },
  ground: { color: { color: true } },
  sky: { color: { color: true } },
};

// Register both configs
onMounted(() => {
  registerViewConfig(
    route.name as string,
    reactiveConfig,
    configControls,
    sceneConfig,
    sceneControls
  );
});

onUnmounted(() => {
  unregisterViewConfig(route.name as string);
});
```

**Configuration file structure** (`config.ts`):
Export both `configControls` (Config tab) and `sceneControls` (Scene tab) schemas separately.


### Scene Initialization with `getTools()` + `setup()` Config

**Before writing any THREE.js code**, define the scene layout declaratively via `SetupConfig` in `config.ts`.

**Step 1 — Audit `SetupConfig` options first** (check `packages/threejs/src/types.ts`):
- `scene.backgroundColor` — background color
- `lights.ambient`, `lights.directional`, `lights.hemisphere` — all lighting
- `ground.color`, `ground.size`, `ground.texture` — ground plane
- `sky.color`, `sky.texture`, `sky.size` — sky/environment
- `camera.position`, `camera.fov`, `camera.near`, `camera.far` — camera
- `orbit` — orbit controls (set `false` to disable)
- `postprocessing` — bloom, SSAO, vignette, etc.

**Step 2 — Declare the layout in `config.ts`** (never inline magic numbers in the component):
```typescript
import type { SetupConfig } from "@webgamekit/threejs";

export const sceneSetupConfig: SetupConfig = {
  scene: { backgroundColor: 0x1a1a2e },
  lights: {
    ambient: { color: 0xffffff, intensity: 1.5 },
    directional: { color: 0xffffff, intensity: 2, position: [20, 30, 20], castShadow: true },
  },
  ground: { color: 0x2c3e50, size: 200 },
  sky: false,   // disable if not needed
  orbit: false, // disable if using custom camera / controls
};
```

**Step 3 — Use `setup()` with `defineSetup` for model loading**:
```typescript
const { setup, renderer, scene, world, getDelta } = await getTools({ canvas: canvas.value });

await setup({
  config: sceneSetupConfig,
  defineSetup: async () => {
    // Load models and create physics bodies here
    character = await getModel(scene, world, "player.glb", playerSettings.model);
  },
});
```

**Step 4 — Only use raw THREE.js for unsupported features**.
If a feature is not covered by `SetupConfig` (e.g., a custom orthographic camera), **ask the user before writing manual THREE.js code**. Common cases requiring manual code:
- `OrthographicCamera` (not created by `setup()` — ask if the camera type should be added to the package)
- Custom geometry that does not map to any `getCube`/`getModel` primitive

**Never do this** (raw THREE.js inline in `init()`):
```typescript
// ❌ Wrong — use SetupConfig instead
const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);
const groundGeo = new THREE.PlaneGeometry(200, 200);
scene.add(new THREE.Mesh(groundGeo, new THREE.MeshLambertMaterial({ color: 0x2c3e50 })));
```

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
