import { create } from 'zustand'

export const useOrderStore = create((set, get) => ({
  // tableId → { order, items }
  tableOrders: {},
  // For direct orders (no table)
  directOrder: null,
  directItems: [],

  async loadTableOrder(tableId) {
    const order = await window.feastAPI.orders.getByTable(tableId)
    if (order) {
      const items = await window.feastAPI.orders.getItems(order.id)
      set((s) => ({ tableOrders: { ...s.tableOrders, [tableId]: { order, items } } }))
      return { order, items }
    }
    set((s) => {
      const next = { ...s.tableOrders }
      delete next[tableId]
      return { tableOrders: next }
    })
    return null
  },

  async createOrder(tableId) {
    const order = await window.feastAPI.orders.create(tableId || null)
    const items = []
    if (tableId) {
      set((s) => ({ tableOrders: { ...s.tableOrders, [tableId]: { order, items } } }))
    } else {
      set({ directOrder: order, directItems: [] })
    }
    return order
  },

  async addItem(orderId, item, tableId) {
    const added = await window.feastAPI.orders.addItem(orderId, item)
    if (tableId) {
      const td = get().tableOrders[tableId]
      if (td) {
        const exists = td.items.some((i) => i.id === added.id)
        const items = exists
          ? td.items.map((i) => i.id === added.id ? added : i)
          : [...td.items, added]
        set((s) => ({ tableOrders: { ...s.tableOrders, [tableId]: { ...td, items } } }))
      }
    } else {
      set((s) => {
        const exists = s.directItems.some((i) => i.id === added.id)
        return {
          directItems: exists
            ? s.directItems.map((i) => i.id === added.id ? added : i)
            : [...s.directItems, added]
        }
      })
    }
    return added
  },

  async removeItem(itemId, orderId, tableId) {
    await window.feastAPI.orders.removeItem(itemId)
    if (tableId) {
      const td = get().tableOrders[tableId]
      if (td) set((s) => ({ tableOrders: { ...s.tableOrders, [tableId]: { ...td, items: td.items.filter((i) => i.id !== itemId) } } }))
    } else {
      set((s) => ({ directItems: s.directItems.filter((i) => i.id !== itemId) }))
    }
  },

  async updateItem(itemId, patch, tableId) {
    const updated = await window.feastAPI.orders.updateItem(itemId, patch)
    if (tableId) {
      const td = get().tableOrders[tableId]
      if (td) set((s) => ({ tableOrders: { ...s.tableOrders, [tableId]: { ...td, items: td.items.map((i) => i.id === itemId ? { ...i, ...updated } : i) } } }))
    } else {
      set((s) => ({ directItems: s.directItems.map((i) => i.id === itemId ? { ...i, ...updated } : i) }))
    }
  },

  clearDirectOrder() {
    set({ directOrder: null, directItems: [] })
  },

  clearTableOrder(tableId) {
    set((s) => {
      const next = { ...s.tableOrders }
      delete next[tableId]
      return { tableOrders: next }
    })
  }
}))
