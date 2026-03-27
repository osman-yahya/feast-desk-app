import React, { useState, useEffect, useRef } from 'react'
import {
  RefreshCw, Sunset, Tag, Download, Upload, Settings, Lock, Eye, EyeOff, Trash2, Plus, ExternalLink, Unlock
} from 'lucide-react'
import { Button } from '../../components/ui/Button.jsx'
import { Card, CardHeader } from '../../components/ui/Card.jsx'
import { Modal } from '../../components/ui/Modal.jsx'
import { ConfirmLock } from '../../components/ui/ConfirmLock.jsx'
import { useSettingsStore } from '../../store/useSettingsStore.js'
import { useRestaurantStore } from '../../store/useRestaurantStore.js'
import { useToast } from '../../components/ui/Toast.jsx'

export function SettingsPage() {
  const toast = useToast()
  const { settings, discounts, loadAll, set: setSetting, saveDiscount, deleteDiscount, lock, sessionUnlocked } = useSettingsStore()
  const { restaurant, refresh, disconnect } = useRestaurantStore()

  const [activeSection, setActiveSection] = useState('cache')
  const [refreshCode, setRefreshCode] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [unclosedOrders, setUnclosedOrders] = useState([])
  const [loadingUnclosed, setLoadingUnclosed] = useState(false)
  const [showDiscountModal, setShowDiscountModal] = useState(false)
  const [discountForm, setDiscountForm] = useState({ label: '', pct: '' })
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [exportData, setExportData] = useState(null)
  const fileInputRef = useRef()

  useEffect(() => {
    loadAll()
  }, [])

  async function handleRefresh() {
    if (!refreshCode.trim()) return
    setRefreshing(true)
    const result = await refresh(refreshCode.trim())
    setRefreshing(false)
    if (result?.success === false) {
      toast(result.error || 'Refresh failed', 'error')
    } else {
      toast('Menu data refreshed', 'success')
      setRefreshCode('')
    }
  }

  async function loadUnclosed() {
    setLoadingUnclosed(true)
    const orders = await window.feastAPI.settings.getUnclosed()
    setUnclosedOrders(orders)
    setLoadingUnclosed(false)
  }

  async function handleCloseOrder(orderId) {
    await window.feastAPI.settings.closeOrder(orderId)
    setUnclosedOrders((prev) => prev.filter((o) => o.id !== orderId))
    toast('Order closed', 'info')
  }

  async function handleExport() {
    const data = await window.feastAPI.settings.exportConfig()
    if (data.error) { toast(data.error, 'error'); return }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `feast-config-${new Date().toISOString().slice(0, 10)}.feast`
    a.click()
    URL.revokeObjectURL(url)
    toast('Config exported', 'success')
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        const result = await window.feastAPI.settings.importConfig(data)
        if (result.success) {
          await loadAll()
          toast('Config imported successfully', 'success')
        } else {
          toast(result.error || 'Import failed', 'error')
        }
      } catch {
        toast('Invalid .feast file', 'error')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  async function handleSaveDiscount() {
    const pct = parseFloat(discountForm.pct)
    if (!discountForm.label || isNaN(pct) || pct < 0 || pct > 100) {
      toast('Invalid discount data', 'error')
      return
    }
    await saveDiscount({ label: discountForm.label, pct })
    setShowDiscountModal(false)
    setDiscountForm({ label: '', pct: '' })
    toast('Discount saved', 'success')
  }

  const sections = [
    { id: 'cache', label: 'Cache & Menu', icon: RefreshCw },
    { id: 'endofday', label: 'End of Day', icon: Sunset },
    { id: 'discounts', label: 'Discounts', icon: Tag },
    { id: 'config', label: 'Export / Import', icon: Download },
    { id: 'global', label: 'Global Settings', icon: Settings },
    { id: 'security', label: 'Security', icon: Lock }
  ]

  return (
    <div className="flex h-full gap-6 min-h-0">
      {/* Sidebar nav */}
      <div className="w-44 flex-shrink-0">
        <nav className="flex flex-col gap-1">
          {sections.map((s) => (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${activeSection === s.id ? 'bg-brand-pale text-brand' : 'text-ink-muted hover:bg-gray-100 hover:text-ink'}`}>
              <s.icon size={15} />{s.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">

        {/* Cache section */}
        {activeSection === 'cache' && (
          <div className="space-y-4 max-w-lg">
            <h2 className="font-bold text-lg text-ink">Cache & Menu</h2>
            {restaurant && (
              <Card>
                <CardHeader title="Current Data" />
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-ink-muted">Restaurant</span><span className="font-medium">{restaurant.restaurant_name}</span></div>
                  <div className="flex justify-between"><span className="text-ink-muted">Level</span><span className="font-medium">{restaurant.level}</span></div>
                  <div className="flex justify-between"><span className="text-ink-muted">Last cached</span>
                    <span className="font-medium">{restaurant.cached_at ? new Date(restaurant.cached_at).toLocaleString() : 'Unknown'}</span>
                  </div>
                </div>
              </Card>
            )}
            <Card>
              <CardHeader title="Refresh Menu Data" subtitle="Enter your connection code to fetch latest menu" />
              <div className="space-y-3">
                <input value={refreshCode} onChange={(e) => setRefreshCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleRefresh()}
                  placeholder="e.g. 12345-ABC123"
                  className="w-full border border-border-warm rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand" />
                <Button onClick={handleRefresh} loading={refreshing} disabled={!refreshCode.trim()} icon={RefreshCw} size="sm">
                  Refresh Now
                </Button>
              </div>
            </Card>
            <Card>
              <CardHeader title="Menu Links" />
              <div className="space-y-2">
                <button onClick={() => window.open('https://feast.tr/dash/menus', '_blank')}
                  className="flex items-center gap-2 text-sm text-brand hover:underline">
                  <ExternalLink size={13} /> Edit Menu on feast.tr
                </button>
                <button onClick={() => window.open('https://feast.tr/dash/premium', '_blank')}
                  className="flex items-center gap-2 text-sm text-brand hover:underline">
                  <ExternalLink size={13} /> Manage Subscription on feast.tr
                </button>
              </div>
            </Card>
            <Card>
              <CardHeader title="Disconnect" subtitle="Remove this restaurant from this device" />
              <ConfirmLock onConfirm={() => { disconnect(); toast('Disconnected', 'info') }} label="Hold to Disconnect" />
            </Card>
          </div>
        )}

        {/* End of Day section */}
        {activeSection === 'endofday' && (
          <div className="space-y-4 max-w-lg">
            <h2 className="font-bold text-lg text-ink">End of Day</h2>
            <Card>
              <CardHeader title="Unclosed Orders" subtitle="All orders that have not been paid or deleted" action={
                <Button size="sm" variant="secondary" onClick={loadUnclosed} loading={loadingUnclosed}>Load</Button>
              } />
              {unclosedOrders.length === 0 ? (
                <p className="text-sm text-ink-muted">Click Load to check for unclosed orders.</p>
              ) : (
                <div className="space-y-3">
                  {unclosedOrders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div>
                        <p className="font-semibold text-sm text-ink">{order.table_name || 'Direct Order'} #{order.id}</p>
                        <p className="text-xs text-ink-muted">{new Date(order.opened_at).toLocaleString()}</p>
                      </div>
                      <ConfirmLock onConfirm={() => handleCloseOrder(order.id)} label="Hold to Close" className="ml-3" />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Discounts section */}
        {activeSection === 'discounts' && (
          <div className="space-y-4 max-w-lg">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg text-ink">Predefined Discounts</h2>
              <Button size="sm" icon={Plus} onClick={() => { setDiscountForm({ label: '', pct: '' }); setShowDiscountModal(true) }}>Add Discount</Button>
            </div>
            {discounts.length === 0 ? (
              <Card>
                <p className="text-sm text-ink-muted">No discounts defined. Add some for quick checkout.</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {discounts.map((d) => (
                  <Card key={d.id} className="!p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm text-ink">{d.label}</p>
                        <p className="text-xs text-ink-muted">{d.pct}% off</p>
                      </div>
                      <button onClick={() => deleteDiscount(d.id)} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Export/Import section */}
        {activeSection === 'config' && (
          <div className="space-y-4 max-w-lg">
            <h2 className="font-bold text-lg text-ink">Export / Import</h2>
            <Card>
              <CardHeader title="Export Configuration" subtitle="Save floors, tables, discounts, and settings as a .feast file" />
              <Button icon={Download} onClick={handleExport} variant="secondary">Export .feast File</Button>
            </Card>
            <Card>
              <CardHeader title="Import Configuration" subtitle="Restore from a previously exported .feast file (replaces floors/tables/discounts)" />
              <input ref={fileInputRef} type="file" accept=".feast,.json" className="hidden" onChange={handleImportFile} />
              <Button icon={Upload} onClick={() => fileInputRef.current?.click()} variant="secondary">Import .feast File</Button>
            </Card>
          </div>
        )}

        {/* Global settings */}
        {activeSection === 'global' && (
          <div className="space-y-4 max-w-lg">
            <h2 className="font-bold text-lg text-ink">Global Settings</h2>
            <Card>
              <CardHeader title="Data Retention" subtitle="How many days of order history to keep" />
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={7} max={365}
                  value={settings.data_retention_days || 90}
                  onChange={(e) => setSetting('data_retention_days', e.target.value)}
                  className="w-24 border border-border-warm rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand text-center"
                />
                <span className="text-sm text-ink-muted">days</span>
              </div>
            </Card>
            <Card>
              <CardHeader title="Currency Symbol" />
              <input
                value={settings.currency_symbol || '₺'}
                onChange={(e) => setSetting('currency_symbol', e.target.value)}
                className="w-20 border border-border-warm rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand text-center"
                maxLength={3}
              />
            </Card>
            <Card>
              <CardHeader title="Prune Old Data" subtitle="Delete order records older than the retention period" />
              <Button variant="secondary" onClick={async () => {
                const r = await window.feastAPI.settings.pruneOldData()
                toast(r.success ? 'Old data pruned' : r.error, r.success ? 'success' : 'error')
              }}>
                Prune Now
              </Button>
            </Card>
          </div>
        )}

        {/* Security */}
        {activeSection === 'security' && (
          <div className="space-y-4 max-w-lg">
            <h2 className="font-bold text-lg text-ink">Security</h2>

            <Card>
              <CardHeader
                title="Password Protection"
                subtitle="When set, a password is required to access Settings, Analytics, and Server"
              />
              <div className="space-y-3">
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordForm.next}
                    onChange={(e) => setPasswordForm((p) => ({ ...p, next: e.target.value }))}
                    placeholder="New password (leave blank to disable)"
                    className="w-full border border-border-warm rounded-xl px-3 py-2.5 pr-10 text-sm focus:outline-none focus:border-brand"
                  />
                  <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <Button size="sm" onClick={async () => {
                  await setSetting('settings_password', passwordForm.next)
                  toast(passwordForm.next ? 'Password set' : 'Password disabled', 'success')
                  setPasswordForm({ current: '', next: '' })
                }}>
                  {passwordForm.next ? 'Set Password' : 'Disable Password'}
                </Button>
                {settings.settings_password && (
                  <p className="text-xs text-amber-600">⚠ Password is currently set. Enter a new one to change it, or leave blank to disable.</p>
                )}
              </div>
            </Card>

            {settings.settings_password && sessionUnlocked && (
              <Card>
                <CardHeader
                  title="Lock Now"
                  subtitle="Re-lock protected sections immediately — next access will require the password"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Lock}
                  onClick={() => { lock(); toast('Session locked', 'info') }}
                >
                  Lock Session
                </Button>
              </Card>
            )}

            <Card>
              <CardHeader title="Protected Areas" />
              <ul className="space-y-2 text-sm">
                {[
                  { label: 'Settings', desc: 'This entire section' },
                  { label: 'Analytics', desc: 'Sales reports and campaign data' },
                  { label: 'Server', desc: 'Waiter/kitchen server controls' },
                ].map((item) => (
                  <li key={item.label} className="flex items-start gap-2">
                    <Lock size={13} className="text-ink-muted mt-0.5 flex-shrink-0" />
                    <span><span className="font-semibold text-ink">{item.label}</span> <span className="text-ink-muted">— {item.desc}</span></span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}
      </div>

      {/* Add discount modal */}
      <Modal open={showDiscountModal} onClose={() => setShowDiscountModal(false)} title="Add Discount" size="sm">
        <div className="space-y-3">
          <input value={discountForm.label} onChange={(e) => setDiscountForm((f) => ({ ...f, label: e.target.value }))}
            placeholder="Label (e.g. Staff Discount, Happy Hour)"
            className="w-full border border-border-warm rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand" autoFocus />
          <div className="relative">
            <input value={discountForm.pct} onChange={(e) => setDiscountForm((f) => ({ ...f, pct: e.target.value }))}
              type="number" min={0} max={100} step={0.5} placeholder="Discount %"
              className="w-full border border-border-warm rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand pr-8" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted text-sm">%</span>
          </div>
          <Button onClick={handleSaveDiscount} disabled={!discountForm.label || !discountForm.pct} className="w-full">Save Discount</Button>
        </div>
      </Modal>
    </div>
  )
}
