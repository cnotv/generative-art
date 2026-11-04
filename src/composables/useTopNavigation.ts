import { ref } from 'vue'

const STORAGE_KEY = 'top-navigation-enabled'

const readStored = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

const writeStored = (enabled: boolean): void => {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled))
  } catch {
    // Storage can be blocked; the in-memory flag still holds for this load.
  }
}

const hasEnableQuery = (): boolean =>
  new URLSearchParams(window.location.search).get('nav') === 'true'

const initialState = (): boolean => {
  const enabledByQuery = hasEnableQuery()
  if (enabledByQuery) writeStored(true)
  return enabledByQuery || readStored()
}

const isNavigationEnabled = ref(initialState())

const disableNavigation = (): void => {
  isNavigationEnabled.value = false
  writeStored(false)
}

/**
 *
 */
/**
 * Shared state for the top navigation bar, hidden unless `?nav=true` or a stored opt in.
 * @returns the enabled flag and a function that disables the bar and remembers it
 */
export const useTopNavigation = () => ({ isNavigationEnabled, disableNavigation })
