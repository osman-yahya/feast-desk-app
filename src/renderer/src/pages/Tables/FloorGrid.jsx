import React from 'react'
import { Users } from 'lucide-react'

const CELL_SIZE = 56 // px per grid unit
const GRID_COLS = 20
const GRID_ROWS = 14

const statusColors = {
  empty: 'bg-white border-border-warm text-ink hover:border-brand hover:shadow-card-hover',
  occupied: 'bg-amber-50 border-amber-300 text-amber-800',
  checkout_pending: 'bg-green-50 border-green-400 text-green-800'
}

export function FloorGrid({ tables, elements, onTableClick, selectedTableId }) {
  return (
    <div className="overflow-auto bg-gray-50 rounded-2xl border border-border-warm p-4">
      <div
        className="relative"
        style={{ width: GRID_COLS * CELL_SIZE, height: GRID_ROWS * CELL_SIZE, minWidth: GRID_COLS * CELL_SIZE }}
      >
        {/* Grid dots background */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={GRID_COLS * CELL_SIZE}
          height={GRID_ROWS * CELL_SIZE}
        >
          {Array.from({ length: GRID_ROWS + 1 }).map((_, r) =>
            Array.from({ length: GRID_COLS + 1 }).map((_, c) => (
              <circle key={`${r}-${c}`} cx={c * CELL_SIZE} cy={r * CELL_SIZE} r={1.5} fill="#E7E0D8" />
            ))
          )}
        </svg>

        {/* Floor elements (walls and labels) */}
        {elements.map((el) => {
          const x = el.grid_col * CELL_SIZE
          const y = el.grid_row * CELL_SIZE
          const w = el.width * CELL_SIZE
          const h = el.height * CELL_SIZE
          if (el.type === 'wall') {
            return (
              <div
                key={el.id}
                className="absolute bg-gray-700 rounded-sm"
                style={{
                  left: x, top: y, width: w, height: Math.max(h, 4),
                  transform: el.angle ? `rotate(${el.angle}deg)` : undefined,
                  transformOrigin: '0 0'
                }}
              />
            )
          }
          if (el.type === 'label') {
            return (
              <div
                key={el.id}
                className="absolute flex items-center justify-center text-xs font-semibold text-ink-muted pointer-events-none"
                style={{ left: x, top: y, width: w, height: h }}
              >
                {el.label_text}
              </div>
            )
          }
          return null
        })}

        {/* Tables */}
        {tables.map((tbl) => {
          const x = tbl.grid_col * CELL_SIZE
          const y = tbl.grid_row * CELL_SIZE
          const w = tbl.width * CELL_SIZE - 4
          const h = tbl.height * CELL_SIZE - 4
          const isSelected = tbl.id === selectedTableId
          const colors = statusColors[tbl.status] || statusColors.empty

          return (
            <button
              key={tbl.id}
              onClick={() => onTableClick?.(tbl)}
              className={`absolute border-2 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all
                ${colors}
                ${isSelected ? '!border-brand !bg-brand-pale ring-2 ring-brand ring-offset-1' : ''}
              `}
              style={{ left: x + 2, top: y + 2, width: w, height: h }}
            >
              <span className="font-bold text-sm leading-tight">{tbl.name}</span>
              {tbl.status === 'occupied' && <Users size={10} className="mt-0.5 opacity-60" />}
              {tbl.status === 'checkout_pending' && <span className="text-[9px] font-medium opacity-70">Bill Ready</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
