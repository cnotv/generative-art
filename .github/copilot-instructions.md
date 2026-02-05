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
5. **Screenshots for visual changes**: ALWAYS include screenshots when PRs involve visual changes (UI components, Three.js scenes, browser tests, etc.). Save screenshots to `.github/screenshots/` and reference them in the PR description

### PR Description Format
```markdown
## Summary
- Brief bullet points of what was implemented

## Screenshot (if applicable)
![Description](.github/screenshots/filename.png)

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
