---
sidebar_position: 126
---

# A backgrounded Browser pane tab lies about timing

Verifying a timing-driven animation by dispatching an input, waiting a fraction of a second,
and screenshotting the result looks like a sound recipe. In the Browser pane it is not: the
wait can pass with nothing visibly happening, even though the code is correct and the same
sequence works a moment later in a fresh tab.

## The mechanism

A page's `requestAnimationFrame` callback only fires while the browser considers its tab
active and composited. A tab that has been driven for a while through repeated tool calls —
navigations, script evaluations, screenshots — can end up not actually focused from the
browser's point of view between those calls, even though it was opened with the pane's own
"foreground" option. Once that happens, the tab's rAF loop is throttled or paused entirely,
and stays that way until something forces a real composite: a screenshot capture, most
reliably, or enough real wall-clock time for the browser to decide the tab is worth waking.

The state that a running animation is built from is not affected. Dispatching a pointer
event and reading application state straight back (rather than a rendered pixel) shows the
change landed immediately and synchronously — only the _rendering_ of it stalls. When the
tab does wake, it does not resume smoothly: it applies one large `deltaTime` covering
everything that was missed, so a multi-phase transition can appear to jump straight to its
end, or an idle timeout that should not have fired yet already has.

## Why it read as a bug

A short wait after a dispatched swipe produced an unchanged screenshot, over and over,
across several fresh tabs and even a restarted dev server — a pattern that pointed
squarely at the newly written code rather than at the harness driving it. The tell,
in hindsight, was that a _slow, paced_ sequence of small dispatches with waits between each
one — the kind that keeps forcing a screenshot, and with it a composite — rendered
correctly every time, while a single dispatch followed by one longer wait did not.

## The reliable way to check timing-sensitive logic here

Poll the state the animation is driven by, not the screen, and yield to the event loop
between reads with something like a `requestAnimationFrame`-based wait loop rather than a
fixed `setTimeout`-style delay — that loop only advances once actual frames are actually
running, so it cannot "finish" against a stalled tab the way a plain timer can. Keep the
whole sequence — the wait for a clean starting state, the dispatch, and the polling — in one
script execution, since time passing between separate tool calls is exactly where an
auto-advance or a previous gesture can land unnoticed and confuse the next reading. Reserve
screenshots for the final, settled proof once the state read already confirms the behaviour;
they are still the right way to _show_ the result, just not to verify it under a tight
deadline.
