/**
 * Module access configuration.
 * Changing minLevel requires a new app release — this is intentional.
 * Module gating is ALSO server-enforced (level comes from getMenu API).
 */
export const MODULE_CONFIG = [
  {
    id: 'direct_order',
    label: 'Direct Order',
    icon: 'ShoppingCart',
    path: '/direct-order',
    minLevel: 1,
    description: 'Quick cashier checkout without tables'
  },
  {
    id: 'tables',
    label: 'Tables',
    icon: 'LayoutGrid',
    path: '/tables',
    minLevel: 2,
    description: 'Manage floor plan and table orders'
  },
  {
    id: 'analyze',
    label: 'Analyze',
    icon: 'BarChart2',
    path: '/analyze',
    minLevel: 2,
    description: 'Past sales data and reports'
  },
  {
    id: 'server',
    label: 'Server',
    icon: 'Wifi',
    path: '/server',
    minLevel: 3,
    description: 'Local waiter & kitchen server'
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'Settings',
    path: '/settings',
    minLevel: 1,
    alwaysVisible: true,
    description: 'App configuration'
  }
]

export const ADVANCED_ANALYZE_MIN_LEVEL = 4

export function canAccess(moduleId, level) {
  const mod = MODULE_CONFIG.find((m) => m.id === moduleId)
  if (!mod) return false
  return level >= mod.minLevel
}

export function getAccessibleModules(level) {
  return MODULE_CONFIG.filter((m) => level >= m.minLevel)
}
