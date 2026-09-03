---
sidebar_position: 125
---

# A Panel That Isn't a Panel

Why the Rig Animator's frame axis, keyframes and import/export live in their own bottom bar
instead of the app's panel system, and a Vue scoped-CSS trap that showed up while building it.

## Why not `GenericPanel`

Every other tool-specific surface in this app registers content through `registerViewConfig`
and lets the Config panel render it, or reaches for `GenericPanel` directly for something
richer. The rig timeline does neither, on purpose.

`GenericPanel` is not a plain layout wrapper: it is wired to the global panels store for its
open/closed state, and it delegates all of its actual screen placement to `Sheet`, which
teleports its content into one of two fixed side rails mounted once by the app shell. That
combination fits a surface a user opens and closes from the nav bar, stacked with whatever else
is open on that side. A frame axis with draggable, resizable keyframes on it is a different
shape of thing: it wants the full width of the viewport, docked along the bottom, always
visible while this one tool is open, with no equivalent anywhere else in the app to share
chrome with. Routing it through `GenericPanel` would mean either fighting the side-rail
placement it always applies, or teaching the panel system a bottom-docked variant for a shape
of content only one view needs.

The rig timeline is a plain component instead, mounted directly in the view's own template,
styled to match the panel system's visual language by eye rather than by sharing its CSS. It
does not appear in the global nav, because it is not a concern shared across views the way
Config, Debug or Elements are: it only makes sense while this one tool is open.

## The trap: a scoped class that never reaches the child it names

Sizing the timeline's preset picker looked like ordinary Vue: pass a class to the `Select`
component, give that class a fixed width in the parent's own `<style scoped>` block. It had no
effect. The picker rendered at whatever width its own internal trigger button's styling
produced, more than half the bar, squeezing the frame track down to nothing next to it.

Vue's `scoped` attribute works by stamping every element a component's _own_ template renders
with a unique data attribute, and rewriting that component's selectors to require it. A class
name handed to a child component as a prop is forwarded correctly, in the sense that it ends up
in the child's rendered HTML. What does not happen is the parent's scope attribute traveling
with it: the element carrying that class belongs to the child's template, so it only ever
carries the _child's_ scope attribute. A parent rule written as `.some-class[data-v-parent]`
can never match an element stamped `[data-v-child]`, no matter how exactly the class name
lines up. The rule is not wrong, it is simply unreachable, and nothing about a scoped style
block warns that a selector inside it never matched anything.

This is the same boundary the `:deep()` ban exists to name: a parent has no scoped reach into a
child's internals, styling classes included. The fix was not `:deep()`, banned outright here,
but composition: wrap the child in a plain element that belongs to the _parent's own_ template,
give that wrapper the fixed width, and let the child's own already-correct `width: 100%`
resolve against it. The wrapper is reachable by scoped CSS because it is not a child component's
output, it is the parent's.

## The general shape of both

Both findings are instances of the same boundary. A component's internals, whether that is
_how it decides to render itself as a panel_ or _what a class name ends up styling inside it_,
are not something a caller can casually reach past. Wrapping is the tool for both: build a
plain element in your own template when you need a placement, a size, or a behavior a shared
component was never built to hand you, rather than fighting the shared component into a shape
it does not naturally take.
