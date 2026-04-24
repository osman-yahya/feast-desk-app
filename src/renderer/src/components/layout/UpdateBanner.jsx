import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, RefreshCw, X } from 'lucide-react'

const STATES = { IDLE: 'idle', DOWNLOADING: 'downloading', READY: 'ready' }

export function UpdateBanner() {
  const { t } = useTranslation()
  const [state, setState] = useState(STATES.IDLE)
  const [version, setVersion] = useState('')
  const [percent, setPercent] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const offAvail = window.feastAPI.on('update:available', ({ version }) => {
      setVersion(version)
      setState(STATES.DOWNLOADING)
      setPercent(0)
      setDismissed(false)
    })
    const offProg = window.feastAPI.on('update:progress', ({ percent }) => {
      setPercent(percent)
    })
    const offDone = window.feastAPI.on('update:downloaded', ({ version }) => {
      setVersion(version)
      setState(STATES.READY)
      setDismissed(false)
    })
    return () => {
      offAvail?.()
      offProg?.()
      offDone?.()
    }
  }, [])

  if (state === STATES.IDLE || dismissed) return null

  const handleRestart = () => {
    window.feastAPI.update.install()
  }

  return (
    <div className="px-6 pt-3">
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-brand/10 border border-brand/20 text-ink">
        {state === STATES.DOWNLOADING ? (
          <>
            <Download size={16} className="text-brand flex-shrink-0 animate-pulse" />
            <span className="text-sm font-medium flex-1">
              {t('update.downloading', { percent })}
            </span>
            <button
              onClick={() => setDismissed(true)}
              className="text-ink-muted hover:text-ink p-1 rounded transition-colors"
              aria-label={t('common.close')}
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <>
            <RefreshCw size={16} className="text-brand flex-shrink-0" />
            <span className="text-sm font-medium flex-1">
              {t('update.ready', { version })}
            </span>
            <button
              onClick={handleRestart}
              className="px-3 py-1 rounded-pill bg-brand text-white text-xs font-semibold hover:bg-brand-hover transition-colors"
            >
              {t('update.restart')}
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="text-ink-muted hover:text-ink text-xs font-medium px-2 py-1 transition-colors"
            >
              {t('update.later')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
