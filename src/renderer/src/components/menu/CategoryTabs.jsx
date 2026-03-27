import React from 'react'

export function CategoryTabs({ categories, activeId, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 no-drag" style={{ scrollbarWidth: 'none' }}>
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onChange(cat.id)}
          className={`flex-shrink-0 px-4 py-2 rounded-pill text-sm font-semibold transition-all ${
            activeId === cat.id
              ? 'bg-brand text-white shadow-sm'
              : 'bg-white border border-border-warm text-ink-muted hover:border-gray-300 hover:text-ink'
          }`}
        >
          {cat.name}
        </button>
      ))}
    </div>
  )
}
