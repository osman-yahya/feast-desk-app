import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Wifi, WifiOff, Users, ChefHat, QrCode, RefreshCw, Globe, Shield, Loader2, Lock, Zap } from 'lucide-react'
import { Card, CardHeader } from '../../components/ui/Card.jsx'
import { Button } from '../../components/ui/Button.jsx'
import { PillBadge } from '../../components/ui/PillBadge.jsx'
import { useServerStore } from '../../store/useServerStore.js'
import { useSettingsStore } from '../../store/useSettingsStore.js'
import { useRestaurantStore } from '../../store/useRestaurantStore.js'
import { useToast } from '../../components/ui/Toast.jsx'
import { FREE_TUNNEL_MIN_LEVEL, FEAST_TUNNEL_MIN_LEVEL } from '../../config/modules.config.js'

export function ServerPage() {
  const {
    isRunning, port, ip, connectionMode, tunnelUrl,
    qrDataURL, waiterClients, kitchenClients,
    start, stop, refreshStatus
  } = useServerStore()
  const { settings, set: setSetting } = useSettingsStore()
  const level = useRestaurantStore((s) => s.level)
  const toast = useToast()
  const { t } = useTranslation()
  const [selectedMode, setSelectedMode] = useState('local')
  const canFreeTunnel = level >= FREE_TUNNEL_MIN_LEVEL
  const canFeastTunnel = level >= FEAST_TUNNEL_MIN_LEVEL
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
        const modeLabel = result.mode === 'feast-tunnel' ? t('server.withFeastTunnel') : result.mode === 'tunnel' ? t('server.withTunnel') : ''
        toast(t('server.serverStarted', { mode: modeLabel, port: result.port }), 'success')
      } else {
        toast(result.error || 'Failed to start server', 'error')
      }
    } finally {
      setStarting(false)
    }
  }

  async function handleStop() {
    await stop()
    toast(t('server.serverStopped'), 'info')
  }

  const baseUrl = tunnelUrl || (ip ? `http://${ip}:${port}` : null)
  const waiterUrl = isRunning && baseUrl ? `${baseUrl}/waiter` : null
  const kitchenUrl = isRunning && baseUrl ? `${baseUrl}?role=kitchen` : null

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="font-bold text-xl text-ink">{t('server.localServer')}</h1>
        <PillBadge
          label={isRunning ? t('server.running') : t('server.stopped')}
          color={isRunning ? 'green' : 'gray'}
          dot
        />
      </div>

      {/* Status card */}
      <Card dark={isRunning}>
        <CardHeader
          title={isRunning ? t('server.serverActive') : t('server.serverOffline')}
          subtitle={
            isRunning
              ? connectionMode === 'tunnel'
                ? t('server.tunnelActive', { url: tunnelUrl })
                : t('server.listeningOn', { ip, port })
              : t('server.startHint')
          }
        />
        {isRunning && (
          <div className="mb-3">
            <PillBadge
              label={
                connectionMode === 'feast-tunnel' ? t('server.feastTunnel') :
                connectionMode === 'tunnel' ? t('server.freeTunnel') :
                t('server.localNetwork')
              }
              color={
                connectionMode === 'feast-tunnel' ? 'green' :
                connectionMode === 'tunnel' ? 'amber' :
                'green'
              }
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
              <p className={`text-xs ${isRunning ? 'text-gray-400' : 'text-ink-muted'}`}>{t('server.waiters')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isRunning ? 'bg-white/10' : 'bg-gray-100'}`}>
              <ChefHat size={18} className={isRunning ? 'text-white' : 'text-ink-muted'} />
            </div>
            <div>
              <p className={`font-bold text-lg ${isRunning ? 'text-white' : 'text-ink'}`}>{kitchenClients}</p>
              <p className={`text-xs ${isRunning ? 'text-gray-400' : 'text-ink-muted'}`}>{t('server.kitchen')}</p>
            </div>
          </div>
        </div>
        {!isRunning ? (
          <Button icon={starting ? Loader2 : Wifi} onClick={handleStart} loading={starting}>
            {starting ? t('server.starting') : t('server.startServer')}
          </Button>
        ) : (
          <Button icon={WifiOff} variant="secondary" onClick={handleStop}>{t('server.stopServer')}</Button>
        )}
      </Card>

      {/* Connection mode selection — only when server is stopped */}
      {!isRunning && (
        <div>
          <h2 className="font-semibold text-sm text-ink mb-3">{t('server.connectionType')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Local Network */}
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
                  <p className="font-semibold text-sm text-ink">{t('server.localNetwork')}</p>
                  <p className="text-xs text-ink-muted">{t('server.sameWifi')}</p>
                </div>
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">
                {t('server.localDesc')}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">{t('server.fastest')}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">{t('server.private')}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">{t('server.sameWifiOnly')}</span>
              </div>
            </button>

            {/* Free Tunnel */}
            <button
              onClick={() => canFreeTunnel && setSelectedMode('tunnel')}
              className={`text-left p-4 rounded-2xl border-2 transition-all relative ${
                !canFreeTunnel
                  ? 'border-border-warm bg-gray-50 opacity-60 cursor-not-allowed'
                  : selectedMode === 'tunnel'
                  ? 'border-brand bg-brand/5'
                  : 'border-border-warm bg-white hover:border-gray-300'
              }`}
            >
              {!canFreeTunnel && (
                <div className="absolute top-3 right-3">
                  <Lock size={14} className="text-gray-400" />
                </div>
              )}
              <div className="flex items-center gap-2.5 mb-2">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  selectedMode === 'tunnel' && canFreeTunnel ? 'bg-brand/10' : 'bg-gray-100'
                }`}>
                  <Globe size={18} className={selectedMode === 'tunnel' && canFreeTunnel ? 'text-brand' : 'text-ink-muted'} />
                </div>
                <div>
                  <p className="font-semibold text-sm text-ink">{t('server.freeTunnel')}</p>
                  <p className="text-xs text-ink-muted">{t('server.internetTunnel')}</p>
                </div>
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">
                {t('server.freeTunnelDesc')}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">{t('server.anyNetwork')}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">{t('server.temporaryUrl')}</span>
                {!canFreeTunnel && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">{t('common.level')} {FREE_TUNNEL_MIN_LEVEL}+</span>}
              </div>
            </button>

            {/* feast. Tunnel */}
            <button
              onClick={() => canFeastTunnel && setSelectedMode('feast-tunnel')}
              className={`text-left p-4 rounded-2xl border-2 transition-all relative ${
                !canFeastTunnel
                  ? 'border-border-warm bg-gray-50 opacity-60 cursor-not-allowed'
                  : selectedMode === 'feast-tunnel'
                  ? 'border-brand bg-brand/5'
                  : 'border-border-warm bg-white hover:border-gray-300'
              }`}
            >
              {!canFeastTunnel && (
                <div className="absolute top-3 right-3">
                  <Lock size={14} className="text-gray-400" />
                </div>
              )}
              <div className="flex items-center gap-2.5 mb-2">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  selectedMode === 'feast-tunnel' && canFeastTunnel ? 'bg-brand/10' : 'bg-gray-100'
                }`}>
                  <Zap size={18} className={selectedMode === 'feast-tunnel' && canFeastTunnel ? 'text-brand' : 'text-ink-muted'} />
                </div>
                <div>
                  <p className="font-semibold text-sm text-ink">{t('server.feastTunnel')}</p>
                  <p className="text-xs text-ink-muted">{t('server.premiumTunnel')}</p>
                </div>
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">
                {t('server.feastTunnelDesc')}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">{t('server.permanentUrl')}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">{t('server.autoReconnect')}</span>
                {!canFeastTunnel && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">{t('common.level')} {FEAST_TUNNEL_MIN_LEVEL}+</span>}
              </div>
            </button>
          </div>

          {/* Recommendation hint */}
          <div className="mt-3 p-3 rounded-xl bg-gray-50 border border-border-warm">
            <p className="text-xs text-ink-muted leading-relaxed">
              {selectedMode === 'local' ? (
                <><strong className="text-ink">{t('server.recommendedWhen')}</strong> {t('server.localRecommendation')}</>
              ) : selectedMode === 'tunnel' ? (
                <><strong className="text-ink">{t('server.recommendedWhen')}</strong> {t('server.tunnelRecommendation')}</>
              ) : (
                <><strong className="text-ink">{t('server.recommendedWhen')}</strong> {t('server.feastRecommendation')}</>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Port configuration */}
      <Card>
        <CardHeader title={t('server.serverPort')} subtitle={t('server.portSubtitle')} />
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1024} max={65535}
            value={settings.server_port || 3737}
            onChange={(e) => setSetting('server_port', e.target.value)}
            disabled={isRunning}
            className="w-32 border border-border-warm rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand disabled:opacity-50 text-center"
          />
          {isRunning && <p className="text-xs text-amber-600">{t('server.stopToChange')}</p>}
        </div>
      </Card>

      {/* QR Code & connection info */}
      {isRunning && qrDataURL && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader title={t('server.waiterQr')} subtitle={t('server.scanToOpen')} />
            <img src={qrDataURL} alt="Waiter QR" className="w-40 h-40 mx-auto rounded-xl" />
            <p className="text-center text-xs text-ink-muted mt-2 font-mono break-all">{waiterUrl}</p>
          </Card>
          <Card>
            <CardHeader title={t('server.howToConnect')} />
            <ol className="space-y-3">
              {[
                { icon: '1', text: t('server.step1') },
                { icon: '2', text: t('server.step2') },
                { icon: '3', text: t('server.step3') },
                ...(connectionMode === 'local'
                  ? [{ icon: '!', text: t('server.localWarning') }]
                  : connectionMode === 'feast-tunnel'
                  ? [{ icon: '!', text: t('server.feastTunnelInfo') }]
                  : [{ icon: '!', text: t('server.freeTunnelInfo') }]
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
      {isRunning && (connectionMode === 'tunnel' || connectionMode === 'feast-tunnel') && tunnelUrl && (
        <Card>
          <CardHeader
            title={connectionMode === 'feast-tunnel' ? t('server.feastTunnelUrlTitle') : t('server.tunnelUrlTitle')}
            subtitle={t('server.shareUrl')}
          />
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm bg-gray-50 px-3 py-2 rounded-xl border border-border-warm break-all font-mono">
              {tunnelUrl}
            </code>
          </div>
          <p className="text-xs text-ink-muted mt-2">
            {connectionMode === 'feast-tunnel'
              ? t('server.permanentUrlInfo')
              : t('server.temporaryUrlInfo')
            }
          </p>
        </Card>
      )}

      {/* Refresh button */}
      <Button variant="ghost" size="sm" icon={RefreshCw} onClick={refreshStatus}>{t('server.refreshStatus')}</Button>
    </div>
  )
}
