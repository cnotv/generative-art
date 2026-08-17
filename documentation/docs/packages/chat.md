---
sidebar_position: 11
---

# Package: @webgamekit/chat

Message handling and guess matching for chat-driven games — the parts of a word game that
have nothing to do with the transport carrying the messages.

## Installation

```bash
pnpm add @webgamekit/chat
```

No dependencies and no transport of its own: pair it with
[`@webgamekit/multiplayer-p2p`](./multiplayer-p2p.md) or
[`@webgamekit/multiplayer-client`](./multiplayer-client-server.md).

## Messages

```typescript
import { chatMessageCreate, chatHistoryAppend } from '@webgamekit/chat'

const message = chatMessageCreate(peerId, 'Alice', ' hello ')
// { id, senderId, senderName, text: 'hello', timestamp, kind? }

const history = chatHistoryAppend(previousHistory, message, 200)
```

`chatMessageCreate` trims the body and returns `null` for an empty one, so the caller never
has to guard before sending. `chatHistoryAppend` returns a new array and drops the oldest
entries past `limit` (default 200) — a chat left open all evening cannot grow without bound.

## Guess matching

The reason this package exists: a player who types the right word with a typo, or with
different casing, has still guessed it, and a game that says otherwise feels broken.

```typescript
import { chatGuessMatches, chatGuessIsClose } from '@webgamekit/chat'

chatGuessMatches('  Apple ', 'apple') // true  — normalised comparison
chatGuessIsClose('aple', 'apple') // true  — near miss, worth a hint
```

`chatGuessIsClose` is built on `chatEditDistance`, a Levenshtein distance exported for cases
that need the number rather than the verdict. Use it to tell a player they are close without
revealing the answer.

## API

| Function                                        | Returns               | Description                                          |
| ----------------------------------------------- | --------------------- | ---------------------------------------------------- |
| `chatMessageCreate(senderId, senderName, text)` | `ChatMessage \| null` | Creates a trimmed message; `null` when text is empty |
| `chatHistoryAppend(history, message, limit?)`   | `ChatMessage[]`       | Appends, trimming the oldest past `limit` (200)      |
| `chatGuessMatches(guess, target)`               | `boolean`             | Normalised equality                                  |
| `chatGuessIsClose(guess, target)`               | `boolean`             | True for a near miss                                 |
| `chatEditDistance(a, b)`                        | `number`              | Levenshtein distance                                 |

## Types

```typescript
type ChatMessageKind = 'user' | 'system' | 'success'

type ChatMessage = {
  id: string
  senderId: string
  senderName: string
  text: string
  timestamp: number
  kind?: ChatMessageKind
}
```

`kind` drives presentation only — `system` for joins and leaves, `success` for a correct
guess. The package never sets it; the game does.
