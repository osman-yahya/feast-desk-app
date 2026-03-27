import { Router } from 'express'
import { floorRepo } from '../../db/repositories/floor.repo.js'
import { tableRepo } from '../../db/repositories/table.repo.js'

export function floorsRoutes() {
  const router = Router()

  // GET /api/floors — all floors with their tables
  router.get('/', (req, res) => {
    const floors = floorRepo.getAll()
    const result = floors.map((floor) => ({
      ...floor,
      tables: tableRepo.getByFloor(floor.id)
    }))
    res.json(result)
  })

  return router
}
