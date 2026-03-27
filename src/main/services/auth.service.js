import { net } from 'electron'
import { app } from 'electron'
import { join } from 'path'
import { createWriteStream, mkdirSync, existsSync } from 'fs'
import { restaurantRepo } from '../db/repositories/restaurant.repo.js'
import { settingsRepo } from '../db/repositories/settings.repo.js'

const API_BASE = 'https://mutfak.feast.tr'

/**
 * Parse connection code "<id>-<rest of secret>"
 * The restaurant id is the part before the first dash.
 */
export function parseCode(code) {
  if (!code || typeof code !== 'string') return null
  const idx = code.indexOf('-')
  if (idx < 1) return null
  const id = code.slice(0, idx).trim()
  const secret = code.slice(idx + 1).trim()
  if (!id || !secret || !/^\d+$/.test(id)) return null
  return { id: parseInt(id, 10), secret }
}

/**
 * Call getMenu API and cache the result.
 */
export async function connectRestaurant(code) {
  const parsed = parseCode(code)
  if (!parsed) return { success: false, error: 'invalid_code', message: 'Invalid code format. Use <ID>-<SECRET>' }

  const { id, secret } = parsed

  // HTTP POST via Electron net module (works without CORS issues)
  let responseData
  try {
    responseData = await fetchMenuAPI(id, secret)
  } catch (err) {
    return { success: false, error: 'network', message: `Network error: ${err.message}` }
  }

  if (responseData.error) return responseData

  const { restaurant_img, theme_id, restaurant_level, menu, restaurant_name } = responseData

  // Download restaurant image locally
  const imgLocalPath = await downloadImage(restaurant_img, id)

  // Save to SQLite
  restaurantRepo.upsert({
    restaurant_id: String(id),
    restaurant_name: restaurant_name || menu?.name || `Restaurant #${id}`,
    img_url: restaurant_img || null,
    img_local_path: imgLocalPath,
    theme_id: theme_id || null,
    level: restaurant_level || 1,
    menu_json: JSON.stringify(menu),
    cached_at: Date.now()
  })

  settingsRepo.set('connected', 'true')
  settingsRepo.set('restaurant_id', String(id))

  const cached = restaurantRepo.get()
  return { success: true, restaurant: serializeRestaurant(cached) }
}

export async function refreshCache() {
  const cached = restaurantRepo.get()
  if (!cached) return { success: false, error: 'not_connected' }

  const id = parseInt(cached.restaurant_id, 10)
  // We need the secret from the last code — we don't store it.
  // This method is called internally only when we have the full API response.
  // For silent refresh, we store nothing — caller must pass secret.
  return { success: false, error: 'need_secret' }
}

/**
 * Refresh using provided code (for manual refresh from Settings).
 */
export async function refreshWithCode(code) {
  return connectRestaurant(code)
}

export function getRestaurant() {
  const cached = restaurantRepo.get()
  if (!cached) return null
  return serializeRestaurant(cached)
}

export function disconnect() {
  restaurantRepo.clear()
  settingsRepo.set('connected', 'false')
  settingsRepo.set('restaurant_id', '')
}

// ---- helpers ----

async function fetchMenuAPI(id, secret) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ id, secret })
    const request = net.request({
      method: 'POST',
      url: `${API_BASE}/rsts/menu/get`,
      headers: { 'Content-Type': 'application/json' }
    })

    let raw = ''
    request.on('response', (response) => {
      response.on('data', (chunk) => { raw += chunk.toString() })
      response.on('end', () => {
        try {
          const data = JSON.parse(raw)
          if (response.statusCode === 200) {
            resolve(data)
          } else if (response.statusCode === 403) {
            resolve({ error: 'invalid_secret', message: 'Secret does not match. Check your connection code.' })
          } else if (response.statusCode === 404) {
            resolve({ error: 'not_found', message: data.message || 'Restaurant not found.' })
          } else {
            resolve({ error: 'server_error', message: data.message || 'Server error.' })
          }
        } catch {
          resolve({ error: 'parse_error', message: 'Invalid server response.' })
        }
      })
    })

    request.on('error', (err) => resolve({ error: 'network', message: err.message }))
    request.write(body)
    request.end()
  })
}

async function downloadImage(url, restaurantId) {
  if (!url) return null
  try {
    const imagesDir = join(app.getPath('userData'), 'images')
    if (!existsSync(imagesDir)) mkdirSync(imagesDir, { recursive: true })

    const localPath = join(imagesDir, `restaurant_${restaurantId}.webp`)
    await new Promise((resolve, reject) => {
      const req = net.request({ method: 'GET', url })
      req.on('response', (res) => {
        const stream = createWriteStream(localPath)
        res.pipe(stream)
        stream.on('finish', resolve)
        stream.on('error', reject)
      })
      req.on('error', reject)
      req.end()
    })
    return localPath
  } catch {
    return null
  }
}

function serializeRestaurant(cached) {
  if (!cached) return null
  return {
    restaurant_id: cached.restaurant_id,
    restaurant_name: cached.restaurant_name,
    img_url: cached.img_url,
    img_local_path: cached.img_local_path,
    theme_id: cached.theme_id,
    level: cached.level,
    menu: JSON.parse(cached.menu_json),
    cached_at: cached.cached_at
  }
}
