---
sidebar_position: 112
---

# Traps outside the renderer

Building Rock Runner turned up a set of problems that had nothing to do with
geometry or physics. They are collected here because each one presented as a
puzzle about the game and turned out to be a rule of the surrounding framework —
Vue's reactivity, the CSS overflow spec, or a registry that had to be updated in
more places than it looked.

:::note Source files

`src/views/Games/Lobby/Lobby.vue`, `src/components/panels/ConfigControls.vue`,
`src/components/ui/slider/Slider.vue`,
`src/views/Games/RockRunner/scatter/scatterPanel.ts`.

:::

## A registry with one entry missing fails somewhere else entirely

Joining a Rock Runner room from the lobby did nothing: the game picker simply
reappeared. Nothing in the game was at fault. The lobby holds a map from game
type to that game's player-list store, and the new game had been added to the
type union and to the component map but not to that third one. Reading the
missing entry threw, the render of the game component failed, and the fallback
was the picker.

The type union is `Record<GameType, …>`, so a missing key _should_ have been a
compile error. It is worth registering that the check did not fire here rather
than trusting it: when adding a variant to a union, grep for every
`Record<ThatUnion, …>` rather than relying on the type system to find them.

## Hiding one overflow axis silently scrolls the other

Controls in the properties panel were being clipped — the last row of each group
was cut off, with a scrollbar appearing on a container nobody had made
scrollable.

The container set `overflow-x: hidden` and nothing else, which reads as "stop
wide rows stretching the panel". But the CSS specification says that when one
axis is `hidden` and the other is `visible`, the `visible` one computes to
`auto`. Setting one axis had quietly turned the element into a vertical scroll
container, and an accordion animating its height gave it something to clip.

`min-width: 0` achieves what the original line was reaching for — a flex item
that does not stretch to its content — without creating a scroll context.

## Reading through `toRaw` is not reactive

Every slider in the scatter panel moved the world correctly but displayed a
stale number. The value was being read through `toRaw`, which returns the
underlying object and therefore performs an untracked read: Vue never learned
that the component depended on it, so nothing re-rendered.

`toRaw` is right when handing state to non-Vue code — the placement maths takes
a plain snapshot and should not pay for proxies. It is wrong on the path that
feeds the template. The two uses look identical at the call site, which is what
makes this worth writing down.

## Controls sized without reference to what they sit in

The slider's thumb was larger than its own track and bulged out of the panel
rows it sat in. Not a bug so much as a component sized in isolation, and a
reminder that a shared UI control is only correct in the context it is placed
in.

## A picker that no longer picked anything

The lobby let players choose a rock texture. Once the rock took its appearance
from a scanned material rather than a texture, that control changed nothing
about the player's own rock — it only tinted other players' ghosts.

The fix was not to rewire it but to delete it, along with the field it wrote
and the places that carried it through the session. A control that no longer
does what its label says is worse than no control, and a value threaded through
a store and a network payload for no reason is worse still.
