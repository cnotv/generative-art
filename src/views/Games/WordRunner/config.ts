export const LANE_COUNT = 3

// Three words is about what a player can hold while also steering; the next chunk only
// arrives once the previous one is being answered without hints.
export const CHUNK_SIZE = 3

// The same lane three times running reads as "stay put" rather than as part of a path.
export const MAX_SAME_LANE_STREAK = 2

// A lap with a mistake is re-run with stronger hints at most this many times in a row,
// so a stubborn word cannot trap the player on one lap forever.
export const MAX_RETRY_ATTEMPTS = 2
