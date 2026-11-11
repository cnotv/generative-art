export const DEFAULT_APP_ID = 'webgamekit'

// Trystero's own default list includes relays that demand proof of work, block ephemeral
// events or rate-limit. These five delivered peers in real two-page joins, in about a second;
// the common public ones (damus, nos.lol, primal, offchain.pub) did not.
export const DEFAULT_RELAY_URLS = [
  'wss://relay.angor.io',
  'wss://relay.satlantis.io',
  'wss://relay.mostro.network',
  'wss://relay.snort.social',
  'wss://nostr.oxtr.dev'
]

// Peers only meet when they share a relay, so every join uses all of the pinned ones.
export const DEFAULT_RELAY_REDUNDANCY = 5
