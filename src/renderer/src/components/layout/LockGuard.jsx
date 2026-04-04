import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../ui/Modal.jsx'
import { Button } from '../ui/Button.jsx'
import { canAccess, MODULE_CONFIG } from '../../config/modules.config.js'
import { useRestaurantStore } from '../../store/useRestaurantStore.js'

export function LockGuard({ moduleId, children }) {
  const { t } = useTranslation()
  const level = useRestaurantStore((s) => s.level)
  const navigate = useNavigate()

  if (canAccess(moduleId, level)) return children

  const mod = MODULE_CONFIG.find((m) => m.id === moduleId)

  const moduleLabels = {
    direct_order: t('modules.directOrder'),
    tables: t('modules.tables'),
    analyze: t('modules.analyze'),
    server: t('modules.server'),
    settings: t('modules.settings')
  }
  const moduleName = moduleLabels[moduleId] || mod?.label || moduleId

  return (
    <Modal
      open
      onClose={() => navigate('/direct-order')}
      title={t('modules.moduleLocked', { module: moduleName })}
      size="sm"
    >
      <div className="flex flex-col items-center text-center gap-5 py-2">
        <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
          <Lock size={24} className="text-gray-400" />
        </div>
        <div>
          <p
            className="text-sm text-ink-muted max-w-xs mx-auto"
            dangerouslySetInnerHTML={{
              __html: t('modules.moduleLockedDesc', { level: mod?.minLevel })
            }}
          />
        </div>
        <Button
          onClick={() => window.open('https://feast.tr/dash/premium', '_blank')}
          icon={ExternalLink}
          variant="secondary"
        >
          {t('modules.upgradeOnFeast')}
        </Button>
      </div>
    </Modal>
  )
}
