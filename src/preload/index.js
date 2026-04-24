import { contextBridge, ipcRenderer } from 'electron'

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args)

contextBridge.exposeInMainWorld('feastAPI', {
  auth: {
    connect:       (code)                  => invoke('auth:connect', code),
    getRestaurant: ()                      => invoke('auth:get-restaurant'),
    disconnect:    ()                      => invoke('auth:disconnect'),
    refresh:       (code)                  => invoke('auth:refresh', code),
    silentRefresh: ()                      => invoke('auth:silent-refresh')
  },

  menu: {
    get: () => invoke('menu:get')
  },

  tables: {
    getFloors:          ()              => invoke('tables:get-floors'),
    createFloor:        (name)          => invoke('tables:create-floor', name),
    updateFloor:        (id, name, ord) => invoke('tables:update-floor', id, name, ord),
    deleteFloor:        (id)            => invoke('tables:delete-floor', id),
    getTables:          (floorId)       => invoke('tables:get-tables', floorId),
    upsertTable:        (data)          => invoke('tables:upsert-table', data),
    deleteTable:        (id)            => invoke('tables:delete-table', id),
    getFloorElements:   (floorId)       => invoke('tables:get-floor-elements', floorId),
    saveFloorElements:  (floorId, els)  => invoke('tables:save-floor-elements', floorId, els)
  },

  orders: {
    getOpen:     ()                    => invoke('orders:get-open'),
    getByTable:  (tableId)             => invoke('orders:get-by-table', tableId),
    getItems:    (orderId)             => invoke('orders:get-items', orderId),
    create:      (tableId)             => invoke('orders:create', tableId),
    addItem:     (orderId, item)       => invoke('orders:add-item', orderId, item),
    removeItem:  (itemId)              => invoke('orders:remove-item', itemId),
    updateItem:  (itemId, patch)       => invoke('orders:update-item', itemId, patch)
  },

  checkout: {
    buildBill:      (orderId, pct)                    => invoke('checkout:build-bill', orderId, pct),
    markFree:       (itemId, isFree)                  => invoke('checkout:mark-free', itemId, isFree),
    markPartialPaid:(itemIds)                         => invoke('checkout:mark-partial-paid', itemIds),
    applyDiscount:  (itemId, pct)                     => invoke('checkout:apply-discount', itemId, pct),
    finalize:       (orderId, method, pct, note)      => invoke('checkout:finalize', orderId, method, pct, note),
    deleteOrder:    (orderId)                         => invoke('checkout:delete-order', orderId)
  },

  analyze: {
    basic:    (from, to) => invoke('analyze:basic', from, to),
    advanced: (from, to) => invoke('analyze:advanced', from, to)
  },

  server: {
    start:  (mode) => invoke('server:start', mode),
    stop:   () => invoke('server:stop'),
    status: () => invoke('server:status'),
    qr:     () => invoke('server:qr')
  },

  update: {
    install: () => invoke('update:install')
  },

  settings: {
    get:           (key)   => invoke('settings:get', key),
    set:           (k, v)  => invoke('settings:set', k, v),
    getAll:        ()      => invoke('settings:get-all'),
    getDiscounts:  ()      => invoke('settings:get-discounts'),
    saveDiscount:  (data)  => invoke('settings:save-discount', data),
    deleteDiscount:(id)    => invoke('settings:delete-discount', id),
    getUnclosed:   ()      => invoke('settings:get-unclosed-orders'),
    closeOrder:    (id)    => invoke('settings:close-order', id),
    exportConfig:  ()      => invoke('settings:export-config'),
    importConfig:  (data)  => invoke('settings:import-config', data),
    pruneOldData:  ()      => invoke('settings:prune-old-data')
  },

  // Push events from main → renderer
  on: (channel, callback) => {
    const allowed = ['cache:stale', 'server:message', 'update:available', 'update:progress', 'update:downloaded']
    if (!allowed.includes(channel)) return
    const wrapped = (_, ...args) => callback(...args)
    ipcRenderer.on(channel, wrapped)
    return () => ipcRenderer.removeListener(channel, wrapped)
  }
})
