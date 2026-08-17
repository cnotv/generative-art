---
sidebar_position: 12
---

# Package: @webgamekit/dictionary

Bundled word lists, definitions and word-picking helpers for word games. Everything ships
inside the package, so a game works offline and needs no dictionary API.

## Installation

```bash
pnpm add @webgamekit/dictionary
```

## Picking a word

```typescript
import { dictionaryPickRandom, dictionaryGetDefinition } from '@webgamekit/dictionary'

const word = dictionaryPickRandom('medium')
const definition = dictionaryGetDefinition(word) // undefined when not covered
```

`dictionaryPickRandom` takes an optional `random: () => number` as its second argument,
defaulting to `Math.random`. Pass a seeded generator to make a round reproducible — the same
seed then deals the same words, which is what lets a bug in a specific round be replayed at
all, and what lets every player in a multiplayer match receive the same word without the
server sending it.

## Word lists

```typescript
import { dictionaryGetWords, dictionaryGetBoggleWords } from '@webgamekit/dictionary'

dictionaryGetWords('easy') // readonly string[]
dictionaryGetBoggleWords() // 3–6 letters, no proper nouns
```

Both return frozen lists — treat them as read-only. The Boggle list is separate because grid
enumeration wants short, common words, while the difficulty tiers are tuned for guessing.

## Masking

```typescript
import { dictionaryMaskWord } from '@webgamekit/dictionary'

dictionaryMaskWord('elephant', 0) // '________'
dictionaryMaskWord('elephant', 0.5) // half the letters revealed, spread out
```

The reveal ratio is clamped to `[0, 1]`, and revealed letters are spaced through the word
rather than taken from the front, so a partly revealed word stays a puzzle instead of
becoming a prefix. Spaces are never masked, so multi-word answers keep their shape.

## API

| Function                                    | Returns               | Description                           |
| ------------------------------------------- | --------------------- | ------------------------------------- |
| `dictionaryGetWords(difficulty)`            | `readonly string[]`   | Full list for a difficulty tier       |
| `dictionaryGetBoggleWords()`                | `readonly string[]`   | Short-word list for grid enumeration  |
| `dictionaryGetDefinition(word)`             | `string \| undefined` | Definition, case-insensitive          |
| `dictionaryPickRandom(difficulty, random?)` | `string`              | Random word, with a pluggable source  |
| `dictionaryMaskWord(word, revealRatio)`     | `string`              | Word with a fraction of letters shown |

## Types

```typescript
type DictionaryDifficulty = 'easy' | 'medium' | 'hard'
```
