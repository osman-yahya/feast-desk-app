import React, { useState, useEffect } from 'react'
import { Delete, Check, X as XIcon } from 'lucide-react'

/**
 * TouchKeypad
 * -----------
 * On-screen input component for touchscreen cashiers.
 *
 *   mode="numeric"  → 0-9 / . / backspace  (for discount %, amounts, etc.)
 *   mode="text"     → full a-z A-Z 0-9 / - / shift / backspace
 *                     (for restaurant secret, notes, etc.)
 *
 * Usage:
 *   <TouchKeypad
 *     open={showKeypad}
 *     value={discount}
 *     onChange={setDiscount}
 *     onClose={() => setShowKeypad(false)}
 *     onSubmit={(val) => { setDiscount(val); setShowKeypad(false) }}
 *     mode="numeric"
 *     title="Discount %"
 *     suffix="%"
 *     maxLength={5}
 *   />
 *
 * Renders as a modal overlay so it works on top of any page / modal.
 */

export function TouchKeypad({
  open,
  value = '',
  onChange,
  onSubmit,
  onClose,
  mode = 'numeric',
  title,
  placeholder = '',
  suffix = '',
  prefix = '',
  maxLength = 32,
  allowDecimal = true
}) {
  const [local, setLocal] = useState(String(value ?? ''))
  const [shift, setShift] = useState(false)

  useEffect(() => {
    if (open) {
      setLocal(String(value ?? ''))
      setShift(false)
    }
  }, [open, value])

  if (!open) return null

  function commit(next) {
    const trimmed = next.length > maxLength ? next.slice(0, maxLength) : next
    setLocal(trimmed)
    onChange?.(trimmed)
  }

  function tapKey(k) {
    if (k === 'bksp') {
      commit(local.slice(0, -1))
      return
    }
    if (k === 'clear') {
      commit('')
      return
    }
    if (k === '.') {
      if (!allowDecimal) return
      if (local.includes('.')) return
      commit((local || '0') + '.')
      return
    }
    let ch = k
    if (mode === 'text' && /^[a-z]$/.test(k) && shift) {
      ch = k.toUpperCase()
      setShift(false)
    }
    commit(local + ch)
  }

  function handleSubmit() {
    onSubmit?.(local)
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-card shadow-2xl border border-border-warm w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-warm">
          <h2 className="font-semibold text-base text-ink">{title || (mode === 'numeric' ? 'Enter number' : 'Enter text')}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <XIcon size={18} className="text-ink-muted" />
          </button>
        </div>

        {/* Display */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center h-16 px-4 bg-gray-50 border-2 border-border-warm rounded-2xl">
            {prefix && <span className="text-2xl font-bold text-ink-muted mr-1">{prefix}</span>}
            <span className={`flex-1 text-2xl font-bold tracking-wide ${local ? 'text-ink' : 'text-gray-300'} truncate`}>
              {local || placeholder}
            </span>
            {suffix && <span className="text-2xl font-bold text-ink-muted ml-1">{suffix}</span>}
          </div>
        </div>

        {/* Keys */}
        <div className="px-4 pb-4">
          {mode === 'numeric' ? (
            <NumericGrid onTap={tapKey} allowDecimal={allowDecimal} />
          ) : (
            <TextGrid onTap={tapKey} shift={shift} onToggleShift={() => setShift((s) => !s)} />
          )}

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              onClick={() => commit('')}
              className="py-3 rounded-2xl bg-gray-100 text-ink-muted font-semibold text-sm hover:bg-gray-200 active:scale-95 transition-all"
            >
              Clear
            </button>
            <button
              onClick={handleSubmit}
              className="py-3 rounded-2xl bg-brand text-white font-semibold text-sm hover:bg-brand-hover active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Check size={16} /> Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* --------------------------- Numeric grid ---------------------------- */

function NumericGrid({ onTap, allowDecimal }) {
  const rows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    [allowDecimal ? '.' : '', '0', 'bksp']
  ]
  return (
    <div className="grid grid-cols-3 gap-2">
      {rows.flat().map((k, i) => {
        if (!k) return <div key={i} />
        const isBksp = k === 'bksp'
        return (
          <button
            key={i}
            onClick={() => onTap(k)}
            className={`h-14 rounded-2xl font-bold text-xl transition-all active:scale-95 ${
              isBksp
                ? 'bg-gray-100 text-ink-muted hover:bg-gray-200 flex items-center justify-center'
                : 'bg-white border-2 border-border-warm text-ink hover:border-brand hover:bg-brand-pale'
            }`}
          >
            {isBksp ? <Delete size={20} /> : k}
          </button>
        )
      })}
    </div>
  )
}

/* --------------------------- Text grid ------------------------------- */

const TEXT_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', '-'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', 'bksp']
]

function TextGrid({ onTap, shift, onToggleShift }) {
  return (
    <div className="space-y-1.5">
      {TEXT_ROWS.map((row, ri) => (
        <div key={ri} className="flex gap-1 justify-center">
          {ri === 3 && (
            <button
              onClick={onToggleShift}
              className={`flex-1 h-12 rounded-xl font-bold text-sm transition-all active:scale-95 ${
                shift
                  ? 'bg-brand text-white'
                  : 'bg-gray-100 text-ink-muted hover:bg-gray-200'
              }`}
            >
              ⇧
            </button>
          )}
          {row.map((k) => {
            const isBksp = k === 'bksp'
            const display = isBksp
              ? null
              : /^[a-z]$/.test(k) && shift
              ? k.toUpperCase()
              : k
            return (
              <button
                key={k}
                onClick={() => onTap(k)}
                className={`${
                  isBksp ? 'flex-[1.5]' : 'flex-1'
                } h-12 rounded-xl font-bold text-base transition-all active:scale-95 ${
                  isBksp
                    ? 'bg-gray-100 text-ink-muted hover:bg-gray-200 flex items-center justify-center'
                    : 'bg-white border-2 border-border-warm text-ink hover:border-brand hover:bg-brand-pale'
                }`}
              >
                {isBksp ? <Delete size={16} /> : display}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
