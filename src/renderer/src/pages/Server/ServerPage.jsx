import React, { useEffect } from 'react'
import { Wifi, WifiOff, Users, ChefHat, QrCode, RefreshCw } from 'lucide-react'
import { Card, CardHeader } from '../../components/ui/Card.jsx'
import { Button } from '../../components/ui/Button.jsx'
import { PillBadge } from '../../components/ui/PillBadge.jsx'
import { useServerStore } from '../../store/useServerStore.js'
import { useSettingsStore } from '../../store/useSettingsStore.js'
import { useToast } from '../../components/ui/Toast.jsx'

export function ServerPage() {
  const { isRunning, port, ip, qrDataURL, waiterClients, kitchenClients, start, stop, refreshStatus } = useServerStore()
  const { settings, set: setSetting } = useSettingsStore()
  const toast = useToast()

  useEffect(() => {
    refreshStatus()
    const interval = setInterval(refreshStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  async function handleStart() {
    const result = await start()
    if (result.success) {
      toast(`Server started on port ${result.port}`, 'success')
    } else {
      toast(result.error || 'Failed to start server', 'error')
    }
  }

  async function handleStop() {
    await stop()
    toast('Server stopped', 'info')
  }

  const waiterUrl = isRunning && ip ? `http://${ip}:${port}/waiter` : null
  const kitchenUrl = isRunning && ip ? `http://${ip}:${port}?role=kitchen` : null

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="font-bold text-xl text-ink">Local Server</h1>
        <PillBadge
          label={isRunning ? 'Running' : 'Stopped'}
          color={isRunning ? 'green' : 'gray'}
          dot
        />
      </div>

      {/* Status card */}
      <Card dark={isRunning}>
        <CardHeader
          title={isRunning ? 'Server Active' : 'Server Offline'}
          subtitle={isRunning ? `Listening on ${ip}:${port}` : 'Start the server to allow waiters and kitchen staff to connect'}
        />
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isRunning ? 'bg-white/10' : 'bg-gray-100'}`}>
              <Users size={18} className={isRunning ? 'text-white' : 'text-ink-muted'} />
            </div>
            <div>
              <p className={`font-bold text-lg ${isRunning ? 'text-white' : 'text-ink'}`}>{waiterClients}</p>
              <p className={`text-xs ${isRunning ? 'text-gray-400' : 'text-ink-muted'}`}>Waiters</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isRunning ? 'bg-white/10' : 'bg-gray-100'}`}>
              <ChefHat size={18} className={isRunning ? 'text-white' : 'text-ink-muted'} />
            </div>
            <div>
              <p className={`font-bold text-lg ${isRunning ? 'text-white' : 'text-ink'}`}>{kitchenClients}</p>
              <p className={`text-xs ${isRunning ? 'text-gray-400' : 'text-ink-muted'}`}>Kitchen</p>
            </div>
          </div>
        </div>
        {!isRunning ? (
          <Button icon={Wifi} onClick={handleStart}>Start Server</Button>
        ) : (
          <Button icon={WifiOff} variant="secondary" onClick={handleStop}>Stop Server</Button>
        )}
      </Card>

      {/* Port configuration */}
      <Card>
        <CardHeader title="Server Port" subtitle="Change the port the server listens on (requires restart)" />
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1024} max={65535}
            value={settings.server_port || 3737}
            onChange={(e) => setSetting('server_port', e.target.value)}
            disabled={isRunning}
            className="w-32 border border-border-warm rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand disabled:opacity-50 text-center"
          />
          {isRunning && <p className="text-xs text-amber-600">Stop the server to change the port</p>}
        </div>
      </Card>

      {/* QR Code */}
      {isRunning && qrDataURL && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader title="Waiter QR Code" subtitle="Scan to open the waiter ordering interface" />
            <img src={qrDataURL} alt="Waiter QR" className="w-40 h-40 mx-auto rounded-xl" />
            <p className="text-center text-xs text-ink-muted mt-2 font-mono">{waiterUrl}</p>
          </Card>
          <Card>
            <CardHeader title="How to Connect" />
            <ol className="space-y-3">
              {[
                { icon: '📱', text: 'Scan the QR code with a phone or tablet' },
                { icon: '🛎', text: 'Select "Waiter" role to take orders from tables' },
                { icon: '👨‍🍳', text: 'Visit the URL and select "Kitchen" to display incoming orders' },
                { icon: '🔒', text: 'All devices must be on the same Wi-Fi network' }
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="text-base leading-tight">{step.icon}</span>
                  <span className="text-sm text-ink-muted leading-snug">{step.text}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      )}

      {/* Refresh button */}
      <Button variant="ghost" size="sm" icon={RefreshCw} onClick={refreshStatus}>Refresh Status</Button>
    </div>
  )
}
