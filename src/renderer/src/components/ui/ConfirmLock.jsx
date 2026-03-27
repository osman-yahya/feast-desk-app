import React, { useState, useRef, useCallback } from 'react'
import { Trash2 } from 'lucide-react'

const LOCK_DURATION = 3000 // 3 seconds

/**
 * Hold-to-confirm delete button.
 * Press and hold for 3 seconds to execute the action.
 */
export function ConfirmLock({ onConfirm, label = 'Hold to Delete', className = '' }) {
  const [progress, setProgress] = useState(0)
  const [holding, setHolding] = useState(false)
  const intervalRef = useRef(null)
  const startRef = useRef(null)

  const startHold = useCallback(() => {
    setHolding(true)
    startRef.current = Date.now()
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current
      const pct = Math.min((elapsed / LOCK_DURATION) * 100, 100)
      setProgress(pct)
      if (pct >= 100) {
        clearInterval(intervalRef.current)
        setHolding(false)
        setProgress(0)
        onConfirm?.()
      }
    }, 30)
  }, [onConfirm])

  const stopHold = useCallback(() => {
    clearInterval(intervalRef.current)
    setHolding(false)
    setProgress(0)
  }, [])

  return (
    <button
      onMouseDown={startHold}
      onMouseUp={stopHold}
      onMouseLeave={stopHold}
      onTouchStart={startHold}
      onTouchEnd={stopHold}
      className={`relative overflow-hidden flex items-center gap-2 px-4 py-2 rounded-pill text-sm font-semibold transition-all
        ${holding ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-white text-red-500 border border-red-200 hover:bg-red-50'}
        ${className}`}
    >
      {/* Progress fill */}
      {holding && (
        <div
          className="absolute inset-0 bg-red-100 transition-none"
          style={{ width: `${progress}%`, transformOrigin: 'left' }}
        />
      )}
      <span className="relative flex items-center gap-1.5">
        <Trash2 size={14} />
        {holding ? `${Math.round(progress)}%` : label}
      </span>
    </button>
  )
}
