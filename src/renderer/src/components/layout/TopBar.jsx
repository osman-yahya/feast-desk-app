import React from 'react'
import { AlertTriangle } from 'lucide-react'

export function TopBar({ staleCache, onRefreshRequest }) {
  return (
    <header className="h-12 bg-white border-b border-border-warm flex items-center justify-between px-6 flex-shrink-0 drag-region">
      <div />
      <div className="no-drag flex items-center gap-3">
        {staleCache && (
          <button
            onClick={onRefreshRequest}
            className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-pill text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors"
          >
            <AlertTriangle size={12} />
            Menu data is outdated — refresh
          </button>
        )}
      </div>
    </header>
  )
}
