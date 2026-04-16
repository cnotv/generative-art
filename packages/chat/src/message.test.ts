import { describe, it, expect, vi, beforeEach } from 'vitest'
import { chatMessageCreate, chatHistoryAppend, type ChatMessage } from './message'

describe('chatMessageCreate', () => {
  beforeEach(() => {
    let counter = 0
    vi.stubGlobal('crypto', {
      randomUUID: () => `uuid-${++counter}`
    })
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
  })

  it('creates a message with trimmed text and generated id', () => {
    const result = chatMessageCreate('peer-1', 'Alice', '  hello  ')
    expect(result).toEqual({
      id: 'uuid-1',
      senderId: 'peer-1',
      senderName: 'Alice',
      text: 'hello',
      timestamp: 1_700_000_000_000
    })
  })

  it.each([[''], ['   '], ['\n\t']])('returns null for blank text "%s"', (text) => {
    expect(chatMessageCreate('peer-1', 'Alice', text)).toBeNull()
  })
})

describe('chatHistoryAppend', () => {
  const makeMessage = (id: string): ChatMessage => ({
    id,
    senderId: 'peer',
    senderName: 'Name',
    text: id,
    timestamp: 0
  })

  it('appends a message to existing history', () => {
    const history = [makeMessage('a'), makeMessage('b')]
    const next = chatHistoryAppend(history, makeMessage('c'))
    expect(next.map((m) => m.id)).toEqual(['a', 'b', 'c'])
  })

  it('drops oldest messages when exceeding the limit', () => {
    const history = [makeMessage('a'), makeMessage('b'), makeMessage('c')]
    const next = chatHistoryAppend(history, makeMessage('d'), 3)
    expect(next.map((m) => m.id)).toEqual(['b', 'c', 'd'])
  })
})
