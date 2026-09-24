---
sidebar_position: 15
---

# Package: @webgamekit/history

A labelled undo stack, generic over whatever an editor uses as a snapshot, with an action log its consumer can show and step through.

## Installation

```bash
pnpm add @webgamekit/history
```

## The model

A history holds every state an editor has been in. `past` runs oldest first and its last entry is the state on screen now; `future` holds what undo took away, earliest first, ready to be redone.

Two things follow from that, and both matter when wiring an editor up:

- **A snapshot is the state an action produced, not the state before it.** Push after the action, never before.
- **The state the editor opened on is seeded at creation.** It is not an action, so it never appears in the log, but it is where the first undo lands. Without it the first undo has nothing to restore.

```typescript
import { historyCreate, historyPush, historyUndo, historyState } from '@webgamekit/history'

const opened = historyCreate('Opened', keyframes, 50)
const edited = historyPush(opened, 'Deleted keyframe', nextKeyframes)
const { stack, entry } = historyUndo(edited)

historyState(stack) // the keyframes to put back on screen
entry?.label // what the editor stepped back to
```

## API

### historyCreate(label, snapshot, limit)

Opens a history on the state an editor starts in. `limit` counts the states kept, that opening one included; once it is reached the oldest states are dropped, and with them the ability to undo that far back.

### historyState(stack)

The state on screen now, which is always the newest one not undone.

### historyPush(stack, label, snapshot)

Records what an action left behind, and discards anything undone: a new action replaces the branch that undo had set aside.

### historyUndo(stack) / historyRedo(stack)

Step back or forward. Each returns `{ stack, entry }`, where `entry` is the state to restore, or `null` when there was nothing to move — at the oldest state kept, or with nothing undone. The stack comes back unchanged in that case, so an editor can compare it by identity.

### historyGoTo(stack, index)

Steps straight to one action instead of walking there, in either direction, for a log whose lines can be clicked. Everything after it becomes undone and everything up to it stands. `index` is the one each log entry carries.

### historyCanUndo(stack) / historyCanRedo(stack)

Whether either step would do anything, for enabling a button.

### historyLog(stack)

Every action taken, newest first, as `{ label, undone, index }`. The opening state is left out: it is where undo lands, not something anybody did.

## Types

```typescript
interface HistoryEntry<TSnapshot> {
  label: string
  snapshot: TSnapshot
}

interface HistoryStack<TSnapshot> {
  past: HistoryEntry<TSnapshot>[]
  future: HistoryEntry<TSnapshot>[]
  limit: number
}

interface HistoryLogEntry {
  label: string
  undone: boolean
  index: number
}

interface HistoryStep<TSnapshot> {
  stack: HistoryStack<TSnapshot>
  entry: HistoryEntry<TSnapshot> | null
}
```

## Choosing a snapshot

The stack keeps `limit` snapshots alive at once, so what a snapshot costs decides what the limit can be. A keyframe list is plain data and cheap to hold; a canvas is held as a data URL, which is not. Snapshot the smallest thing that restores the editor, and keep the limit in proportion to it.

## Who uses it

`@webgamekit/canvas-editor` depends on this package and re-exports it, so a canvas editor installed on its own still has undo. In the playground, `useEditorHistory` wraps it for Vue and `EditorHistoryControls` renders the undo, redo and log control that the Rig Animator's timeline carries.
