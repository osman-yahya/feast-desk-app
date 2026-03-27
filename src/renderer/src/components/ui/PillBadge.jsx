import React from 'react'

const colorMap = {
  green:  'bg-green-100 text-green-700',
  red:    'bg-red-100 text-red-600',
  amber:  'bg-amber-100 text-amber-700',
  blue:   'bg-blue-100 text-blue-700',
  gray:   'bg-gray-100 text-gray-600',
  brand:  'bg-brand-pale text-brand'
}

export function PillBadge({ label, color = 'gray', dot = false, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-pill text-xs font-semibold ${colorMap[color]} ${className}`}>
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${color === 'green' ? 'bg-green-500' : color === 'red' ? 'bg-red-500' : color === 'amber' ? 'bg-amber-500' : 'bg-gray-400'}`} />
      )}
      {label}
    </span>
  )
}
