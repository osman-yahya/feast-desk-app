import React, { useState } from 'react'
import { Lock, Eye, EyeOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSettingsStore } from '../../store/useSettingsStore.js'

export function PasswordGate({ children, feature = 'this area' }) {
  const { t } = useTranslation()
  const settings = useSettingsStore((s) => s.settings)
  const sessionUnlocked = useSettingsStore((s) => s.sessionUnlocked)
  const unlock = useSettingsStore((s) => s.unlock)

  const [pwd, setPwd] = useState('')
  const [error, setError] = useState('')
  const [showPwd, setShowPwd] = useState(false)

  const requiredPassword = settings?.settings_password

  // No password configured → always accessible
  if (!requiredPassword) return children

  // Unlocked this session → accessible
  if (sessionUnlocked) return children

  function handleSubmit(e) {
    e.preventDefault()
    if (pwd === requiredPassword) {
      unlock()
      setPwd('')
      setError('')
    } else {
      setError(t('passwordGate.incorrect'))
      setPwd('')
    }
  }

  return (
    <div className="flex h-full items-center justify-center">
      <div className="bg-white rounded-2xl shadow-card border border-border-warm p-8 w-80 text-center">
        <div className="w-12 h-12 bg-brand-pale rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Lock size={20} className="text-brand" />
        </div>
        <h2 className="font-bold text-lg text-ink mb-1">{t('passwordGate.passwordRequired')}</h2>
        <p className="text-sm text-ink-muted mb-5">{t('passwordGate.enterPassword', { feature })}</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <input
              type={showPwd ? 'text' : 'password'}
              value={pwd}
              onChange={(e) => { setPwd(e.target.value); setError('') }}
              placeholder={t('passwordGate.placeholder')}
              autoFocus
              className="w-full border border-border-warm rounded-xl px-3 py-2.5 pr-10 text-sm focus:outline-none focus:border-brand text-center tracking-widest"
            />
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-ink transition-colors"
            >
              {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          {error && (
            <p className="text-xs text-red-500 font-medium">{error}</p>
          )}
          <button
            type="submit"
            disabled={!pwd}
            className="w-full bg-brand text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-brand-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('passwordGate.unlock')}
          </button>
        </form>
      </div>
    </div>
  )
}
