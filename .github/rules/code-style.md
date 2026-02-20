# Code Style Guidelines

## Uncertainty & Debugging

- **Ask before assuming**: If uncertain about expected behavior, physics interactions, or edge cases, ask for clarification before implementing
- **Always ask when choices exist**: When multiple implementation approaches are possible, ask the user which direction to take before coding
- **Use debugger, not console.log**: Prefer `debugger` statements over `console.log()` for debugging. Use browser DevTools breakpoints and step-through debugging
- **Three.js debug helpers**: Use AxesHelper, ArrowHelper, BoxHelper, or Rapier debug renderer to visualize 3D issues
- **Validate assumptions**: For movement, collision, or animation issues, request screenshots, video, or specific numeric values (positions, distances, angles)
- **Iterative approach**: Complex 3D behaviors often need iterative refinement — propose small testable changes rather than large rewrites

## Comments

- **Meaningful comments only**: Add comments only when they explain WHY, not WHAT the code does
- **Self-documenting code**: If code needs a comment to explain what it does, refactor for clarity instead
- **No debug comments**: Never commit commented-out debug notes, thought processes, or "was X, now Y" annotations
- **No redundant comments**: Avoid comments that repeat what the code already says (e.g., `// Set rotation` before `setRotation()`)
- **JSDoc for public APIs**: Use JSDoc for exported functions with `@param` and `@returns`, but keep descriptions concise

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
  - Use CSS variables from `_variables.scss` for theming
  - Keep styles close to the components that use them

## CSS Conventions

- **BEM methodology**: Use Block__Element--Modifier naming for all CSS classes
- **Scoped styles**: Use `<style scoped>` in Vue components
- **Example**: `.player-controls__button--active`, `.game-ui__score-display`
- **Light and dark theme**: Always provide both light and dark mode colors. Use CSS variables from `_variables.scss` where possible, and add `@media (prefers-color-scheme: dark)` overrides for any hardcoded color values

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
