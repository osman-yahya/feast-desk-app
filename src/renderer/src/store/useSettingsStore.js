import { create } from 'zustand'

// UI mode: 'touch' is the default (bigger, touch-friendly); 'compact' is the
// original dense layout. Persisted to the `ui_mode` settings key so it
// survives restarts. Read synchronously from localStorage on first paint so
// the html class is applied before React mounts.
const UI_MODE_KEY = 'feast_ui_mode'
function readInitialUiMode() {
  try {
    const v = localStorage.getItem(UI_MODE_KEY)
    if (v === 'touch' || v === 'compact') return v
  } catch {}
  return 'touch'
}

export const useSettingsStore = create((set, get) => ({
  settings: {},
  discounts: [],
  sessionUnlocked: false,
  uiMode: readInitialUiMode(),

  unlock() {
    set({ sessionUnlocked: true })
  },

  lock() {
    set({ sessionUnlocked: false })
  },

  async loadAll() {
    const [settings, discounts] = await Promise.all([
      window.feastAPI.settings.getAll(),
      window.feastAPI.settings.getDiscounts()
    ])
    // Settings from DB override localStorage if present.
    const dbMode = settings.ui_mode
    const mode = dbMode === 'compact' ? 'compact' : 'touch'
    try { localStorage.setItem(UI_MODE_KEY, mode) } catch {}
    set({ settings, discounts, uiMode: mode })
  },

  async setUiMode(mode) {
    const next = mode === 'compact' ? 'compact' : 'touch'
    try { localStorage.setItem(UI_MODE_KEY, next) } catch {}
    set({ uiMode: next })
    try {
      await window.feastAPI.settings.set('ui_mode', next)
      set((s) => ({ settings: { ...s.settings, ui_mode: next } }))
    } catch {}
  },

  get(key) {
    return get().settings[key]
  },

  async set(key, value) {
    await window.feastAPI.settings.set(key, value)
    set((s) => ({ settings: { ...s.settings, [key]: String(value) } }))
  },

  async saveDiscount(data) {
    await window.feastAPI.settings.saveDiscount(data)
    const discounts = await window.feastAPI.settings.getDiscounts()
    set({ discounts })
  },

  async deleteDiscount(id) {
    await window.feastAPI.settings.deleteDiscount(id)
    set((s) => ({ discounts: s.discounts.filter((d) => d.id !== id) }))
  }
}))
