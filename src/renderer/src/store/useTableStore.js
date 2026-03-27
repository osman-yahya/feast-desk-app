import { create } from 'zustand'

export const useTableStore = create((set, get) => ({
  floors: [],
  activeFloorId: null,
  tables: [],
  floorElements: [],
  isEditing: false,

  async loadFloors() {
    const floors = await window.feastAPI.tables.getFloors()
    set({ floors, activeFloorId: floors[0]?.id || null })
    if (floors[0]) await get().loadFloor(floors[0].id)
    return floors
  },

  async loadFloor(floorId) {
    set({ activeFloorId: floorId })
    const [tables, elements] = await Promise.all([
      window.feastAPI.tables.getTables(floorId),
      window.feastAPI.tables.getFloorElements(floorId)
    ])
    set({ tables, floorElements: elements })
  },

  setEditing(val) {
    set({ isEditing: val })
  },

  async createFloor(name) {
    const floor = await window.feastAPI.tables.createFloor(name)
    set((s) => ({ floors: [...s.floors, floor] }))
    return floor
  },

  async deleteFloor(id) {
    await window.feastAPI.tables.deleteFloor(id)
    set((s) => {
      const floors = s.floors.filter((f) => f.id !== id)
      return { floors, activeFloorId: floors[0]?.id || null }
    })
  },

  async upsertTable(data) {
    const tbl = await window.feastAPI.tables.upsertTable(data)
    set((s) => {
      const exists = s.tables.find((t) => t.id === tbl.id)
      return { tables: exists ? s.tables.map((t) => t.id === tbl.id ? tbl : t) : [...s.tables, tbl] }
    })
    return tbl
  },

  async deleteTable(id) {
    await window.feastAPI.tables.deleteTable(id)
    set((s) => ({ tables: s.tables.filter((t) => t.id !== id) }))
  },

  async saveFloorElements(floorId, elements) {
    await window.feastAPI.tables.saveFloorElements(floorId, elements)
    set({ floorElements: elements })
  },

  updateTableStatusLocally(tableId, status) {
    set((s) => ({ tables: s.tables.map((t) => t.id === tableId ? { ...t, status } : t) }))
  }
}))
