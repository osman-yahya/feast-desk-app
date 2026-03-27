import React from 'react'
import { Plus, ImageOff } from 'lucide-react'

export function MenuItemCard({ item, onAdd }) {
  const price = parseFloat(item.price || 0)
  return (
    <div
      onClick={() => !item.sold_out && onAdd?.(item)}
      className={`relative bg-white border border-border-warm rounded-2xl overflow-hidden transition-all group
        ${item.sold_out ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-card-hover hover:-translate-y-0.5 cursor-pointer'}`}
    >
      {/* Image area */}
      <div className="h-28 bg-gray-50 flex items-center justify-center overflow-hidden">
        {item.item_picture ? (
          <img src={item.item_picture} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <ImageOff size={24} className="text-gray-300" />
        )}
      </div>
      {/* Content */}
      <div className="p-3">
        <p className="font-semibold text-sm text-ink leading-tight line-clamp-1">{item.name}</p>
        {item.description && (
          <p className="text-xs text-ink-muted mt-0.5 line-clamp-2 leading-relaxed">{item.description}</p>
        )}
        <div className="flex items-center justify-between mt-2">
          <span className="font-bold text-brand text-sm">₺{price.toFixed(2)}</span>
          {!item.sold_out && (
            <button className="w-7 h-7 flex items-center justify-center bg-brand text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
              <Plus size={14} />
            </button>
          )}
          {item.sold_out && (
            <span className="text-xs font-medium text-gray-400">Sold out</span>
          )}
        </div>
      </div>
    </div>
  )
}
