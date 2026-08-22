---
paths:
  - 'src/components/LobbyUI/**'
  - 'src/views/Games/**'
---

# LobbyUI and game views

## The kit is not optional

Any UI rendered over a game scene — HUDs, editor palettes and toolbars, countdowns, camera
controls — uses the LobbyUI kit: the `LobbyUI*` components in `src/components/LobbyUI/` and
the `--lui-*` tokens in `src/assets/styles/lobby-ui.scss`. Never style a game overlay with
the application theme tokens (`--color-background`, `--font-size-*`); those belong to app
chrome.

The look is minimal and clean but playful: transparent overlays with no solid panel
backgrounds or borders around groups, `--lui-font` with white fills and the layered
`--lui-text-shadow` outline, uppercase labels, `--lui-focus-color` on hover and focus, and
icon buttons with tiny key hints rather than labelled button rows. Straight borders use the
hand-drawn tokens (`--lui-radius-sketch*`); dividers use the `--lui-squiggle*` images.

- **Bring the stylesheet and the font**: any view or component rendering a `LobbyUI*` component
  needs **both**, and neither comes for free:

  ```ts
  import '@/assets/styles/lobby-ui.scss'
  import { loadGoogleFont, removeGoogleFont } from '@/utils/ui'

  const LOBBY_UI_FONT = 'https://fonts.googleapis.com/css2?family=Darumadrop+One&display=swap'
  const FONT_KEY = '<view-name>-font'

  onMounted(() => loadGoogleFont(LOBBY_UI_FONT, FONT_KEY))
  onUnmounted(() => removeGoogleFont(FONT_KEY))
  ```

  The kit components carry no stylesheet of their own, and the stylesheet only _names_
  `Darumadrop One` — nothing fetches it. Miss either half and the overlay silently falls back to
  `Arial Black`, which looks merely plain rather than broken, so it survives review. An empty
  `document.fonts` while `--lui-font` reads correctly is the signature of the missing
  `loadGoogleFont`.

- **Text sizing**: every string uses one of the `--lui-text-*` presets. Never a raw `rem`,
  `px` or `clamp()` font size. If none fits, add a new token to `lobby-ui.scss` and document
  it there.
- **Key pills**: `LobbyUIKeyPill` takes separate `keyboard` and `gamepad` lists and renders
  only the set matching the device last used, tracked by `src/composables/useInputDevice.ts`
  and fed by every controls callback through `reportInputSource`. Never render both at once;
  omit the prop for a device with no binding and the pill hides itself.
- **Showcase**: every new `LobbyUI*` component, and every new visual variant of an existing
  one, is added to `src/views/Tests/LobbyUIShowcase/LobbyUIShowcase.vue` in the same change,
  wired into a labelled `LobbyUIRow` with realistic data so it joins the focus flow. A
  component missing from the showcase is an incomplete change.

## Dialogs over a running or finished game

Every one is a transparent overlay, never a solid panel. Reference: `MarbleMadnessSummary.vue`.

1. **Shell** — root is `position: absolute; inset: 0`, flex column centred,
   `z-index: var(--z-overlay)`, `pointer-events: none`; the single content wrapper re-enables
   `pointer-events: all`. No background, border or box-shadow on any container. Result
   overlays have no backdrop at all — the scene stays visible. Blocking modal confirms blur
   rather than dim: `--lui-backdrop-tint` plus `backdrop-filter: blur(var(--lui-backdrop-blur))`
   on the backdrop only.
2. **Entrance** — the shared `.lui-slide-in` class on the content wrapper, with
   `.lui-slide-in--2` / `--3` staggering secondary sections. Never per-component keyframes.
3. **Typography** — dialogs sit over the scene, so they stay compact: title at
   `--lui-text-medium`, rows at `--lui-text-small`, hints at `--lui-text-small` or
   `--lui-text-tiny`. Every text element sets `--lui-font`, `--lui-text-color` and
   `--lui-text-shadow`; titles and buttons are uppercase; times and ranks use
   `font-variant-numeric: tabular-nums`.
4. **Semantics** — the winning row and any celebratory title is gold via
   `color: var(--lui-focus-color)` on its spans. Never a different yellow.
5. **Score rows** — rank (fixed `min-width`, centred), a small round colour dot, name
   (`flex: 1`, ellipsis), value. No backgrounds, no chips, no borders between rows: a
   player's identity is carried by their colour dot alone.
6. **Actions** — only `LobbyUIButton size="sm"`, `variant="cta"` for the primary action and
   `variant="ghost"` for secondary. Gate host-only actions with `v-if` and show a
   "Waiting for host…" line to everyone else. Key-triggered actions show their key with
   `LobbyUIKeyPill` inside the label.
7. **Focus** — auto-focus the primary CTA on mount for the player allowed to trigger it.
8. **Trap** — mount `useDialogFocusTrap(dialogRef)` from `src/composables/useDialogFocusTrap.ts`
   and render `LobbyUIFocusHint` with its hint state. The trap marks a modal scope, muting
   every non-modal `useMenuNavigation` handler behind it. Dialog-specific bindings register
   their own `useMenuNavigation(handler, undefined, { modal: true })`. Never leave background
   handlers live behind an open dialog, and never hand-build a dialog-local focus system.
   Background: `documentation/docs/guides/lobbyui-dialog-focus.md`.

## Game structure

Every game works in both solo and multiplayer unless the issue says otherwise, and auto-starts
in solo when only one player is present. Every game works both as a direct route
(`/games/<name>`) and embedded in the Lobby — never assume a parent context.

Use the shared pieces rather than a per-game copy:

| Concern                          | Use                                                                                            |
| -------------------------------- | ---------------------------------------------------------------------------------------------- |
| Lobby / profile / settings step  | `GameLobbyWizard`, wrapped in `<GameName>Lobby.vue` passing `configFields` and a `#rules` slot |
| Room id                          | `useRoomId()` from `src/composables/useRoomId.ts`                                              |
| Name, colour, match-found, leave | `useMultiplayerLobbyHandlers()`                                                                |
| Player list and chat             | `MultiplayerSidebar` with a `MultiplayerPlayer[]` prop                                         |
| Mobile Game/Chat toggle          | `GameTabBar`, with `unreadCount` wired                                                         |
| Back navigation                  | a `<GameName>Header.vue` emitting `leave-room`                                                 |
| P2P session                      | a co-located `use<GameName>Session.ts`                                                         |

`*Lobby.vue` components render `GameLobbyWizard` as their root element, with no enclosing
wrapper. Rules live in their own template-only `<GameName>Rules.vue` next to the lobby, never
inlined in the view. Multiplayer views use a two-column grid with `grid-area: main` and
`grid-area: sidebar`, collapsing the sidebar behind `GameTabBar` at 720px.

Walkthrough: `documentation/docs/guides/adding-game-to-lobby.md`.
