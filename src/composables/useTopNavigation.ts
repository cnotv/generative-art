import { ref, watchEffect } from 'vue'

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

const syncQuery = (enabled: boolean): void => {
  const url = new URL(window.location.href)
  if (enabled) url.searchParams.set('nav', 'true')
  else url.searchParams.delete('nav')
  window.history.replaceState(window.history.state, '', url)
}

const initialState = (): boolean => {
  const enabledByQuery = hasEnableQuery()
  if (enabledByQuery) writeStored(true)
  const enabled = enabledByQuery || readStored()
  syncQuery(enabled)
  return enabled
}

const isNavigationEnabled = ref(initialState())

// Drives `--nav-height` and the `pt-nav` utility in src/style.css.
watchEffect(() =>
  document.documentElement.classList.toggle('top-nav-visible', isNavigationEnabled.value)
)

const disableNavigation = (): void => {
  isNavigationEnabled.value = false
  writeStored(false)
  syncQuery(false)
}

/**
 * Shared state for the top navigation bar, hidden unless `?nav=true` or a stored opt in.
 * @returns the enabled flag and a function that disables the bar and remembers it
 */
export const useTopNavigation = () => ({ isNavigationEnabled, disableNavigation })
