/**
 * Builds an array by calling a function once per index.
 * @param n How many items to build.
 * @param fn Builds the item for an index.
 * @returns The items, in index order.
 */
export const times = <R>(n: number, fn: (i: number) => R): R[] => {
  return Array.from({ length: n }, (_, i) => fn(i))
}

/**
 * Delays a function until it has not been called for a while.
 * @param fn The function to delay.
 * @param delay Milliseconds of quiet before it runs.
 * @returns The debounced function.
 */
export const debounce = <T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      fn(...args)
      timeoutId = null
    }, delay)
  }
}
