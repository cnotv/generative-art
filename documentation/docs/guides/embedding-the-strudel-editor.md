---
sidebar_position: 30
---

# Embedding the Strudel Editor in another project

The editor described in [Live-coding music with Strudel](./strudel-editor.md) is published from
[cnotv/strudel-node-editor](https://github.com/cnotv/strudel-node-editor) as
`@webgamekit/strudel-editor`, a Vue 3 component library. Any Vue 3 app can mount the whole
editor, or only its code editor, without copying source.

## What the host app must provide

The editor is not self-contained: it reads three things from the app around it.

| Need             | Why                                                                                                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vue 3.4 or later | It is a Vue component.                                                                                                                                                                             |
| Vue Router 4     | The open tab, pattern and mode live in the address query (`?tab=`, `?pattern=`, `?mode=`), so a router must be installed, even on a single-route app.                                              |
| Pinia 2          | The AI settings and instrument stores use it, so `app.use(createPinia())` must run before the editor mounts.                                                                                       |
| A modern bundler | It ships ES modules at the `esnext` target, with web workers for transcription and instrument rendering, and expects a bundler that handles `new URL(..., import.meta.url)` workers, such as Vite. |

Vue, Vue Router and Pinia are peer dependencies; everything else, including the Strudel engine
and CodeMirror, installs with the package.

## Install

```bash
pnpm add @webgamekit/strudel-editor vue vue-router pinia
```

## Mount it

Import the stylesheets once, then use the component as any route or child component.

```ts
import '@webgamekit/strudel-editor/tokens.css'
import '@webgamekit/strudel-editor/style.css'
import { StrudelEditor } from '@webgamekit/strudel-editor'
```

`style.css` holds the component styles. `tokens.css` holds default values for the design tokens
they read (`--color-*`, `--spacing-*`, `--font-size-*`, `--radius-*`, `--btn-*-height` and
`--font-mono`), with a dark variant under `prefers-color-scheme`, `.dark` or
`[data-theme='dark']`. Its selectors have zero specificity, so a token the host already defines
wins. Import it before the host's own styles. If the host defines every token itself, skip it.

The editor is heavy, so load it only when it is opened:

```ts
const StrudelEditor = defineAsyncComponent(() =>
  import('@webgamekit/strudel-editor').then((module) => module.StrudelEditor)
)
```

## Size

The editor fills `100dvh`, because it was built as a full-page view. Inside a smaller container,
set `--strudel-editor-height` on the editor or any ancestor:

```css
.music-panel {
  --strudel-editor-height: 40rem;
}
```

## Adding your own buttons

`StrudelEditor` has one slot, `actions`, rendered in its toolbar. The Sound panel in
[generative-art](https://github.com/cnotv/generative-art) uses it for "Use code in sound" and
"Close".

```vue
<StrudelEditor>
  <template #actions>
    <button type="button" @click="saveAndClose">Save</button>
  </template>
</StrudelEditor>
```

## Reading and writing the editor's state

The package has two entries, so a host that only needs a helper does not load the editor.
Importing a helper from the root would pull CodeMirror and the Strudel engine into the host's
main bundle; in this repo that made the main chunk half a megabyte larger.

| Export                                       | Entry            | Use                                                                                                  |
| -------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------- |
| `StrudelCodeEditor`                          | root             | Only the CodeMirror editor, with `v-model:code` and `evaluate`, `stop` and `ready` events.           |
| `loadDefaultStrudelPlayback`                 | root             | A playback with no UI, for playing or rendering code in the host.                                    |
| `STRUDEL_SAVED_CODE_STORAGE_KEY`             | `/helpers`       | The `localStorage` key holding the code the editor last had, so a host can seed or read it.          |
| `readStrudelAddress`, `writeStrudelAddress`  | `/helpers`       | Read or clear `tab`, `pattern` and `mode` on a route query, so a host can keep its own query intact. |
| `readStrudelNoteBars`                        | `/helpers`       | The note bars of a pattern's code, for drawing a timeline.                                           |
| `useStrudelSounds`                           | `/helpers`       | The sound names Strudel has loaded.                                                                  |
| Types `StrudelPlayback`, `StrudelEditorMode` | root, `/helpers` | The shapes the above return.                                                                         |

The helpers import from `@webgamekit/strudel-editor/helpers`.

Because the editor writes its tab and pattern into the route query, a host that does not want
them should clear them when it closes the editor, as the Sound panel does with
`writeStrudelAddress`.

## What it fetches and stores

- **Samples.** Sample banks load from `strudel.b-cdn.net` and `raw.githubusercontent.com`, among
  others, so the host's content security policy must allow them.
- **AI composer.** It calls `openrouter.ai` only when the player uses the composer with their own key
  from the settings tab; the key stays in `localStorage`.
- **Storage.** Saved patterns, the current code and the AI settings use `localStorage` keys
  prefixed `strudel-`.

## Licence

The Strudel engine the editor wraps is AGPL-3.0-or-later, and so is this package. An app that
distributes it, or serves it to users over a network, carries the same obligation.

## Releasing a new version

A push to `main` in strudel-node-editor publishes every package whose version is not on npm yet,
so bump the `version` in the package's own pull request. `strudel-editor` depends on
`@webgamekit/strudel-flow`, so a change to flow needs its version bumped too.
