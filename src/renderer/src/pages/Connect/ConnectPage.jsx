import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink, Wifi, CheckCircle, ArrowRight } from 'lucide-react'
import { Button } from '../../components/ui/Button.jsx'
import { useRestaurantStore } from '../../store/useRestaurantStore.js'

export function ConnectPage() {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const { connect, isLoading, error, isConnected, restaurant } = useRestaurantStore()

  async function handleConnect(e) {
    e.preventDefault()
    await connect(code.trim())
  }

  if (isConnected && restaurant) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface-bg">
        <div className="flex flex-col items-center gap-6 max-w-sm text-center">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <div>
            <h1 className="font-bold text-xl text-ink">{t('connect.connected')}</h1>
            <p className="text-sm text-ink-muted mt-1">{t('connect.redirecting')}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex bg-surface-bg overflow-hidden">
      {/* Left decorative panel */}
      <div className="hidden lg:flex flex-1 flex-col items-center justify-center bg-surface-dark p-12">
        <div className="max-w-sm text-center space-y-8">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3">
            <img src="/src/assets/logo.png" alt="feast" className="h-14" />
          </div>

          <div className="space-y-4">
            {[
              { icon: '🧾', title: t('connect.billingTitle'), desc: t('connect.billingDesc') },
              { icon: '🗺️', title: t('connect.floorPlanTitle'), desc: t('connect.floorPlanDesc') },
              { icon: '📊', title: t('connect.analyticsTitle'), desc: t('connect.analyticsDesc') },
              { icon: '📡', title: t('connect.waiterTitle'), desc: t('connect.waiterDesc') }
            ].map((f) => (
              <div key={f.title} className="flex items-start gap-3 text-left">
                <span className="text-2xl">{f.icon}</span>
                <div>
                  <p className="text-white font-semibold text-sm">{f.title}</p>
                  <p className="text-gray-400 text-xs">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right connect form */}
      <div className="flex-1 lg:max-w-md flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 mb-8">
            <div className="w-9 h-9 bg-brand rounded-xl flex items-center justify-center">
              <span className="text-white font-black text-base">F</span>
            </div>
            <span className="font-black text-xl text-ink tracking-tight">{t('connect.appTitle')}</span>
          </div>

          <div>
            <h1 className="font-bold text-2xl text-ink">{t('connect.connectRestaurant')}</h1>
            <p className="text-sm text-ink-muted mt-1.5">
              {t('connect.enterCode')}{' '}
              <button
                onClick={() => window.open('https://feast.tr/dash', '_blank')}
                className="text-brand hover:underline font-medium"
              >
                {t('connect.dashboard')}
              </button>
            </p>
          </div>

          <form onSubmit={handleConnect} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1.5 uppercase tracking-wide">
                {t('connect.connectionCode')}
              </label>
              <div className="relative">
                <Wifi size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={t('connect.codePlaceholder')}
                  className="w-full border border-border-warm rounded-xl pl-10 pr-4 py-3 text-sm text-ink placeholder:text-gray-400 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition-all"
                  autoFocus
                  spellCheck={false}
                />
              </div>
              <p className="text-xs text-ink-muted mt-1.5">
                {t('connect.codeFormat')} <code className="font-mono bg-gray-100 px-1 rounded text-xs">{t('connect.codeFormatValue')}</code>
              </p>
            </div>

            {error && (
              <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                {error}
              </div>
            )}

            <Button
              type="submit"
              loading={isLoading}
              disabled={!code.trim()}
              className="w-full"
              size="lg"
              icon={ArrowRight}
            >
              {t('connect.connect')}
            </Button>
          </form>

          <div className="pt-4 border-t border-border-warm flex flex-col gap-2">
            <button
              onClick={() => window.open('https://feast.tr/dash/premium', '_blank')}
              className="flex items-center gap-2 text-sm text-ink-muted hover:text-brand transition-colors"
            >
              <ExternalLink size={14} />
              {t('connect.unlockFeatures')}
            </button>
            <button
              onClick={() => window.open('https://feast.tr/dash/menus', '_blank')}
              className="flex items-center gap-2 text-sm text-ink-muted hover:text-brand transition-colors"
            >
              <ExternalLink size={14} />
              {t('connect.editMenu')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
