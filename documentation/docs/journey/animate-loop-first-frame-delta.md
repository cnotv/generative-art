---
sidebar_position: 127
---

# A view's first animated frame lies about elapsed time

Any scene that steps its own physics or motion from a measured delta time, rather than
letting a library own that clock, has to decide when its very first "previous frame"
timestamp was taken. Taking it too early is invisible in the code and only shows up once
several independent objects, meant to move on their own separate schedules, mysteriously
end up perfectly synchronized.

## The mechanism

A view's script sets up its module-level state, including a starting timestamp for
delta-time tracking, the moment the component itself is created. The scene it drives,
though, is rarely ready to render on that same tick: loading a hand-tracking model, an
environment map, or any other awaited asset pushes the first actual animation-loop callback
out by however long that loading took. The gap between "component created" and "first frame
actually ran" becomes that first frame's measured delta, and it is not a normal frame's
worth of time. It can be several hundred milliseconds, or, on a slow load, several seconds.

Anything that integrates motion from that delta on the very first tick receives one
enormous step instead of a normal one. A system that expects to only ever see delta values
on the order of a sixtieth of a second gets, once, something orders of magnitude larger.

```mermaid
sequenceDiagram
    participant Setup as Component setup
    participant Loader as Async model/asset loading
    participant Loop as First animate() tick
    Setup->>Setup: record "previous frame" timestamp
    Setup->>Loader: await setup (model, environment...)
    Note over Loader: real wall-clock time passes
    Loader-->>Loop: setup resolves, loop starts
    Loop->>Loop: delta = now - "previous frame"
    Note over Loop: delta covers the whole load, not one frame
```

## Why it read as unrelated bugs

The symptom was several independently spawned objects, each meant to start at a random
point along its own fall and drift out of phase with the others over time, instead falling
in a perfectly synchronized row that never separated, no matter how the randomization itself
was written or re-checked. The randomization was correct in isolation: seeding each object
with a different starting position produced different starting positions, confirmed by
reading the values straight out of the running scene. What erased the difference was a
downstream step common to all of them: whatever integrates from a delta large enough will,
in one step, carry every object past whatever "reached the end, restart" boundary it has,
regardless of where each one started. Restarting resets both position and velocity to the
same fixed values for everyone, so the very first frame quietly collapsed an intentionally
randomized field into one shared state, and every frame after that only reinforced the
appearance that the objects had never been independent to begin with.

The same first-big-step pattern also has nothing to do with startup specifically: a
backgrounded browser tab (see the Browser pane rAF throttling entry in this section) that
regains focus mid-session produces an identical single oversized delta, on whatever frame
happens to run next, for exactly the same reason: a real gap in wall-clock time landing
between two consecutive measurements.

## The correct mental model

A hand-rolled delta-time clock is only trustworthy from the moment its consuming loop
actually starts ticking, never from whenever the surrounding component happened to be
constructed. Reset the "previous frame" timestamp immediately before the first tick is
armed, after every await that could have taken real time, not once at the top of setup.

That alone only protects the very first frame. The same unbounded step can recur later from
any real-world timing gap, so anything stepping physics or motion from a raw measured delta
should also clamp that delta to a small sane ceiling before using it, independent of why the
gap happened. A capped delta turns an invisible one-frame catastrophe into, at worst, one
slightly larger step that looks like nothing happened at all.
