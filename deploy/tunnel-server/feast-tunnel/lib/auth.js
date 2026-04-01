import { createHash, randomBytes } from 'crypto'

const TOKEN_TTL = 30_000        // 30s to consume after creation
const TOKEN_PREFIX = 'ft_'

// token → { restaurantId, createdAt, consumed }
const pendingTokens = new Map()

// Periodic cleanup of expired unconsumed tokens
let cleanupTimer = null

/**
 * Derive a deterministic access key from restaurant credentials.
 * SHA-256( restaurantId + ":" + secret ) → first 16 hex chars.
 * This key is used as the tunnel path identifier.
 */
export function deriveAccessKey(restaurantId, secret) {
  const hash = createHash('sha256')
    .update(`${restaurantId}:${secret}`)
    .digest('hex')
  return hash.slice(0, 16)
}

/**
 * Generate a 256-bit cryptographic token and store it with restaurant context.
 * Format: ft_<32 hex chars>
 */
export function createToken(restaurantId, accessKey) {
  const token = TOKEN_PREFIX + randomBytes(16).toString('hex')
  pendingTokens.set(token, {
    restaurantId,
    accessKey,
    createdAt: Date.now(),
    consumed: false,
  })
  return token
}

/**
 * Consume a pending token (called when POS opens the tunnel WebSocket).
 * Returns { valid: true, restaurantId } or { valid: false, reason }.
 */
export function consumeToken(token) {
  const entry = pendingTokens.get(token)
  if (!entry) {
    return { valid: false, reason: 'unknown_token' }
  }
  if (entry.consumed) {
    return { valid: false, reason: 'already_consumed' }
  }
  if (Date.now() - entry.createdAt > TOKEN_TTL) {
    pendingTokens.delete(token)
    return { valid: false, reason: 'token_expired' }
  }

  entry.consumed = true
  pendingTokens.delete(token)
  return { valid: true, restaurantId: entry.restaurantId, accessKey: entry.accessKey }
}

export function startTokenCleanup() {
  if (cleanupTimer) return
  cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [token, entry] of pendingTokens) {
      if (now - entry.createdAt > TOKEN_TTL * 2) {
        pendingTokens.delete(token)
      }
    }
  }, 30_000)
  cleanupTimer.unref()
}

export function stopTokenCleanup() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer)
    cleanupTimer = null
  }
}
