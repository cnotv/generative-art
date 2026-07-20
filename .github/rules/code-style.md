# Code Style Guidelines

## Tone and Content

- **No emoji**: Never use emoji in code, comments, UI text, commit messages, documentation, or any other output unless the user explicitly requests it. Use plain SVG icons or text instead of emoji in UI.

## Uncertainty & Debugging

- **Ask before assuming**: If uncertain about expected behavior, physics interactions, or edge cases, ask for clarification before implementing
- **Ask when choices exist**: When multiple implementation approaches are possible, ask the user which direction to take before coding
- **Use debugger, not console.log**: Prefer `debugger` statements over `console.log()` for debugging. Use browser DevTools breakpoints and step-through debugging
- **Three.js debug helpers**: Use AxesHelper, ArrowHelper, BoxHelper, or Rapier debug renderer to visualize 3D issues
- **Validate assumptions**: For movement, collision, or animation issues, request screenshots, video, or specific numeric values (positions, distances, angles)
- **Iterative approach**: Complex 3D behaviors often need iterative refinement — propose small testable changes rather than large rewrites
- **Persistent bugs → add logs**: When the user reports that a bug is still present after a fix attempt, add `console.log` statements (or `debugger` if in a browser context) at the relevant code paths to surface the actual runtime values before attempting another fix

## Comments

- **Meaningful comments only**: Add comments only when they explain why, not what the code does
- **Self-documenting code**: If code needs a comment to explain what it does, refactor for clarity instead
- **No debug comments**: Never commit commented-out debug notes, thought processes, or "was X, now Y" annotations
- **No redundant comments**: Avoid comments that repeat what the code already says (e.g., `// Set rotation` before `setRotation()`)
- **No section label comments**: Do not add comments that only name what follows (e.g., `// Player` before `PLAYER_*` constants, `// Assets` before imports). Let variable and function names speak for themselves
- **JSDoc for package exports**: Every exported function in `packages/*/src/` must have a JSDoc comment with `@param` and `@returns` tags. This is enforced by `eslint-plugin-jsdoc` (`jsdoc/require-jsdoc`, `jsdoc/require-param`, `jsdoc/require-returns`). Keep descriptions concise — one line is enough

## Elements Panel

- **Descriptive element names**: Every element registered in the elements panel via `addSceneElement` or `registerElementProperties` must have a descriptive `name` and `title` — never a generic Three.js type string like `"Mesh"`, `"Object3D"`, or `"Group"`. Use the object's role in the scene (e.g., `"ground"`, `"player-ball"`, `"coin-block"`).
- **Properties are mandatory**: Every element that appears in the panel must have a non-empty schema registered via `addSceneElement` (which requires properties) or `registerElementProperties`. Elements with no configurable properties must not be added to the panel.

## State Management

- **Pinia for global state**: When state is shared by many unrelated components (scene elements, texture groups, camera config, active panels), use a Pinia store (`defineStore` in `src/stores/`). This provides Vue DevTools visibility, consistent structure, and automatic SSR behavior.
- **Composables for logic and local state**: Composables (`use*`) are for reusable behavior and state scoped to one feature or component tree. Local state in composables cleans up automatically on unmount.
- **No module-level refs in composables**: Avoid `const x = ref()` at the top of a composable file to share state globally. This pattern is invisible to DevTools, never cleans up, and causes stale state in tests. Use Pinia instead.
- **Configuration-driven panels**: Panel visibility and content are driven by a central reactive store, not wired per component. Any view registers its panel configuration once and all panels update automatically.
- **Full reactivity everywhere**: Every change — panel slider, color picker, 3D viewport interaction, orbit controls — must immediately reflect in all open panels. No manual refresh required.

## Functional Programming

- **No classes**: Use functional programming patterns — functions, types, and composition instead of classes
- **No for loops**: Use `map`, `filter`, `reduce`, `flatMap`, `Array.from`, etc. instead of for/for-of/for-in/while loops
- **Prefer pure functions**: Avoid side effects, return new values instead of mutating
- **Function composition**: Chain small, reusable functions rather than large imperative blocks
- **Split large functions**: Break down complex logic into small, single-purpose functions with descriptive names
- **Long descriptive names**: Prefer verbose, readable variable/function names over short abbreviations (e.g., `elementCount` over `count`, `randomGenerator` over `rng`)
- **Immutability**: Use `const`, spread operators, and avoid direct mutations
- **State management**: Use closures, tuples, or plain objects instead of class instances
- **No legacy/deprecated support**: Never add overloads or backward compatibility for old function signatures. When refactoring APIs, update all usages across the codebase instead of maintaining legacy signatures
- **Fix, don't patch**: Always fix issues properly instead of adding workarounds or retrocompatibility layers. If an API needs to change, update all consumers rather than supporting multiple signatures

## TypeScript

- **Use TypeScript**: All new code must be TypeScript (`.ts`, `.vue` with `<script setup lang="ts">`)
- **Explicit types**: Define types/interfaces for configs, function parameters, and return values
- **Type safety**: Use `CoordinateTuple` for position/rotation/scale arrays, avoid `any`
- **Export types**: Re-export types from package `index.ts` for public APIs
- **Exported types live in a types file**: Any exported `interface` or `type` must be declared in a dedicated types module — a `types.ts` file or a `type/` (or `types/`) folder — never exported from a file that also contains logic (a store, composable, util, or implementation). Those types files contain **only** type declarations: no functions, classes, runtime constants, or side effects. A component's own non-exported, local `interface Props {}` is exempt. When you add a new exported type, put it in the nearest types module (e.g. `packages/logic/src/types.ts`) and import it where the logic needs it; if a logic file currently exports a type, move that type to the types module and re-import it.

## Style Organization

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
- **Component styles**: Component-specific styles belong in the Vue SFC `<style scoped>` section
  - Never put component-specific styles in global stylesheets
  - Use CSS custom properties (`var(--...)`) from `src/assets/styles/_variables.scss` for all values — never hardcode fonts, spacing, colors, z-index, border-radius, or border widths directly in a component's `<style>` block
  - Keep styles close to the components that use them
  - **No arbitrary values**: Never define fonts, spacing, colors, z-index, radiuses, or borders directly inside a component style block. Always use `var(--...)` referencing a token defined in `_variables.scss`. If a needed token is missing, add it to `_variables.scss` first (including dark-theme overrides in `.dark` / `@media (prefers-color-scheme: dark)`).
  - **No SCSS variables in components**: Do not use `$name: value` SCSS variables inside `<style scoped>`. CSS custom properties are the single source of truth for design tokens.
- **In-game and editor overlay UI is LobbyUI**: Any UI rendered over a game scene (HUDs, editor palettes and toolbars, countdowns, camera controls) must use the LobbyUI kit — the `LobbyUI*` components from `src/components/LobbyUI/` and the `--lui-*` tokens from `src/assets/styles/lobby-ui.scss`. The look is minimal and clean but playful: transparent overlays with no solid panel backgrounds or borders around groups, `--lui-font` with white fills and the layered `--lui-text-shadow` outline, uppercase labels, `--lui-focus-color` hover/focus highlights, and icon buttons (`LobbyUIIconButton`) with tiny key hints instead of labeled button rows. Show keyboard/gamepad inputs with `LobbyUIKeyPill` (small letter/button pills) next to the text or icon they trigger — never as plain text hints. Straight borders use the hand-drawn tokens (`--lui-radius-sketch`, `--lui-radius-sketch-small`, `--lui-radius-sketch-round`) and underlines/dividers use the `--lui-squiggle*` images so every stroke matches the playful lettering. Never style game overlays with application theme tokens (`--color-background`, `--color-border`, `--font-size-*`, ...) — those belong to app chrome, not game UI.
- **New LobbyUI components go to the showcase**: Every new `LobbyUI*` component (and every new visual variant of an existing one) must be added to `src/views/Tests/LobbyUIShowcase/LobbyUIShowcase.vue` in the same change, wired into a labeled `LobbyUIRow` with realistic example data so it participates in the keyboard/gamepad focus flow. The PR description must list the showcase entries that were added or updated under Key Changes. A LobbyUI component that is not in the showcase is an incomplete change.
- **LobbyUI dialogs (summary, game-over, result overlays)**: Every dialog shown over a running or finished game is built as a transparent LobbyUI overlay — never a solid panel. Follow this recipe (reference: `MarbleMadnessSummary.vue`):
  1. **Overlay shell**: root element with `position: absolute; inset: 0`, flex column centered, `z-index: var(--z-overlay)`, and `pointer-events: none`. The dialog content wrapper (the only child) re-enables `pointer-events: all`. No panel background, border, or box-shadow on any container. Result overlays (summaries) have no backdrop at all — the scene stays fully visible. Blocking modal confirms (`LobbyUIConfirm`) blur the scene instead of dimming it: `background: var(--lui-backdrop-tint)` + `backdrop-filter: blur(var(--lui-backdrop-blur))` on the backdrop only.
  2. **Entrance**: apply the shared `.lui-slide-in` class (defined in `lobby-ui.scss`) to the content wrapper, and stagger secondary sections (score list, actions) with `.lui-slide-in--2` / `.lui-slide-in--3`. Never define per-component slide-in keyframes.
  3. **Typography**: dialogs sit over the scene, so they stay compact — title uses `--lui-text-medium`, rows use `--lui-text-small`, hints and waiting lines use `--lui-text-small` or `--lui-text-tiny`. Every text element sets `font-family: var(--lui-font)`, `color: var(--lui-text-color)`, `text-shadow: var(--lui-text-shadow)`, and uppercase titles/buttons. Times and ranks use `font-variant-numeric: tabular-nums`.
  4. **Semantics**: the winning row (and a celebratory title like "You win!") is gold via `color: var(--lui-focus-color)` on its text spans — never a different yellow. Rows have no backgrounds or chips — a player's identity is carried by their color dot alone.
  5. **Score rows**: flex rows of rank (fixed `min-width`, centered), a small round color dot (`background` from the player color), name (`flex: 1`, ellipsis), value/time. No borders between rows.
  6. **Actions**: only `LobbyUIButton`, `size="sm"` — `variant="cta"` for the primary action ("Play again"), `variant="ghost"` for secondary ("Back to editor"). Gate host-only actions with `v-if` and show a "Waiting for host…" line to everyone else. Key-triggered actions show their key with `LobbyUIKeyPill` inside the button label.
  7. **Focus and gamepad**: auto-focus the primary CTA on mount for the player allowed to trigger it (see the accessibility rule below — `ref` + `(reference.value?.$el as HTMLElement | undefined)?.focus()`); the `.lui-btn--cta` focus state is the highlight, no custom focus styles.
  8. **Focus is trapped inside the dialog**: every LobbyUI dialog must mount `useDialogFocusTrap(dialogRef)` from `src/composables/useDialogFocusTrap.ts` and render `LobbyUIFocusHint` with its returned hint state. The trap marks a modal navigation scope — while any dialog is open, every non-modal `useMenuNavigation` handler behind it (layout, header, editor UI) is muted, so keyboard, stick and d-pad input reach only the dialog's `data-lui-row` rows; Tab and Shift-Tab cycle within the dialog's focusables. Dialog-specific extra bindings (e.g. cancel-on-circle) register their own `useMenuNavigation(handler, undefined, { modal: true })`. Never leave background menu handlers active behind an open dialog, and never build a dialog-local focus system by hand.
- **Key pills are device-aware**: `LobbyUIKeyPill` takes separate `keyboard` and `gamepad` key lists and renders only the set matching the input device the player used last (tracked globally by `src/composables/useInputDevice.ts`, fed by every controls callback via `reportInputSource`). Never render both devices' bindings at once, and omit the prop for a device that has no binding — the pill then hides itself for that device.
- **LobbyUI text sizing**: All text inside LobbyUI components (`*Lobby.vue`, `GameLobbyWizard`, summary/game-over screens, in-game HUD) must use one of the `--lui-text-*` presets defined in `src/assets/styles/lobby-ui.scss` (`--lui-text-important`, `--lui-text-medium`, `--lui-text-small`, `--lui-text-tiny`) — never a raw `rem`/`px`/`clamp()` font-size. If no existing preset fits, add a new `--lui-text-*` token to `lobby-ui.scss` and document its purpose in the comment block above the existing presets, rather than hardcoding a size.

## Layout

- **Navigation bar clearance**: Every view must add top padding equal to `var(--nav-height)` to prevent content from being obscured by the fixed navigation bar. Apply this as `padding-top: var(--nav-height)` (or combined shorthand) on the view's root element.
- **Name every distinct layout region**: When a view or overlay is composed of multiple regions (top bar, sidebar, HUD, main scene), each region must have a meaningful name in two places: a BEM element class describing its role (`.me__topbar`, `.me__sidebar` — never `.me__box1` or positional names like `.me__left`), and — when regions share a container — a named CSS grid area (`grid-template-areas`) so regions are laid out by the grid and physically cannot overlap. Never stack independently absolute-positioned regions that can drift over each other; give them one grid container with named areas instead.

## Accessibility

- **Add tooltips to buttons**: Every interactive button must include a tooltip describing its action. Use the `Tooltip`, `TooltipTrigger`, `TooltipContent`, and `TooltipProvider` components from `src/components/ui/tooltip/`. Wrap the button in `TooltipTrigger` and provide a `TooltipContent` with a concise label.
- **Auto-focus the primary CTA on summary/game-over screens**: When a game-over or results screen mounts, the host's primary action button (e.g. "Play again") must receive focus automatically so gamepad/keyboard "fire"/"confirm" activates it immediately. Hold a `ref` to the `LobbyUIButton`, and in `onMounted` call `(reference.value?.$el as HTMLElement | undefined)?.focus()` guarded by the host check. See `MinigolfSummary.vue` / `BubbleShooterSummary.vue` for the reference pattern. The `.lui-btn--cta` focus state (`border-color`/`color: var(--lui-focus-color)`) provides the visual highlight — do not add component-specific focus styles.

## CSS Conventions

- **Never use `:deep()`**: The `:deep()` combinator is absolutely forbidden. No exceptions unless the user explicitly writes permission for a specific case in the codebase. Stylelint enforces this automatically via `selector-pseudo-class-disallowed-list`.

- **No cross-component CSS**: Never use CSS custom properties to pass style information from a parent component into a child's internals. Setting `--some-var` on a parent element so a child reads it is the same violation as `:deep()` — it couples the parent to the child's implementation details. If a child component needs different styling in different contexts, add a `variant` prop to the child and apply BEM modifier classes (`.component--variant`) internally. The parent simply passes `:variant="..."` — it has no knowledge of the child's CSS.

- **BEM methodology**: Use Block\_\_Element--Modifier naming for all CSS classes
- **Scoped styles**: Use `<style scoped>` in Vue components
- **Example**: `.player-controls__button--active`, `.game-ui__score-display`
- **Light and dark theme**: Always provide both light and dark mode colors. Define both in `src/assets/styles/_variables.scss` under `.dark / [data-theme="dark"]` and `@media (prefers-color-scheme: dark)`. Never add dark-mode overrides inside a component's `<style scoped>` — use CSS custom properties so theming is centralized.
- **No Tailwind/utility classes in components**: Never use Tailwind utility classes (e.g. `flex`, `gap-1`, `text-sm`, `h-7`) inside Vue components in `src/components/`. Use BEM class names with `<style scoped>` and `var(--...)` tokens instead. Tailwind utilities are only acceptable in page-level views or layout wrappers.
- **No `!important`**: Never use `!important` in CSS unless it is in a utility class specifically designed to override styles (e.g., vendor overrides in `vendor.scss`). If a style isn't applying, fix the specificity or selector instead.

- **Never clip shadows with `overflow: hidden`**: Do not apply `overflow: hidden` to an element that also has `text-shadow` or `box-shadow` — the overflow boundary clips the shadow. If both clipping and a shadow are needed, split responsibility: use a wrapper element for `overflow: hidden` + `max-width`, and on the inner element add `padding` equal to the maximum shadow offset with a compensating negative `margin`, so the shadow paints inside the padding area and the wrapper clips only text overflow. Example: wrapper gets `overflow: hidden; max-width: 90vw`, inner element gets `padding: 0.55em 0.65em; margin: -0.55em -0.65em`.

- **Game text shadow tokens are em-based**: The `--shadow-text-game` and `--shadow-text-game-large` drop-shadow values use `em` units so they scale proportionally with the element's `font-size`. The white outline strokes stay at `1px` (fixed, always crisp). Never override the tokens with hardcoded `rem` or `px` drop-shadow values — that breaks proportionality at large font sizes.

- **Game timer uses dark fill, other game text uses color**: Timer and counter text uses a dark fill (`#333`) so the white outline creates crisp contrast. All other game text (instructions, titles, scores, buttons) uses a saturated or white fill for visual energy. Never apply a dark fill to semantic colors — `#ffd700` (winner), `#f44` (danger/penalty) must stay as-is.

## API Changes

- **Update all call sites**: When changing a function signature, type, or exported API in any package or shared utility, find every usage across the entire codebase (`grep -r`) and update them before committing. Never leave stale callers or add backward-compatibility shims — fix all consumers in the same PR.

## DRY and KISS Principles

- **Don't Repeat Yourself (DRY)**: Extract shared logic into reusable functions, composables, or utilities. If the same pattern appears more than once, abstract it into a shared helper
- **Keep It Simple, Stupid (KISS)**: Prefer the simplest solution that solves the problem. Avoid over-engineering, unnecessary abstractions, or premature optimization
- **Shared setup patterns → helper**: When multiple views share a lifecycle pattern (e.g., registering scene elements, initializing Three.js scenes), extract it into a composable or helper function
- **No duplicate boilerplate**: Views and components that share the same setup/teardown logic must use the shared composable. Never copy-paste the same block across multiple files
- **Abstract complex UI into components**: When a view contains a non-trivial interactive element (e.g., a canvas editor, a timeline scrubber, a drag-and-drop zone), extract it into a dedicated component under `src/components/`. The view should be a thin wrapper that wires props and emits. Split large components further into sub-components by responsibility (e.g., `CanvasEditorTools`, `CanvasEditorCanvas`, `CanvasEditorStorage`) and extract stateful logic into co-located composables (`useCanvasEditor.ts`)

## Input Handling

- **Always use `@webgamekit/controls`**: For any keyboard, gamepad, or touch input, use `createControls` from `@webgamekit/controls`. Never add raw `window.addEventListener('keydown', ...)` / `window.addEventListener('keyup', ...)` directly. The controls package handles action mapping, multi-device support, and cleanup. Define a `KEYBOARD_MAPPING` constant in the co-located `config.ts`, call `createControls({ mapping })` in `init()`, read `controls.currentActions` in the game loop, and call `controls.destroyControls()` in `destroy()`. If a needed feature is missing, extend the package.

## Three.js Performance

- **No `new` in the animation loop**: Do not instantiate Three.js objects (`new Vector3()`, `new Matrix4()`, `new Quaternion()`, etc.) inside timeline actions or `requestAnimationFrame` callbacks. Each call allocates memory that the GC must collect every frame. Create objects once outside the loop and mutate them with `.set()`, `.copy()`, or `.multiplyScalars()`.
- **No `.clone()` in the animation loop**: `.clone()` allocates a new object. Use `.copy()` on a pre-allocated instance instead.
- **Dispose resources**: Call `.dispose()` on geometries, materials, textures, and render targets when removing objects from the scene. Undisposed GPU resources leak VRAM.
- **Object pooling for projectiles/particles**: When many short-lived objects are created and destroyed each frame, use an object pool — allocate a fixed array upfront and recycle instances rather than creating and garbage-collecting them.

## Multiplayer UI

- **One shared component per UI concern**: When multiple games share a UI concept (player list, chat, sidebar, turn indicator), there must be exactly one shared component in `src/components/`. Never create a game-specific copy. If a game needs slight variation, add a prop to the shared component.
- **`MultiplayerSidebar`**: All multiplayer games must use `src/components/MultiplayerSidebar.vue` for the player list + chat panel. The component accepts a `MultiplayerPlayer[]` prop; map your game's player type to that shape inside the view — do not add game-specific sidebar files.
- **`GameTabBar`**: All multiplayer games must use `src/components/GameTabBar.vue` for the mobile Game/Chat toggle. Wire `unreadCount` for badge notifications.
- **Layout contract**: Multiplayer game views must use a two-column CSS grid with `grid-area: main` for the game area and `grid-area: sidebar` for `MultiplayerSidebar`. On mobile (≤720px), sidebar is hidden/shown by a CSS modifier class toggled by `GameTabBar`.
- **Adding a new multiplayer game**: Before building any UI, check that you are using `MultiplayerSidebar`, `GameTabBar`, and the two-column grid layout. Reuse `useMinigolfSession` as the reference pattern for P2P session management.

## Lobby Game Development

- **Single-player + multiplayer by default**: Every game must work in both solo mode and multiplayer unless the issue explicitly states otherwise. When only one player is present at game start, the game auto-starts in solo mode without requiring any extra UI.
- **Always use `GameLobbyWizard`**: The lobby/profile/settings step must always use `src/components/GameLobbyWizard.vue`. Wrap it in a game-specific `<GameName>Lobby.vue` component that passes `configFields` (game-specific settings) and a `#rules` slot. Never build a custom lobby form.
- **Standalone + Lobby-embedded**: Every game must work both as a direct route (`/games/<name>`) and when embedded in the Lobby view. Do not assume a parent context.
- **Use `useRoomId()`**: Call `useRoomId()` from `src/composables/useRoomId.ts` at the top of the root game component to resolve or create a stable room ID. Never inline an IIFE pattern for this purpose.
- **Use `useMultiplayerLobbyHandlers()`**: Call `useMultiplayerLobbyHandlers()` from `src/composables/useMultiplayerLobbyHandlers.ts` for standard lobby events (name change, color change, match found, leave room). Add only game-specific overrides on top; do not duplicate the shared logic.
- **Vue-only logic → composable**: Any logic that is exclusively Vue reactive (refs, watchers, router, lifecycle hooks) and shared across games belongs in `src/composables/`. Framework-agnostic game logic belongs in `@webgamekit/*` packages.
- **Header with "← Lobby" navigation**: Every game view must include a header component that navigates back to the Lobby. Follow the pattern established by `PictionaryHeader.vue` and `BubbleShooterHeader.vue` — a dedicated `<GameName>Header.vue` component that emits `leave-room`.
- **Game-specific session composable**: Each game's P2P session logic must live in its own `use<GameName>Session.ts` composable co-located with the view. Use `useBubbleShooterSession` or `useMinigolfSession` as the reference pattern.

## Dependencies

- **No discontinued or unmaintained libraries**: Before adding any npm package, verify it is actively maintained. Check the repository's last commit date, open issues, and whether the maintainer responds to bug reports. Never use a library that has been archived, deprecated by its author, or has had no releases in over a year without a clear reason. If a well-maintained alternative exists, prefer it.

## Modular Architecture

- **Reuse existing components**: Check and use existing components/libraries before creating new ones. Check `src/components/ui/` for shadcn UI components and other reusables in `src/components/`. Never reinvent the wheel.
- **Barrel exports**: Use `index.ts` files to export public APIs (see `packages/*/src/index.ts`)
- **Package export prefixes**: Functions exported from packages must have a prefix matching the package name to avoid namespace collisions. Examples:
  - `recording` package: `recordCreate`, `recordDestroy`, `recordStart`, `recordStop`
  - `animation` package: `animateTimeline`, `animationCreate`
  - `controls` package: `controlsCreate`, `controlsDestroy`
- **Abstract functions**: Extract reusable logic into separate functions/modules
- **Reuse shared utilities first**: Before implementing Three.js patterns (camera properties, orbit controls, element registration), check `src/utils/` and `src/stores/` for existing shared utilities. Extend them if needed rather than duplicating logic inline. Key utilities: `src/utils/cameraProperties.ts` (camera + orbit), `src/utils/threeObjectUpdaters.ts` (lint-safe mutations), `src/stores/sceneView.ts` (full scene lifecycle)
- **Single responsibility**: Keep functions focused on one task
- **Framework-agnostic packages**: `@webgamekit/*` packages must not depend on Vue/React
- **Config files**: Every view that has constants, types, or configuration must extract them into a co-located `config.ts` (or `<viewName>Config.ts`) file in the same directory. The view file should only contain setup, lifecycle, and rendering logic
- **Use `getTools()`**: Three.js views must use `getTools()` from `@webgamekit/threejs` for scene initialization, and `controls.create()` / `stats` / `video` from `src/utils/` for configuration panels, performance stats, and recording

## Documentation

- **Use Docusaurus**: All project documentation lives in `documentation/` folder
- **No standalone .md files**: Use Docusaurus for all documentation needs
- **Documentation structure**:
  - `documentation/docs/packages/` — Package API documentation
  - `documentation/docs/architecture/` — Project architecture docs
  - `documentation/docs/guides/` — How-to guides and tutorials
  - `documentation/docs/journey/` — Problem-solving write-ups: the theory, research findings, and non-obvious decisions behind a feature
- **Run docs locally**: `cd documentation && pnpm start`
- **Adding new docs**: Create `.md` files in the appropriate `docs/` subfolder with frontmatter:

  ```markdown
  ---
  sidebar_position: 1
  ---

  # Your Title Here
  ```

- **Record theory and research findings in the journey**: Whenever you solve a
  non-trivial problem using theory, a mathematical technique, or findings from
  research or experiments, write it up in `documentation/docs/journey/`. Always
  capture the _why_, the underlying theory, and what the research/experiments
  revealed — not just the final code. Journey docs favour abstract prose, tables,
  and Mermaid diagrams over code snippets; include only the minimal formula or
  snippet needed to make the theory concrete. Do this as part of the same change
  that solved the problem, not later.
- **Keep tutorials in sync with the code**: When you change a file that a tutorial
  documents (its APIs, options, file paths, or worked example), update that tutorial
  in the same change so it never goes stale. Each tutorial lists the source files it
  covers in a "Source files" note near the top — when you edit any of those files,
  re-read the tutorial and fix every snippet, option name, and path that the change
  affected. Specifically, the timeline + paths tutorial
  (`documentation/docs/guides/defining-timelines-and-paths.md`) tracks
  `packages/animation/src/TimelineManager.ts`, `packages/animation/src/types.ts`,
  `src/stores/debugScene.ts`, `src/utils/pathVisualization.ts`, and
  `src/views/Tests/Timeline/Timeline.vue`; update it whenever those change.

## Linting

- **Run lint before commit**: Husky + lint-staged enforces this automatically
- **ESLint config**: Follow project's ESLint rules (Vue + TypeScript + Prettier)
- **Fix on save**: Run `pnpm lint` to auto-fix issues
- **No warnings**: Address all lint warnings, don't suppress without reason
