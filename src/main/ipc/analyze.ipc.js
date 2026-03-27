import { getBasicStats, getAdvancedStats } from '../services/analyze.service.js'

export function register(ipcMain) {
  ipcMain.handle('analyze:basic', (_, fromTs, toTs) => {
    try {
      return getBasicStats(fromTs, toTs)
    } catch (err) {
      return { error: err.message }
    }
  })

  ipcMain.handle('analyze:advanced', (_, fromTs, toTs) => {
    try {
      return getAdvancedStats(fromTs, toTs)
    } catch (err) {
      return { error: err.message }
    }
  })
}
