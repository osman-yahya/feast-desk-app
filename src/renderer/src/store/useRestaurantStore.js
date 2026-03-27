import { create } from 'zustand'

export const useRestaurantStore = create((set, get) => ({
  restaurant: null,
  menu: null,
  level: 1,
  isConnected: false,
  isLoading: false,
  error: null,

  async init() {
    set({ isLoading: true })
    try {
      const restaurant = await window.feastAPI.auth.getRestaurant()
      if (restaurant) {
        set({
          restaurant,
          menu: restaurant.menu,
          level: restaurant.level || 1,
          isConnected: true,
          isLoading: false
        })
      } else {
        set({ isConnected: false, isLoading: false })
      }
    } catch {
      set({ isConnected: false, isLoading: false })
    }
  },

  async connect(code) {
    set({ isLoading: true, error: null })
    const result = await window.feastAPI.auth.connect(code)
    if (result.success) {
      set({
        restaurant: result.restaurant,
        menu: result.restaurant.menu,
        level: result.restaurant.level || 1,
        isConnected: true,
        isLoading: false,
        error: null
      })
      return { success: true }
    } else {
      set({ isLoading: false, error: result.message || 'Connection failed' })
      return { success: false, error: result.message }
    }
  },

  async refresh(code) {
    set({ isLoading: true, error: null })
    const result = await window.feastAPI.auth.refresh(code)
    if (result.success) {
      set({
        restaurant: result.restaurant,
        menu: result.restaurant.menu,
        level: result.restaurant.level || 1,
        isLoading: false,
        error: null
      })
      return { success: true }
    } else {
      set({ isLoading: false, error: result.message })
      return result
    }
  },

  async disconnect() {
    await window.feastAPI.auth.disconnect()
    set({ restaurant: null, menu: null, level: 1, isConnected: false, error: null })
  }
}))
