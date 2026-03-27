import { create } from 'zustand'

export const useServerStore = create((set) => ({
  isRunning: false,
  port: null,
  ip: null,
  qrDataURL: null,
  waiterClients: 0,
  kitchenClients: 0,

  async start() {
    const result = await window.feastAPI.server.start()
    if (result.success) {
      set({ isRunning: true, port: result.port, ip: result.ip })
      const { qr } = await window.feastAPI.server.qr()
      set({ qrDataURL: qr })
    }
    return result
  },

  async stop() {
    await window.feastAPI.server.stop()
    set({ isRunning: false, qrDataURL: null, waiterClients: 0, kitchenClients: 0 })
  },

  async refreshStatus() {
    const status = await window.feastAPI.server.status()
    set({
      isRunning: status.running,
      port: status.port,
      ip: status.ip,
      waiterClients: status.waiter_clients,
      kitchenClients: status.kitchen_clients
    })
  }
}))
