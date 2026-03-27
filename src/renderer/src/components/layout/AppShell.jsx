import React, { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar.jsx'
import { TopBar } from './TopBar.jsx'
import { Modal } from '../ui/Modal.jsx'
import { Button } from '../ui/Button.jsx'
import { useRestaurantStore } from '../../store/useRestaurantStore.js'
import { useSettingsStore } from '../../store/useSettingsStore.js'

export function AppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('sidebarCollapsed') === 'true'
  )
  const [staleCache, setStaleCache] = useState(false)
  const [showRefreshModal, setShowRefreshModal] = useState(false)
  const [refreshCode, setRefreshCode] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState('')
  const { refresh } = useRestaurantStore()
  const { loadAll } = useSettingsStore()

  useEffect(() => {
    loadAll()
    const unsub = window.feastAPI.on('cache:stale', () => setStaleCache(true))
    return unsub
  }, [])

  function toggleSidebar() {
    setSidebarCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('sidebarCollapsed', String(next))
      return next
    })
  }

  async function handleRefresh() {
    if (!refreshCode.trim()) return
    setRefreshing(true)
    setRefreshError('')
    const result = await refresh(refreshCode.trim())
    setRefreshing(false)
    if (result?.success === false) {
      setRefreshError(result.error || 'Refresh failed')
    } else {
      setStaleCache(false)
      setShowRefreshModal(false)
      setRefreshCode('')
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface-bg">
      <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar staleCache={staleCache} onRefreshRequest={() => setShowRefreshModal(true)} />
        <main className="flex-1 overflow-hidden p-6 flex flex-col min-h-0">
          <Outlet />
        </main>
      </div>

      <Modal open={showRefreshModal} onClose={() => setShowRefreshModal(false)} title="Refresh Menu Data" size="sm">
        <p className="text-sm text-ink-muted mb-4">Enter your connection code to refresh the cached menu data.</p>
        <input
          value={refreshCode}
          onChange={(e) => setRefreshCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleRefresh()}
          placeholder="e.g. 12345-ABC123"
          className="w-full border border-border-warm rounded-xl px-4 py-2.5 text-sm text-ink placeholder:text-gray-400 focus:outline-none focus:border-brand transition-colors mb-3"
        />
        {refreshError && <p className="text-xs text-red-500 mb-3">{refreshError}</p>}
        <Button onClick={handleRefresh} loading={refreshing} className="w-full">Refresh</Button>
      </Modal>
    </div>
  )
}
