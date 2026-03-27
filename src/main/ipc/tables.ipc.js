import { floorRepo } from '../db/repositories/floor.repo.js'
import { tableRepo } from '../db/repositories/table.repo.js'

export function register(ipcMain) {
  ipcMain.handle('tables:get-floors', () => floorRepo.getAll())

  ipcMain.handle('tables:create-floor', (_, name) => floorRepo.create(name))

  ipcMain.handle('tables:update-floor', (_, id, name, sortOrder) =>
    floorRepo.update(id, name, sortOrder)
  )

  ipcMain.handle('tables:delete-floor', (_, id) => {
    floorRepo.delete(id)
    return { success: true }
  })

  ipcMain.handle('tables:get-tables', (_, floorId) => tableRepo.getByFloor(floorId))

  ipcMain.handle('tables:upsert-table', (_, data) => {
    if (data.id) return tableRepo.update(data.id, data)
    return tableRepo.create(data)
  })

  ipcMain.handle('tables:delete-table', (_, id) => {
    tableRepo.delete(id)
    return { success: true }
  })

  ipcMain.handle('tables:get-floor-elements', (_, floorId) => tableRepo.getFloorElements(floorId))

  ipcMain.handle('tables:save-floor-elements', (_, floorId, elements) => {
    tableRepo.replaceFloorElements(floorId, elements)
    return { success: true }
  })
}
