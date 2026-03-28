import React, { useEffect, useState } from 'react'
import { Wifi, WifiOff, Users, ChefHat, QrCode, RefreshCw, Globe, Shield, Loader2 } from 'lucide-react'
import { Card, CardHeader } from '../../components/ui/Card.jsx'
import { Button } from '../../components/ui/Button.jsx'
import { PillBadge } from '../../components/ui/PillBadge.jsx'
import { useServerStore } from '../../store/useServerStore.js'
import { useSettingsStore } from '../../store/useSettingsStore.js'
import { useToast } from '../../components/ui/Toast.jsx'

export function ServerPage() {
  const {
    isRunning, port, ip, connectionMode, tunnelUrl,
    qrDataURL, waiterClients, kitchenClients,
    start, stop, refreshStatus
  } = useServerStore()
  const { settings, set: setSetting } = useSettingsStore()
  const toast = useToast()
  const [selectedMode, setSelectedMode] = useState('local')
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    refreshStatus()
    const interval = setInterval(refreshStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  async function handleStart() {
    setStarting(true)
    try {
      const result = await start(selectedMode)
      if (result.success) {
        toast(`Server started${result.mode === 'tunnel' ? ' with tunnel' : ''} on port ${result.port}`, 'success')
      } else {
        toast(result.error || 'Failed to start server', 'error')
      }
    } finally {
      setStarting(false)
    }
  }

  async function handleStop() {
    await stop()
    toast('Server stopped', 'info')
  }

  const baseUrl = tunnelUrl || (ip ? `http://${ip}:${port}` : null)
  const waiterUrl = isRunning && baseUrl ? `${baseUrl}/waiter` : null
  const kitchenUrl = isRunning && baseUrl ? `${baseUrl}?role=kitchen` : null

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
          subtitle={
            isRunning
              ? connectionMode === 'tunnel'
                ? `Tunnel active — ${tunnelUrl}`
                : `Listening on ${ip}:${port}`
              : 'Start the server to allow waiters and kitchen staff to connect'
          }
        />
        {isRunning && (
          <div className="mb-3">
            <PillBadge
              label={connectionMode === 'tunnel' ? 'Strong Connection (Tunnel)' : 'Safe Connection (Local)'}
              color={connectionMode === 'tunnel' ? 'amber' : 'green'}
            />
          </div>
        )}
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
          <Button icon={starting ? Loader2 : Wifi} onClick={handleStart} loading={starting}>
            {starting ? 'Starting...' : 'Start Server'}
          </Button>
        ) : (
          <Button icon={WifiOff} variant="secondary" onClick={handleStop}>Stop Server</Button>
        )}
      </Card>

      {/* Connection mode selection — only when server is stopped */}
      {!isRunning && (
        <div>
          <h2 className="font-semibold text-sm text-ink mb-3">Connection Type</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Safe Connection (Local) */}
            <button
              onClick={() => setSelectedMode('local')}
              className={`text-left p-4 rounded-2xl border-2 transition-all ${
                selectedMode === 'local'
                  ? 'border-brand bg-brand/5'
                  : 'border-border-warm bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  selectedMode === 'local' ? 'bg-brand/10' : 'bg-gray-100'
                }`}>
                  <Shield size={18} className={selectedMode === 'local' ? 'text-brand' : 'text-ink-muted'} />
                </div>
                <div>
                  <p className="font-semibold text-sm text-ink">Safe Connection</p>
                  <p className="text-xs text-ink-muted">Local Network</p>
                </div>
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">
                Devices connect directly over your Wi-Fi. Fastest and most private — no data leaves your network. All devices must be on the same Wi-Fi.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">Fastest</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">Private</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">Same Wi-Fi only</span>
              </div>
            </button>

            {/* Strong Connection (Tunnel) */}
            <button
              onClick={() => setSelectedMode('tunnel')}
              className={`text-left p-4 rounded-2xl border-2 transition-all ${
                selectedMode === 'tunnel'
                  ? 'border-brand bg-brand/5'
                  : 'border-border-warm bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  selectedMode === 'tunnel' ? 'bg-brand/10' : 'bg-gray-100'
                }`}>
                  <Globe size={18} className={selectedMode === 'tunnel' ? 'text-brand' : 'text-ink-muted'} />
                </div>
                <div>
                  <p className="font-semibold text-sm text-ink">Strong Connection</p>
                  <p className="text-xs text-ink-muted">Internet Tunnel</p>
                </div>
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">
                Creates a public URL via secure tunnel. Works even if devices are on different networks or Wi-Fi is unreliable. Slightly slower.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">Any network</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">Reliable</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">Needs internet</span>
              </div>
            </button>
          </div>

          {/* Recommendation hint */}
          <div className="mt-3 p-3 rounded-xl bg-gray-50 border border-border-warm">
            <p className="text-xs text-ink-muted leading-relaxed">
              {selectedMode === 'local' ? (
                <><strong className="text-ink">Recommended when:</strong> All staff devices (phones, tablets) are connected to the same Wi-Fi network as this computer. Best performance and full privacy.</>
              ) : (
                <><strong className="text-ink">Recommended when:</strong> Your restaurant has multiple Wi-Fi networks, weak signal areas, or staff use mobile data. Connection stays stable even if Wi-Fi drops briefly.</>
              )}
            </p>
          </div>
        </div>
      )}

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

      {/* QR Code & connection info */}
      {isRunning && qrDataURL && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader title="Waiter QR Code" subtitle="Scan to open the waiter ordering interface" />
            <img src={qrDataURL} alt="Waiter QR" className="w-40 h-40 mx-auto rounded-xl" />
            <p className="text-center text-xs text-ink-muted mt-2 font-mono break-all">{waiterUrl}</p>
          </Card>
          <Card>
            <CardHeader title="How to Connect" />
            <ol className="space-y-3">
              {[
                { icon: '1', text: 'Scan the QR code with a phone or tablet' },
                { icon: '2', text: 'Select "Waiter" role to take orders from tables' },
                { icon: '3', text: 'Visit the URL and select "Kitchen" to display incoming orders' },
                ...(connectionMode === 'local'
                  ? [{ icon: '!', text: 'All devices must be on the same Wi-Fi network' }]
                  : [{ icon: '!', text: 'Devices can be on any network — the tunnel URL works everywhere' }]
                )
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
                    step.icon === '!' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-ink-muted'
                  }`}>{step.icon}</span>
                  <span className="text-sm text-ink-muted leading-snug">{step.text}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      )}

      {/* Tunnel URL display when running in tunnel mode */}
      {isRunning && connectionMode === 'tunnel' && tunnelUrl && (
        <Card>
          <CardHeader title="Tunnel URL" subtitle="Share this URL with staff on any network" />
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm bg-gray-50 px-3 py-2 rounded-xl border border-border-warm break-all font-mono">
              {tunnelUrl}
            </code>
          </div>
          <p className="text-xs text-ink-muted mt-2">
            This URL is temporary and changes each time the server restarts.
          </p>
        </Card>
      )}

      {/* Refresh button */}
      <Button variant="ghost" size="sm" icon={RefreshCw} onClick={refreshStatus}>Refresh Status</Button>
    </div>
  )
}
