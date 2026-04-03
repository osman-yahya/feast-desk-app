import React from 'react'
import { NavLink } from 'react-router-dom'
import { ShoppingCart, LayoutGrid, BarChart2, Wifi, Settings, Lock, ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getAccessibleModules, MODULE_CONFIG } from '../../config/modules.config.js'
import { useRestaurantStore } from '../../store/useRestaurantStore.js'

const iconMap = {
  ShoppingCart, LayoutGrid, BarChart2, Wifi, Settings
}

export function Sidebar({ collapsed, onToggle }) {
  const { t } = useTranslation()
  const level = useRestaurantStore((s) => s.level)
  const restaurant = useRestaurantStore((s) => s.restaurant)
  const accessible = getAccessibleModules(level)
  const accessibleIds = new Set(accessible.map((m) => m.id))

  const moduleLabels = {
    direct_order: t('modules.directOrder'),
    tables: t('modules.tables'),
    analyze: t('modules.analyze'),
    server: t('modules.server'),
    settings: t('modules.settings')
  }

  return (
    <aside
      className={`flex-shrink-0 bg-white border-r border-border-warm flex flex-col h-full transition-all duration-200 ${
        collapsed ? 'w-14' : 'w-56'
      }`}
    >
      {/* Logo area */}
      <div className={`border-b border-border-warm flex items-center drag-region h-12 flex-shrink-0 ${collapsed ? 'justify-center px-0' : 'px-4 gap-3'}`}>
        <img src="/src/assets/logo.png" alt="feast" className="w-8 h-8 object-contain" />
        {!collapsed && (
          <span className="font-bold text-sm text-ink truncate flex-1">feast. Desk</span>
        )}
      </div>

      {/* Nav */}
      <nav className={`flex-1 py-3 flex flex-col gap-0.5 overflow-y-auto ${collapsed ? 'px-1.5' : 'px-2'}`}>
        {MODULE_CONFIG.map((mod) => {
          const Icon = iconMap[mod.icon] || Settings
          const isLocked = !accessibleIds.has(mod.id)
          return (
            <NavLink
              key={mod.id}
              to={isLocked ? '#' : mod.path}
              onClick={(e) => isLocked && e.preventDefault()}
              title={collapsed ? (isLocked ? `${moduleLabels[mod.id] || mod.label} — ${t('modules.requiresLevel', { level: mod.minLevel })}` : (moduleLabels[mod.id] || mod.label)) : undefined}
              className={({ isActive }) => [
                'flex items-center rounded-xl text-sm font-medium transition-all',
                collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
                isLocked
                  ? 'text-gray-300 cursor-not-allowed'
                  : isActive
                  ? 'bg-brand-pale text-brand'
                  : 'text-ink-muted hover:bg-gray-50 hover:text-ink'
              ].join(' ')}
            >
              <Icon size={17} className="flex-shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1 truncate">{moduleLabels[mod.id] || mod.label}</span>
                  {isLocked && <Lock size={11} className="flex-shrink-0 opacity-50" />}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Restaurant info */}
      {restaurant && (
        <div className={`border-t border-border-warm flex-shrink-0 ${collapsed ? 'p-2 flex justify-center' : 'px-3 py-3'}`}>
          {collapsed ? (
            <div title={restaurant.restaurant_name}>
              {restaurant.img_local_path ? (
                <img
                  src={`feast-local://${restaurant.img_local_path}`}
                  alt="restaurant"
                  className="w-8 h-8 rounded-lg object-cover bg-gray-100"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-brand-pale flex items-center justify-center">
                  <span className="text-brand text-xs font-bold">{restaurant.restaurant_name?.[0] || 'R'}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              {restaurant.img_local_path ? (
                <img
                  src={`feast-local://${restaurant.img_local_path}`}
                  alt="restaurant"
                  className="w-8 h-8 rounded-lg object-cover flex-shrink-0 bg-gray-100"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-brand-pale flex items-center justify-center flex-shrink-0">
                  <span className="text-brand text-xs font-bold">{restaurant.restaurant_name?.[0] || 'R'}</span>
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-ink truncate">{restaurant.restaurant_name}</p>
                <p className="text-[10px] text-ink-muted">{t('common.level')} {restaurant.level}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className={`border-t border-border-warm flex-shrink-0 flex items-center justify-center py-2.5 text-gray-400 hover:text-ink hover:bg-gray-50 transition-colors ${collapsed ? 'px-0' : 'px-3 gap-2'}`}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={14} /> : (
          <>
            <ChevronLeft size={14} />
            <span className="text-xs font-medium">{t('common.collapse')}</span>
          </>
        )}
      </button>
    </aside>
  )
}
