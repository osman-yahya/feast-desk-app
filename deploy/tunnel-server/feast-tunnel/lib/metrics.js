const startTime = Date.now()

export const metrics = {
  tunnelsActive: 0,
  tunnelsPeak: 0,
  endUsersWs: 0,
  httpRequestsTotal: 0,
}

// Track peak
const origDescriptor = Object.getOwnPropertyDescriptor(metrics, 'tunnelsActive')
let _tunnelsActive = 0
Object.defineProperty(metrics, 'tunnelsActive', {
  get: () => _tunnelsActive,
  set: (v) => {
    _tunnelsActive = v
    if (v > metrics.tunnelsPeak) metrics.tunnelsPeak = v
  },
  enumerable: true,
})

export function getHealthPayload(stats) {
  return {
    status: 'ok',
    tunnels_active: stats.active,
    tunnels_grace: stats.grace,
    tunnels_peak: metrics.tunnelsPeak,
    end_users_ws: stats.activeWs,
    pending_http: stats.pendingHttp,
    http_requests_total: metrics.httpRequestsTotal,
    memory_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    uptime_s: Math.floor((Date.now() - startTime) / 1000),
  }
}
