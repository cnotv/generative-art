---
sidebar_position: 123
---

# Embedding a Repository Runner: The Isolation Deadlock

The playground was meant to run any starter from GitHub inside itself: pick a repository, watch it
boot in a frame, never leave the app. It ships running **this repository's own starters** in a
frame, and nobody else's. What closed the door on the general case is a constraint that no amount
of reading our own code would reveal, because it lives entirely in the headers of two servers
neither of which we control.

## What a browser runner actually needs

Services that install and serve an arbitrary repository in the browser do it inside a virtual
machine built on `SharedArrayBuffer`. Since Spectre, browsers only hand that primitive to a page
that is **cross-origin isolated**, which a page earns by sending two headers: an opener policy
that severs its relationship with whatever opened it, and an embedder policy that promises every
subresource it pulls has opted in to being embedded.

Isolation is not a property a page can claim alone. It is negotiated down the whole frame tree.

## The deadlock

The negotiation has a rule that only bites when the runner is in an iframe rather than a tab: a
nested document inside an isolated parent must itself assert an embedder policy, or the browser
refuses to load the frame at all. So the parent's two choices lead to two different failures.

```mermaid
flowchart TD
    A[Playground embeds a third-party runner] --> B{Does the playground<br/>send isolation headers?}
    B -->|No| C[Frame loads and clones the repo]
    C --> D[Runner asks for SharedArrayBuffer]
    D --> E[Refused: 'Unable to run Embedded Project']
    B -->|Yes| F{Does the runner's embed response<br/>assert an embedder policy?}
    F -->|No| G[Frame never loads:<br/>blocked by response, COEP]
    F -->|Yes| H[Works, and is not our decision to make]
```

The cruel part is that the two failures look nothing alike. Without the headers the runner gets
far enough to clone the repository and print progress, so the frame looks alive and the error
reads like a runner problem. With the headers there is no frame at all, no progress, and a
console message naming a policy rather than a service. It is easy to read the second state as a
regression caused by the first fix, and to spend the next attempt loosening the headers again.

The permissive embedder policy is a trap here for the same reason. It exists precisely so that
cross-origin subresources keep working without each one opting in, which makes it the obvious
gentler choice, and it does nothing at all for this case: the rule it relaxes covers
subresources, not nested documents. A frame still needs its own policy either way.

## Why the escape hatches are not there

| Route                                         | Why it fails                                             |
| --------------------------------------------- | -------------------------------------------------------- |
| Set the headers only while the loader is open | Isolation is a property of the document, fixed at load   |
| Ask the runner to send the missing policy     | Their embed response, their decision                     |
| Use a runner that builds server side instead  | The anonymous import path for the obvious one now 422s   |
| Build the repository in the page ourselves    | A TypeScript toolchain in the browser, to preview a link |

The last row is the one worth naming out loud. Every alternative to embedding somebody else's
repository is some amount of compiler shipped to the client, and the thing being bought is a
preview pane.

## The shape that survived

The whole negotiation exists to protect one origin from another. Our own starters are not another
origin, so none of it applies to them, and the feature that was worth having turns out to be the
one the browser never objected to.

The starters are standalone builds, but they sit below this app's Vite root, and a dev server
already serves every HTML file below its root. Only the production build had to be told about
them, by naming their pages as extra entries rather than assuming the single one at the root.
That left them as ordinary pages of the same site, which is a link, so they were appended to the
navigation the app already had rather than given a loader, a frame or a button of their own. The
feature that began as a virtual machine in an iframe ended as two more entries in a list.

![The navigation panel scrolled to its end, where an Examples group holds Platformer and Endless Runner alongside every other route](/img/starters/navigation-examples.webp)

## The general lesson

Before designing around an embed, check what the embedded document sends, not just whether it
renders. A service can be perfectly embeddable in the sense that it refuses no frames, and still
be unusable because the thing it needs to do inside that frame is gated on a negotiation both
ends have to join. The headers are the contract; the rendering is not evidence of one.

And when a constraint only applies across origins, the cheapest answer is often to stop crossing
one.
