import React from 'react'

export function Card({ children, className = '', dark = false, onClick, hover = false }) {
  return (
    <div
      onClick={onClick}
      className={[
        'rounded-card p-6 transition-shadow',
        dark
          ? 'bg-surface-dark text-white shadow-dark'
          : 'bg-surface-card border border-border-warm shadow-card',
        hover && !dark ? 'hover:shadow-card-hover cursor-pointer' : '',
        hover && dark ? 'hover:opacity-90 cursor-pointer' : '',
        className
      ].join(' ')}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action, className = '' }) {
  return (
    <div className={`flex items-start justify-between mb-4 ${className}`}>
      <div>
        <h3 className="font-semibold text-base text-ink">{title}</h3>
        {subtitle && <p className="text-xs text-ink-muted mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}
