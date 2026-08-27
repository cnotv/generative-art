---
sidebar_position: 15
---

# Game UI style

Every game view uses the crisp layered text style established by GoombaRunner by default.
Deviate only when the game's brief explicitly calls for a different visual language.

![The game UI style in place: chunky outlined type, tabbed config rows and a yellow Start button](/img/rock-runner/lobby-wizard.webp)

:::note Source files
This guide tracks `src/assets/styles/game-ui.scss`, `src/utils/ui.ts` and
`src/utils/gameTimelineActions.ts`. If you change any of them, update this guide in the same
change.
:::

## Typography

| Property            | Value                                                                 |
| ------------------- | --------------------------------------------------------------------- |
| Font                | `var(--font-playful)` — `'Darumadrop One', 'Arial Black', sans-serif` |
| Weight              | always `900`, never lighter for HUD or overlay text                   |
| Counters and timers | `clamp(2rem, 5vw, 3.5rem)`                                            |
| Titles              | `clamp(3rem, 10vw, 6rem)`                                             |
| Hints               | `clamp(1rem, 2.5vw, 1.5rem)`                                          |
| Case                | `text-transform: uppercase`                                           |
| Numerics            | `font-variant-numeric: tabular-nums` on timers and scores             |
| Line height         | `1` — the font already carries generous spacing                       |

## Text shadow

Use the tokens, never a raw `text-shadow` value:

```css
/* HUD labels, hints, sub-text */
text-shadow: var(--shadow-text-game);

/* Titles, big time displays, win screens */
text-shadow: var(--shadow-text-game-large);
```

Both apply a white eight-direction inner outline over stacked black offset drops. They are
em-based so they scale with `font-size` — never override them with hardcoded `rem` or `px`,
which breaks the proportionality at large sizes. The white outline strokes stay at `1px` so
they remain crisp at any size.

## Backgrounds

Nothing sits on a card. HUD overlays are transparent, text only. Summary and game-over
screens float directly over the canvas. Buttons on overlays are
`background: transparent; border: none`, carried entirely by their text shadow.

## Interactive elements

Marble pickers, icon buttons and similar controls take no border on hover or selection —
`transform: scale(1.2)` to `scale(1.3)` alone, with `transition: transform 0.15s` so it feels
snappy rather than slow. Taken or disabled states are `opacity: 0.25; cursor: not-allowed`.

## Colour

| Role               | Value                                                       |
| ------------------ | ----------------------------------------------------------- |
| Text base          | `#fff` over the dark canvas                                 |
| Highlight / accent | `#ffd700` gold                                              |
| Danger / penalty   | `#ff4444`                                                   |
| Muted / hint       | `#fff` at reduced opacity via the `mm-hint-pulse` animation |

Timers and counters are the exception to the white fill: they use a dark fill so the white
outline creates contrast. Never apply a dark fill to a semantic colour — gold and red stay
as they are.

## Loading the style

Import the stylesheet in the root game component's `<script setup>`, never in `main.ts` or a
global stylesheet:

```typescript
import '@/assets/styles/game-ui.scss'
```

Load the font per game, and unload it again:

```typescript
import { loadGoogleFont, removeGoogleFont } from '@/utils/ui'

const FONT_KEY = 'my-game-font'
onMounted(() =>
  loadGoogleFont('https://fonts.googleapis.com/css2?family=Darumadrop+One&display=swap', FONT_KEY)
)
onUnmounted(() => removeGoogleFont(FONT_KEY))
```

## Lighting: crisp shadows by default

Every 3D game uses contact-quality directional shadows unless the brief asks for soft ones:

```typescript
lights: {
  directional: {
    shadow: {
      radius: 1,      // no PCF blur
      bias: 0,        // no halo at a tight frustum
      camera: { left: -25, right: 25, top: 25, bottom: -25, near: 0.5, far: 300 }
    }
  }
}
```

The tight frustum is what does the work. At 4096x4096, a range of ±25 gives roughly 82 pixels
of shadow map per world unit — six times sharper than the default ±150. Fit the range to the
scene and keep it as tight as it will go.

The light must follow the player every frame, or the frustum drifts off the action:

```typescript
timeline.addAction(
  createDirectionalLightFollowAction(
    () => state.directionalLight,
    () => state.playerMesh,
    LIGHT_DIRECTIONAL_POSITION as CoordinateTuple
  )
)
```

`LIGHT_DIRECTIONAL_POSITION` is a fixed world-space offset such as `[15, 30, 10]`. Both the
light and its target move with the player, so the shadow angle stays constant while the
frustum stays centred.

## Timeline action factories

Reuse these from `src/utils/gameTimelineActions.ts` rather than re-implementing them:

| Factory                              | Purpose                                               |
| ------------------------------------ | ----------------------------------------------------- |
| `createPhysicsSyncAction`            | sync a Rapier body to its Three.js mesh each frame    |
| `createDirectionalLightFollowAction` | move a light and its target to track a mesh           |
| `createCameraFollowAction`           | smooth camera follow with orbit-controls bypass       |
| `createTimerAction`                  | accumulate elapsed time and stop when finished        |
| `createFallCheckAction`              | fire a callback when a mesh drops below a Y threshold |
