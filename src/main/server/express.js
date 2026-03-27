import express from 'express'
import { join } from 'path'
import { menuRoutes } from './routes/menu.routes.js'
import { ordersRoutes } from './routes/orders.routes.js'
import { floorsRoutes } from './routes/floors.routes.js'

export function createExpressApp(publicDir) {
  const app = express()
  app.use(express.json())

  // Serve static waiter/kitchen SPA
  // publicDir is resolved by the caller (server.ipc.js) based on app.isPackaged
  app.use(express.static(publicDir))

  // API routes
  app.use('/api/menu', menuRoutes())
  app.use('/api/orders', ordersRoutes())
  app.use('/api/floors', floorsRoutes())

  // Catch-all: serve index.html for SPA routing
  app.get('*', (req, res) => {
    res.sendFile(join(publicDir, 'index.html'))
  })

  return app
}
