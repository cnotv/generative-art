---
sidebar_position: 7
---

# Timeline Panel: Pausing and Disabling Actions

The Timeline panel (`src/components/panels/TimelinePanel.vue`) offers two
distinct ways to stop animation: pausing the entire simulation, and disabling
a single action's row without affecting any other action.

Both controls are rendered as flat, ghost-style play/pause icon buttons
(`IconButton` with a `Play`/`Pause` icon) rather than checkboxes: a `Pause`
icon means the target is currently running (click to stop), and a `Play` icon
means it is stopped (click to resume). The same convention is used for the
global pause, each per-row toggle, and the selected action's "Enabled" row in
the details panel.

## Pausing the whole simulation

The global play/pause button is backed by `timelinePanelStore.isPaused` /
`setPaused(boolean)` in `src/stores/timelinePanel.ts`. The view that owns the
scene passes this flag straight into `animate()`:

```typescript
import { useTimelinePanelStore } from '@/stores/timelinePanel'

const timelinePanelStore = useTimelinePanelStore()

animate({
  timeline,
  isPaused: () => timelinePanelStore.isPaused
})
```

When `isPaused()` returns `true`, the animation loop stops advancing frames
for everything — every action, physics step, and model animation freezes
together. This is a global switch with no per-action granularity.

## Disabling a single action row

Each row in the Timeline panel's gutter has its own play/pause button, bound to
that action's `enabled` state. Toggling it calls `handleToggleEnabled`:

```typescript
const handleToggleEnabled = (id: string | undefined, enabled: boolean) => {
  if (!id) return
  enabledOverrides.value = new Map(enabledOverrides.value).set(id, enabled)
  timelinePanelStore.source?.setActionEnabled(id, enabled)
}
```

`setActionEnabled(id, enabled)` calls `TimelineManager.updateAction(id, { enabled })`,
which updates the action's `enabled` flag in place. The `TimelineManager`
skips disabled actions when running the timeline (`src/.../index.ts`), so a
single action stops executing while the rest of the timeline — and the
simulation clock itself — keeps running.

`enabledOverrides` is a local `Map<string, boolean>` ref that mirrors the
toggle immediately in the UI (via `isActionEnabled`), so the button icon and bar
opacity update on the same frame even while the panel is paused and `bars`
hasn't recomputed yet:

```typescript
const isActionEnabled = (action: Timeline): boolean => {
  const override = action.id ? enabledOverrides.value.get(action.id) : undefined
  return override ?? action.enabled !== false
}
```

## Summary

| Control                   | Scope             | Mechanism                                                              |
| ------------------------- | ----------------- | ---------------------------------------------------------------------- |
| Global play/pause button  | Entire simulation | `timelinePanelStore.isPaused` read by `animate({ isPaused })`          |
| Per-row play/pause button | Single action     | `TimelineManager.updateAction(id, { enabled })` via `setActionEnabled` |

Use the global pause to freeze a frame for inspection (e.g. taking a
screenshot). Use a row toggle to isolate or silence one action — for example,
turning off a noisy `interval` action while debugging a different one in the
same timeline.
