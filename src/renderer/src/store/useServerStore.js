import { create } from 'zustand'

export const useServerStore = create((set) => ({
  isRunning: false,
  port: null,
  ip: null,
  connectionMode: 'local', // 'local' | 'tunnel' | 'feast-tunnel'
  tunnelUrl: null,
  qrDataURL: null,
  waiterClients: 0,
  kitchenClients: 0,

  async start(mode = 'local') {
    const result = await window.feastAPI.server.start(mode)
    if (result.success) {
      set({
        isRunning: true,
        port: result.port,
        ip: result.ip,
        connectionMode: result.mode,
        tunnelUrl: result.tunnelUrl
      })
      const { qr } = await window.feastAPI.server.qr()
      set({ qrDataURL: qr })
    }
    return result
  },

  async stop() {
    await window.feastAPI.server.stop()
    set({
      isRunning: false,
      qrDataURL: null,
      waiterClients: 0,
      kitchenClients: 0,
      connectionMode: 'local',
      tunnelUrl: null
    })
  },

  async refreshStatus() {
    const status = await window.feastAPI.server.status()
    set({
      isRunning: status.running,
      port: status.port,
      ip: status.ip,
      connectionMode: status.mode || 'local',
      tunnelUrl: status.tunnelUrl || null,
      waiterClients: status.waiter_clients,
      kitchenClients: status.kitchen_clients
    })
  }
}))
