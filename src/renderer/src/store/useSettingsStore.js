import { create } from 'zustand'

export const useSettingsStore = create((set, get) => ({
  settings: {},
  discounts: [],
  sessionUnlocked: false,

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
    set({ settings, discounts })
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
