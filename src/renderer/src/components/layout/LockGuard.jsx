import React from 'react'
import { Lock, ExternalLink } from 'lucide-react'
import { Button } from '../ui/Button.jsx'
import { canAccess, MODULE_CONFIG } from '../../config/modules.config.js'
import { useRestaurantStore } from '../../store/useRestaurantStore.js'

export function LockGuard({ moduleId, children }) {
  const level = useRestaurantStore((s) => s.level)

  if (canAccess(moduleId, level)) return children

  const mod = MODULE_CONFIG.find((m) => m.id === moduleId)

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center gap-6">
      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
        <Lock size={28} className="text-gray-400" />
      </div>
      <div>
        <h2 className="font-bold text-lg text-ink mb-2">{mod?.label} is locked</h2>
        <p className="text-sm text-ink-muted max-w-xs mx-auto">
          This module requires <strong>Level {mod?.minLevel}</strong> subscription. Upgrade your feast.  plan to access this feature.
        </p>
      </div>
      <Button
        onClick={() => window.open('https://feast.tr/dash/premium', '_blank')}
        icon={ExternalLink}
        variant="secondary"
      >
        Upgrade on feast.tr
      </Button>
    </div>
  )
}
