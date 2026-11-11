export const DEFAULT_APP_ID = 'webgamekit'

// Trystero's own default list includes relays that demand proof of work, block ephemeral
// events or rate-limit; these accept the ephemeral events its signalling uses.
export const DEFAULT_RELAY_URLS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://offchain.pub'
]

// Every join publishes to each relay, so fewer relays means fewer rate-limit hits.
export const DEFAULT_RELAY_REDUNDANCY = 3
