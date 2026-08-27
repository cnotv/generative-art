/**
 * Number repeated names so every panel row is addressable: the first `column` keeps its
 * name and the next ones become `column (2)`, `column (3)`. Element properties, selection
 * and expansion are all keyed by name, so duplicates make every repeat of a name resolve
 * to the first of them.
 * @param names The raw names, in the order they appear
 * @returns The names with a number appended to each repeat
 */
export const numberDuplicateNames = (names: string[]): string[] => {
  const seenCounts = new Map<string, number>()
  return names.map((name) => {
    const previousCount = seenCounts.get(name) ?? 0
    seenCounts.set(name, previousCount + 1)
    return previousCount === 0 ? name : `${name} (${previousCount + 1})`
  })
}
