export type ChatMessageKind = 'user' | 'system' | 'success'

export type ChatMessage = {
  id: string
  senderId: string
  senderName: string
  text: string
  timestamp: number
  kind?: ChatMessageKind
}

/**
 * Create a chat message with a unique id and current timestamp.
 * @param senderId - Stable peer id of the sender.
 * @param senderName - Display name shown alongside the message.
 * @param text - Raw message body; trimmed before storage.
 * @returns A new `ChatMessage` or `null` when the trimmed text is empty.
 */
export const chatMessageCreate = (
  senderId: string,
  senderName: string,
  text: string
): ChatMessage | null => {
  const trimmed = text.trim()
  if (!trimmed) return null
  return {
    id: crypto.randomUUID(),
    senderId,
    senderName,
    text: trimmed,
    timestamp: Date.now()
  }
}

/**
 * Append a message to a history buffer, dropping oldest entries past the limit.
 * @param history - Existing ordered message list.
 * @param message - Message to append.
 * @param limit - Maximum number of retained messages.
 * @returns New history array with the message appended.
 */
export const chatHistoryAppend = (
  history: ChatMessage[],
  message: ChatMessage,
  limit = 200
): ChatMessage[] => {
  const next = [...history, message]
  return next.length > limit ? next.slice(next.length - limit) : next
}
