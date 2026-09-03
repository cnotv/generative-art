---
sidebar_position: 124
---

# Dynamic Config Panel Schema: The Silent Reactivity Gap

Why `updateViewSchema` looked correct, tested correct, and still left the panel showing a
schema from before the update, and what actually makes a `shallowReactive` registry safe to
mutate.

## The setup

A view registers its Config panel schema once, at mount, through `registerViewConfig`. Some
views also need to change that schema later: a new bone list once a model loads, a new set of
options once a keyframe exists, through a separate `updateViewSchema` call. Both live in one
Pinia store, whose registry of per-route entries is declared `shallowReactive` rather than
fully `reactive`, deliberately: an entry carries a raw config `Ref`, and deep-proxying it would
fight Vue's own unwrapping rules for nested refs.

`shallowReactive` tracks reads and writes of a reactive object's own top-level keys. It does
not track anything that happens _inside_ the object a key points to. `registerViewConfig`
respects that boundary: every call replaces `registry[routeName]` with a brand new entry
object, which is exactly the kind of top-level write `shallowReactive` sees.

## Where the fix needed to happen

`updateViewSchema` did not replace the entry. It reached into the existing one and set
`entry.schema = schema`, a mutation one level below what `shallowReactive` watches. The store's
own `version` counter, bumped on every call, papered over this for direct readers: anything
computing straight off `registry[routeName].schema` after checking `version` would see the new
value, because plain JavaScript property reads always return the current value regardless of
what Vue did or didn't track.

The panel that renders the schema does not read it that directly. It goes through a `computed`
that returns the whole entry object, and a second `computed` layered on top that reads
`.schema` off whatever the first one returned. Vue's computed refs carry their own
optimization: recomputing and landing on a value that is reference-equal to the previous one
does not notify anything depending on that computed, even though the computed function itself
did run again. The first computed's `version` dependency did force it to re-execute, but since
the entry object's _identity_ never changed, only a property inside it, the computed's return
value was `===` to what it returned last time. Nothing downstream ever learned that `.schema`
was different, and the panel kept rendering whatever schema was live at mount.

## The shape of the bug, and why it hid

| Layer                                        | What it saw                                               |
| -------------------------------------------- | --------------------------------------------------------- |
| `updateViewSchema`                           | wrote the new schema; the store's own state was correct   |
| a `version`-gated computed over the entry    | recomputed, but returned the _same object reference_      |
| a second computed reading `.schema` off that | never re-ran, because its one dependency looked unchanged |
| the panel                                    | rendered a schema frozen at whatever it last saw          |

Every individual piece was doing what it was written to do. The gap only exists at the boundary
between two computeds chained together, where the first one's reference-equality short-circuit
swallows a change the second one needed to see. A test that asserts on the store's own data,
`registry[routeName].schema`, cannot see this at all, since that read never goes through the
broken chain. Only a test built the same way the real consumer is, a computed layered on a
computed, reproduces it.

## The fix, and the mental model it rests on

`updateViewSchema` now replaces the entry (`registry[routeName] = { ...entry, schema }`)
instead of mutating one of its fields. That is a top-level write to a `shallowReactive` object,
which Vue tracks on its own: the manual `version` bump becomes belt-and-braces rather than
load-bearing for this path, and every downstream computed sees a genuinely new reference to
key off.

The general rule for a `shallowReactive` (or `shallowRef`) registry of entries: **treat each
entry as immutable once stored.** Changing anything about an entry means replacing the entry,
never editing one of its fields in place. A `version`-style manual bump is not a substitute for
this: it can force a computed to _re-run_, but it cannot make that computed's _output_ look
different to whatever reads it next, if the computed keeps handing back the same object it
always did.
