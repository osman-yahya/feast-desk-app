import React from 'react'

const variants = {
  primary: 'bg-brand text-white hover:bg-brand-hover active:scale-95',
  secondary: 'bg-white text-ink border border-border-warm hover:bg-gray-50 active:scale-95',
  dark: 'bg-surface-dark text-white hover:bg-gray-800 active:scale-95',
  ghost: 'text-ink-muted hover:bg-gray-100 active:scale-95',
  danger: 'bg-red-500 text-white hover:bg-red-600 active:scale-95'
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-7 py-3 text-base'
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  pill = true,
  className = '',
  disabled,
  loading,
  icon: Icon,
  onClick,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150',
        pill ? 'rounded-pill' : 'rounded-xl',
        variants[variant],
        sizes[size],
        disabled || loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        className
      ].join(' ')}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : Icon ? (
        <Icon size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} />
      ) : null}
      {children}
    </button>
  )
}
