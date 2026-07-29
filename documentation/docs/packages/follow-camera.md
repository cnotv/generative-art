---
sidebar_position: 9
---

# Follow camera

`@webgamekit/threejs` ships the three cameras a game that follows a moving thing
almost always needs: a chase camera behind it, a first-person eye riding it, and
a free camera pulled back to see the whole scene. The package owns the
arithmetic and the settings; the host owns the rendering and the panel.

## What is in the package

Everything here is pure and framework-free — no Vue, no store, no DOM.

| Export                    | What it is                                             |
| ------------------------- | ------------------------------------------------------ |
| `FollowCameraMode`        | `'third' \| 'first' \| 'free'`                         |
| `FollowCameraConfig`      | Offsets for all three, plus the mode-change duration   |
| `DEFAULT_FOLLOW_CAMERA`   | A usable starting set                                  |
| `FOLLOW_CAMERA_MODES`     | The three modes in display order                       |
| `followCameraPlacement`   | Where the camera should sit and look, for one mode     |
| `followCameraEase`        | Eases a mode change so it settles rather than snapping |
| `followCameraSchema`      | Panel controls for one mode, as plain data             |
| `followCameraAllControls` | Every control across every mode                        |

### Placing the camera

`followCameraPlacement` returns a position and a look target rather than moving
anything, so the caller decides whether to snap to it, ease into it, or hand it
to orbit controls:

```ts
const { position, lookAt } = followCameraPlacement(mode, target, heading, config)
camera.position.lerpVectors(transitionStart, position, followCameraEase(alpha))
camera.lookAt(lookAt)
```

`heading` is a unit vector on the horizontal plane — usually the followed body's
smoothed travel direction rather than its raw velocity, so a brief reversal does
not flip the whole frame.

Two details are worth knowing because they are decisions rather than
implementation:

- **The first-person look target sits at the eye's own height**, so that view is
  level rather than angled down. Eye height alone decides how much of the way
  ahead is visible; there is no pitch to tune.
- **The eye rides ahead of the body, not on top of it.** Pushed forward past the
  body's own radius, the whole thing falls behind the camera and is never drawn,
  which is what stops a player seeing their own model from inside it.

## Putting it on the elements panel

The package deliberately stops at describing its controls. Rendering them is the
host's business, and `src/utils/followCameraPanel.ts` does it for this app in one
call:

```ts
const panel = registerFollowCameraPanel({
  name: 'run-camera',
  label: 'Run camera',
  mode: cameraMode, // Ref<FollowCameraMode> the view already owns
  setMode: setCameraMode,
  defaults: { thirdPersonBack: 12 }
})

// panel.config is what the render loop places the camera from
// panel.teardown() removes the row
```

That gives a row with the three modes as tabs, showing only the selected mode's
offsets rather than all eight at once.

### The two things that are easy to get wrong

**Choosing a tab switches the camera, not just the controls.** Someone tuning a
mode wants to be looking through it, so the selector calls `setMode`. The binding
runs the other way too: the helper watches the mode ref, so cycling the camera
from the keyboard moves the tabs with it.

**The element must not be typed `Camera`.** The elements panel routes any type
containing that word to its shared camera component, which renders lens and
projection instead of the element's own schema — a row typed `Camera` shows the
wrong controls entirely, with no error. The helper types the row `Rig` and puts
the readable name in the label instead.

### Doing it in another host

Nothing above is required. `followCameraSchema(mode)` is plain data, so any panel
system can render it:

```ts
const schema = followCameraSchema(mode) // selector + that mode's offsets
const every = followCameraAllControls() // all of them, if tabs are not wanted
```

The schema describes the mode selector as a `ButtonSelector` component with three
options. A host that has no such control can ignore the hint and render a select;
the key is `mode`, and its value is the `FollowCameraMode`.

## Why the config is one object

All eight values live in a single `FollowCameraConfig` rather than three per-mode
objects, because the render loop reads whichever mode is active and should not
have to know which shape it is holding. It also means a panel, a saved
preference, and a network payload all describe a camera the same way.

```mermaid
flowchart LR
    P["panel<br/>(host)"] -->|edits| C["FollowCameraConfig"]
    K["keyboard<br/>(host)"] -->|sets| M["mode"]
    C --> F["followCameraPlacement"]
    M --> F
    F -->|position + lookAt| R["render loop<br/>(host)"]
```
