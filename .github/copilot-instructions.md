# Generative Art - WebGameKit Project

<!-- Rules are defined in .github/rules/ and loaded via .vscode/settings.json -->
<!-- @include: rules/code-style.md -->
<!-- @include: rules/testing.md -->
<!-- @include: rules/security.md -->

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
Closes #<issue-number>

## Summary
- Brief bullet points of what was implemented

## Key Changes
- File-by-file or module-by-module breakdown of changes

## Test Plan
- [ ] Checklist of testing performed

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

**ALWAYS include `Closes #<issue-number>` at the top of every PR body** to automatically link and close the related issue on merge.

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
- **Never nest Accordions**: panel content must have at most one level of Accordion. Sub-groups inside an `AccordionContent` must be rendered as plain labeled sections, not another `Accordion`.
- **No intermediate wrappers**: panel slot content goes directly inside `GenericPanel` with no extra wrapper `div`s between the sheet container and the controls.

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

Example: [ForestGame/config.ts](../src/views/Games/ForestGame/config.ts)

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
