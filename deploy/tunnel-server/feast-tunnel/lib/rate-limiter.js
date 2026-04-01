/**
 * Sliding-window rate limiter.
 * Tracks request timestamps per key (IP) and rejects when the window is full.
 */

const windows = new Map()   // key → number[] (timestamps)
const CLEANUP_INTERVAL = 60_000

let cleanupTimer = null

export function checkRate(key, maxRequests, windowMs) {
  const now = Date.now()
  let timestamps = windows.get(key)

  if (!timestamps) {
    timestamps = []
    windows.set(key, timestamps)
  }

  // Drop expired entries from the front
  while (timestamps.length > 0 && timestamps[0] <= now - windowMs) {
    timestamps.shift()
  }

  if (timestamps.length >= maxRequests) {
    return false // rate limited
  }

  timestamps.push(now)
  return true // allowed
}

export function startCleanup() {
  if (cleanupTimer) return
  cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [key, timestamps] of windows) {
      // Remove entries older than 60s (max reasonable window)
      while (timestamps.length > 0 && timestamps[0] <= now - 60_000) {
        timestamps.shift()
      }
      if (timestamps.length === 0) windows.delete(key)
    }
  }, CLEANUP_INTERVAL)
  cleanupTimer.unref()
}

export function stopCleanup() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer)
    cleanupTimer = null
  }
}
