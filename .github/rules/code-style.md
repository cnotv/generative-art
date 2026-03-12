# Code Style Guidelines

## Uncertainty & Debugging

- **Ask before assuming**: If uncertain about expected behavior, physics interactions, or edge cases, ask for clarification before implementing
- **Always ask when choices exist**: When multiple implementation approaches are possible, ask the user which direction to take before coding
- **Use debugger, not console.log**: Prefer `debugger` statements over `console.log()` for debugging. Use browser DevTools breakpoints and step-through debugging
- **Three.js debug helpers**: Use AxesHelper, ArrowHelper, BoxHelper, or Rapier debug renderer to visualize 3D issues
- **Validate assumptions**: For movement, collision, or animation issues, request screenshots, video, or specific numeric values (positions, distances, angles)
- **Iterative approach**: Complex 3D behaviors often need iterative refinement — propose small testable changes rather than large rewrites
- **Persistent bugs → add logs**: When the user reports that a bug is still present after a fix attempt, add `console.log` statements (or `debugger` if in a browser context) at the relevant code paths to surface the actual runtime values before attempting another fix

## Comments

- **Meaningful comments only**: Add comments only when they explain WHY, not WHAT the code does
- **Self-documenting code**: If code needs a comment to explain what it does, refactor for clarity instead
- **No debug comments**: Never commit commented-out debug notes, thought processes, or "was X, now Y" annotations
- **No redundant comments**: Avoid comments that repeat what the code already says (e.g., `// Set rotation` before `setRotation()`)
- **JSDoc for public APIs**: Use JSDoc for exported functions with `@param` and `@returns`, but keep descriptions concise

## State Management

- **Pinia for global state**: When state is shared by many unrelated components (scene elements, texture groups, camera config, active panels), use a Pinia store (`defineStore` in `src/stores/`). This provides Vue DevTools visibility, consistent structure, and automatic SSR behavior.
- **Composables for logic and local state**: Composables (`use*`) are for reusable behavior and state scoped to one feature or component tree. Local state in composables cleans up automatically on unmount.
- **Never use module-level refs in composables**: Avoid `const x = ref()` at the top of a composable file to share state globally. This pattern is invisible to DevTools, never cleans up, and causes stale state in tests. Use Pinia instead.
- **Configuration-driven panels**: Panel visibility and content are driven by a central reactive store, not wired per component. Any view registers its panel configuration once and all panels update automatically.
- **Full reactivity everywhere**: Every change — panel slider, color picker, 3D viewport interaction, orbit controls — must immediately reflect in all open panels. No manual refresh required.

## Functional Programming

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

## TypeScript

- **Always use TypeScript**: All new code must be TypeScript (`.ts`, `.vue` with `<script setup lang="ts">`)
- **Explicit types**: Define types/interfaces for configs, function parameters, and return values
- **Type safety**: Use `CoordinateTuple` for position/rotation/scale arrays, avoid `any`
- **Export types**: Re-export types from package `index.ts` for public APIs

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
- **Component styles**: Component-specific styles MUST be in the Vue SFC `<style scoped>` section
  - Never put component-specific styles in global stylesheets
  - Use CSS custom properties (`var(--...)`) from `src/assets/styles/_variables.scss` for all values — never hardcode fonts, spacing, colors, z-index, border-radius, or border widths directly in a component's `<style>` block
  - Keep styles close to the components that use them
  - **No arbitrary values**: Never define fonts, spacing, colors, z-index, radiuses, or borders directly inside a component style block. Always use `var(--...)` referencing a token defined in `_variables.scss`. If a needed token is missing, add it to `_variables.scss` first (including dark-theme overrides in `.dark` / `@media (prefers-color-scheme: dark)`).
  - **No SCSS variables in components**: Do not use `$name: value` SCSS variables inside `<style scoped>`. CSS custom properties are the single source of truth for design tokens.

## Accessibility

- **Always add tooltips to buttons**: Every interactive button must include a tooltip describing its action. Use the `Tooltip`, `TooltipTrigger`, `TooltipContent`, and `TooltipProvider` components from `src/components/ui/tooltip/`. Wrap the button in `TooltipTrigger` and provide a `TooltipContent` with a concise label.

## CSS Conventions

- **BEM methodology**: Use Block__Element--Modifier naming for all CSS classes
- **Scoped styles**: Use `<style scoped>` in Vue components
- **Example**: `.player-controls__button--active`, `.game-ui__score-display`
- **Light and dark theme**: Always provide both light and dark mode colors. Define both in `src/assets/styles/_variables.scss` under `.dark / [data-theme="dark"]` and `@media (prefers-color-scheme: dark)`. Never add dark-mode overrides inside a component's `<style scoped>` — use CSS custom properties so theming is centralized.
- **No Tailwind/utility classes in components**: Never use Tailwind utility classes (e.g. `flex`, `gap-1`, `text-sm`, `h-7`) inside Vue components in `src/components/`. Use BEM class names with `<style scoped>` and `var(--...)` tokens instead. Tailwind utilities are only acceptable in page-level views or layout wrappers.

## DRY and KISS Principles

- **Don't Repeat Yourself (DRY)**: Extract shared logic into reusable functions, composables, or utilities. If the same pattern appears more than once, abstract it into a shared helper
- **Keep It Simple, Stupid (KISS)**: Prefer the simplest solution that solves the problem. Avoid over-engineering, unnecessary abstractions, or premature optimization
- **Shared setup patterns → helper**: When multiple views share a lifecycle pattern (e.g., registering scene elements, initializing Three.js scenes), extract it into a composable or helper function
- **No duplicate boilerplate**: Views and components that share the same setup/teardown logic must use the shared composable. Never copy-paste the same block across multiple files

## Modular Architecture

- **Reuse existing components**: ALWAYS check and use existing components/libraries before creating new ones. Check `src/components/ui/` for shadcn UI components and other reusables in `src/components/`. Never reinvent the wheel.
- **Barrel exports**: Use `index.ts` files to export public APIs (see `packages/*/src/index.ts`)
- **Package export prefixes**: Functions exported from packages MUST have a prefix matching the package name to avoid namespace collisions. Examples:
  - `recording` package: `recordCreate`, `recordDestroy`, `recordStart`, `recordStop`
  - `animation` package: `animateTimeline`, `animationCreate`
  - `controls` package: `controlsCreate`, `controlsDestroy`
- **Abstract functions**: Extract reusable logic into separate functions/modules
- **Single responsibility**: Keep functions focused on one task
- **Framework-agnostic packages**: `@webgamekit/*` packages must not depend on Vue/React

## Documentation

- **Use Docusaurus**: All project documentation lives in `documentation/` folder
- **Never create standalone .md files**: Use Docusaurus for all documentation needs
- **Documentation structure**:
  - `documentation/docs/packages/` — Package API documentation
  - `documentation/docs/architecture/` — Project architecture docs
  - `documentation/docs/guides/` — How-to guides and tutorials
- **Run docs locally**: `cd documentation && pnpm start`
- **Adding new docs**: Create `.md` files in the appropriate `docs/` subfolder with frontmatter:

  ```markdown
  ---
  sidebar_position: 1
  ---

  # Your Title Here
  ```

## Linting

- **Run lint before commit**: Husky + lint-staged enforces this automatically
- **ESLint config**: Follow project's ESLint rules (Vue + TypeScript + Prettier)
- **Fix on save**: Run `pnpm lint` to auto-fix issues
- **No warnings**: Address all lint warnings, don't suppress without reason
