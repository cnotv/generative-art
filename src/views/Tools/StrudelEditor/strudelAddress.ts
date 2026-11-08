import type { LocationQuery, LocationQueryRaw } from 'vue-router'
import { STRUDEL_MODE_QUERY_KEY, STRUDEL_PATTERN_QUERY_KEY, STRUDEL_TAB_QUERY_KEY } from './config'
import type { StrudelAddress } from './types'

const readQueryText = (value: LocationQuery[string] | undefined): string | undefined =>
  (Array.isArray(value) ? value[0] : value) || undefined

/**
 * Reads the pattern, the drawer tab and the editor mode a query names.
 * @param query - the route's query
 * @returns the pattern id, tab name and mode name, each undefined when the query has none
 */
export const readStrudelAddress = (query: LocationQuery): StrudelAddress => ({
  patternId: readQueryText(query[STRUDEL_PATTERN_QUERY_KEY]),
  tabName: readQueryText(query[STRUDEL_TAB_QUERY_KEY]),
  modeName: readQueryText(query[STRUDEL_MODE_QUERY_KEY])
})

/**
 * Sets the pattern, tab or mode in a query, keeping every other key the page owns, such as a room.
 * A field given as undefined is removed; a field left out is kept as it is.
 * @param query - the route's query
 * @param address - the fields to set or remove
 * @returns the query to navigate to
 */
export const writeStrudelAddress = (
  query: LocationQuery,
  address: StrudelAddress
): LocationQueryRaw => ({
  ...query,
  ...('patternId' in address && { [STRUDEL_PATTERN_QUERY_KEY]: address.patternId }),
  ...('tabName' in address && { [STRUDEL_TAB_QUERY_KEY]: address.tabName }),
  ...('modeName' in address && { [STRUDEL_MODE_QUERY_KEY]: address.modeName })
})

/**
 * Reads an address from the anchor links used before the query, where one anchor named either a
 * tab or a pattern, so links already shared still open what they named.
 * @param hash - the route's hash, with its leading `#`
 * @param tabIds - every tab id, which tells a tab from a pattern
 * @returns the tab or the pattern it names, or null when there is no anchor
 */
export const readLegacyStrudelAnchor = (
  hash: string,
  tabIds: readonly string[]
): StrudelAddress | null => {
  const anchor = decodeURIComponent(hash.slice(1))
  if (anchor.length === 0) {
    return null
  }
  return tabIds.includes(anchor) ? { tabName: anchor } : { patternId: anchor }
}
