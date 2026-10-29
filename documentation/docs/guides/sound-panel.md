---
sidebar_position: 28
---

# Editing a game's sounds in the Sound panel

The Sound panel sits beside Config, Debug and Timeline in the top bar, shown by a music note
icon. It appears in any view that registers sounds with it, and `?sound=true` in the address
opens it directly. In Rock Runner it lists the music, the rolling rumble, the bump, the fall
and the finish chime.

![The Sound panel open over a Rock Runner run, on the bump sound](/img/rock-runner/sound-panel.webp)

## Editing

Pick a sound, edit its Strudel code in the editor (the same one the Strudel Editor uses, with
completions and hover help) and press **Apply**, or Ctrl+Enter in the editor. The code is
rendered offline in the browser, faster than real time, and the result replaces the sound in the
running game. **Reset** puts the sound the game ships with back. A sound that has been edited is
marked in the list.

The game never plays the Strudel code. Strudel only renders it to an audio file, the way the
Strudel Editor's export tab does, and the game plays that file as it always does. The engine
loads on the first Apply, not when the game starts, so a game that nobody edits carries no cost.

- A **loop** sound, such as the music, is rendered for a fixed number of cycles.
- A **one-shot** sound, such as a bump, is rendered for one repetition of its pattern, measured
  from the code, so `fast(2)` does not render twice.
- The result is scaled to a normal level, so a pattern that is quiet in the editor is not quiet in
  the game.
- Code that does not run shows its error under the editor and leaves the game's sound alone.

Edits live in the page only: a reload goes back to the shipped sounds. To keep one, copy the code
into the sound's `.strudel` file and render it with `scripts/strudel-export.mjs` (see the
[Strudel Editor guide](./strudel-editor.md)).

## Registering a game's sounds

A view calls the store when it mounts and unregisters when it unmounts, as it does for the Config
panel. Each slot gives the Strudel code the sound ships with, which also serves as Reset.

| Field        | Meaning                                                      |
| ------------ | ------------------------------------------------------------ |
| `id`         | what the game's handler receives to know which sound changed |
| `label`      | the button in the panel                                      |
| `code`       | the shipped Strudel code                                     |
| `kind`       | `loop` or `once`                                             |
| `loopCycles` | for a loop, how many cycles to render                        |

The handler receives the slot id and the new WAV bytes, or `null` when the slot was reset and the
game should go back to its own file. Rock Runner's is `replaceSound` in
`game/useRockRunnerAudio.ts`, and its slots are in `soundSlots.ts`.

Source files: `src/stores/soundPanel.ts`, `src/components/panels/SoundPanel.vue`,
`src/utils/soundRender.ts`, `src/types/soundPanel.ts`.
