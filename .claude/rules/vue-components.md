---
paths:
  - 'src/components/**'
  - 'src/views/**'
  - 'src/assets/styles/**'
---

# Vue components and styles

## Structure

- Vue SFCs with `<script setup lang="ts">`. Never plain JavaScript.
- **Never hand-roll a control that `src/components/ui/` already provides.** A raw `<button>`
  or `<input>` in a view or component is a bug: use `Button` and `Input`, and likewise
  `Select`, `Checkbox`, `Switch`, `Slider`, `Accordion`, `Tabs`, `Toggle`, `ColorPicker`,
  `CoordinateInput`, `ButtonSelector` and `Sheet`. They carry the focus, disabled and
  theming behaviour that a bare element does not, so a hand-written one drifts from the rest
  of the app and has to be restyled on every token change. Check `src/components/ui/index.ts`
  before writing markup for anything interactive.

  Raw elements are acceptable only for genuinely structural or non-interactive markup
  (`<p>`, `<ul>`, `<section>`, `<pre>`) and for a control the kit has no equivalent of — in
  which case ask before building one, rather than inlining a one-off widget in a view. This
  applies to app chrome; in-game and editor overlays use the LobbyUI kit instead, per the
  LobbyUI rules.

- Never add a wrapper element that adds no layout, semantics or behaviour the parent cannot
  already provide. If you are adding a `<div>` only to transfer styles the parent layout
  already handles, delete it and rely on the layout. In particular, do not wrap a single
  child just to centre it when the parent slot already centres, and do not set `grid-area`
  on a component's root when the parent grid already assigns that area to the slot's direct
  child.
- Extract non-trivial interactive elements (a canvas editor, a timeline scrubber, a
  drag-and-drop zone) into their own component under `src/components/`. The view stays a
  thin wrapper that wires props and emits. Split large components by responsibility and move
  stateful logic into a co-located `use*.ts`.

## State

- **Pinia** (`src/stores/`) when state is shared by unrelated components — scene elements,
  texture groups, camera config, active panels. It gives DevTools visibility and predictable
  cleanup.
- **Composables** for reusable behaviour and state scoped to one feature or component tree.
- Never declare a module-level `ref()` in a composable to share state globally. It is
  invisible to DevTools, never cleans up, and goes stale in tests. Use Pinia.

## CSS

- BEM naming: `.block__element--modifier`, in `<style scoped>`.
- **Never use `:deep()`.** No exceptions.
- **Never pass style information into a child through CSS custom properties.** Setting
  `--some-var` on a parent for a child to read couples the parent to the child's internals,
  exactly as `:deep()` does. If a child needs to look different in different contexts, give
  it a `variant` prop and let it apply its own modifier class.
- Never use Tailwind utility classes inside `src/components/`. Page-level views and layout
  wrappers may.
- Every value — font, spacing, colour, z-index, radius, border — comes from a `var(--…)`
  token defined in `src/assets/styles/_variables.scss`. If a token is missing, add it there
  first, including its dark-theme override. Never a raw value in a component block, and
  never a `$name:` SCSS variable.
- Light and dark are both defined centrally in `_variables.scss`. Never put a dark-mode
  override in a component's scoped styles.
- Never `!important` outside a utility class designed to override, such as in `vendor.scss`.
  If a style is not applying, fix the specificity.
- Never put `overflow: hidden` on an element that also has a text or box shadow — the
  boundary clips the shadow. Split it: a wrapper carries `overflow: hidden` and `max-width`,
  and the inner element gets padding equal to the largest shadow offset with a compensating
  negative margin.

## Style file ownership

| File                       | Holds                                         |
| -------------------------- | --------------------------------------------- |
| `_variables.scss`          | every CSS variable and both theme definitions |
| `game-ui.scss`             | in-game typography and text-shadow tokens     |
| `lobby-ui.scss`            | the `--lui-*` token set                       |
| `vendor.scss`              | third-party overrides, kept isolated          |
| the SFC's `<style scoped>` | everything specific to that component         |

`--shadow-text-game` and `--shadow-text-game-large` are em-based so they scale with
`font-size`; never override them with hardcoded `rem` or `px`. Timers and counters use a
dark fill so the white outline reads; all other game text uses a saturated or white fill.
Semantic colours (`#ffd700` winner, `#f44` danger) stay as they are.

## Layout

- Every view adds `padding-top: var(--nav-height)` so the fixed nav does not cover content.
- Name every distinct region twice: a BEM element class describing its role (`.me__topbar`,
  never `.me__box1` or a positional name like `.me__left`), and — when regions share a
  container — a named `grid-template-areas` area, so the grid places them and they cannot
  overlap. Never stack independently absolute-positioned regions that can drift over
  each other.

## Accessibility

- Every icon-only button carries an accessible label describing its action — an `aria-label`
  at minimum. There is no tooltip primitive in `src/components/ui/` yet; if a change needs
  hover tooltips, ask before building one rather than adding an ad-hoc widget.
- Game-over and results screens focus the primary action on mount for the player allowed to
  trigger it, via a `ref` and `(reference.value?.$el as HTMLElement | undefined)?.focus()`.
  The `.lui-btn--cta` focus state is the highlight — do not add component-specific focus styles.
