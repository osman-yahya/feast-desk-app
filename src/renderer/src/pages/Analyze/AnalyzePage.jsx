import React, { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BarChart2, TrendingUp, Package, DollarSign, ShoppingBag,
  Lock, ExternalLink, Brain, ChevronRight,
  Star, AlertTriangle, Info, ShoppingCart, LineChart as LineIcon,
  LayoutGrid, Sparkles
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts'
import { Card, CardHeader } from '../../components/ui/Card.jsx'
import { Button } from '../../components/ui/Button.jsx'
import { Modal } from '../../components/ui/Modal.jsx'
import { useRestaurantStore } from '../../store/useRestaurantStore.js'
import { useSettingsStore } from '../../store/useSettingsStore.js'
import { ADVANCED_ANALYZE_MIN_LEVEL } from '../../config/modules.config.js'

const COLORS = ['#FF3131', '#1C1917', '#78716C', '#E7E0D8', '#44403C', '#DC2626', '#92400E', '#065F46']

const SEV = {
  success: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: Star },
  warning: { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   icon: AlertTriangle },
  info:    { bg: 'bg-sky-50',     border: 'border-sky-200',     text: 'text-sky-700',     icon: Info }
}

/* ------------------------------------------------------------------ */
/*  Hooks & helpers                                                    */
/* ------------------------------------------------------------------ */

function useCurrency() {
  const settings = useSettingsStore((s) => s.settings)
  return settings?.currency_symbol || '₺'
}

function useMonthFormatter() {
  const { i18n } = useTranslation()
  return (ym) => {
    if (!ym) return ''
    const [y, m] = ym.split('-')
    const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1)
    return new Intl.DateTimeFormat(i18n.language || 'en', { month: 'short', year: 'numeric' }).format(date)
  }
}

function useWeekday() {
  const { t } = useTranslation()
  const short = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  const full  = ['sunFull', 'monFull', 'tueFull', 'wedFull', 'thuFull', 'friFull', 'satFull']
  return {
    short: (n) => t(`analyze.weekdays.${short[n] || 'sun'}`),
    full:  (n) => t(`analyze.weekdays.${full[n]  || 'sunFull'}`)
  }
}

const fmtHour = (h) => `${String(h).padStart(2, '0')}:00`

/* ------------------------------------------------------------------ */
/*  AI-insight translator: structured (type, variant, data) → strings  */
/* ------------------------------------------------------------------ */

function useAITranslator() {
  const { t } = useTranslation()
  const cur = useCurrency()
  const wd = useWeekday()

  return (ins) => {
    const d = ins.data || {}
    const out = { title: '', summary: '', detail: null, action: '', items: null }

    switch (ins.type) {
      case 'trend': {
        const v = ins.variant || 'stable'
        out.title   = t(`analyze.ai.trend.title_${v}`)
        out.summary = v === 'stable'
          ? t('analyze.ai.trend.summary_stable')
          : t(`analyze.ai.trend.summary_${v}`, { pct: d.changePct })
        out.detail  = t('analyze.ai.trend.detail', {
          currency: cur,
          firstHalf:   d.firstHalfTotal?.toFixed(2),
          secondHalf:  d.secondHalfTotal?.toFixed(2),
          firstCount:  d.firstHalfCount,
          secondCount: d.secondHalfCount
        })
        out.action  = t(`analyze.ai.trend.action_${v}`)
        break
      }
      case 'peak_hours': {
        const peak = (d.peak || []).map((h) => fmtHour(h.hour)).join(', ')
        const dead = (d.dead || []).map((h) => fmtHour(h.hour)).join(', ')
        const topRange = d.peak?.[0]
          ? `${fmtHour(d.peak[0].hour)}–${fmtHour(d.peak[0].hour + 1)}`
          : ''
        out.title   = t('analyze.ai.peak_hours.title')
        out.summary = t('analyze.ai.peak_hours.summary', { pct: d.peakPct, hours: peak })
        out.action  = dead
          ? t('analyze.ai.peak_hours.actionWithDead', { topRange, deadHours: dead })
          : t('analyze.ai.peak_hours.action', { topRange })
        out.items   = (d.peak || []).map((h) => ({
          name: fmtHour(h.hour),
          count: h.count,
          revenue: h.total
        }))
        break
      }
      case 'stars':
      case 'hidden_gems':
      case 'underperformers': {
        const ns = `analyze.ai.${ins.type}`
        const plural = d.count === 1 ? 'one' : 'other'
        out.title   = t(`${ns}.title`)
        out.summary = t(`${ns}.summary_${plural}`, { count: d.count })
        out.action  = t(`${ns}.action`)
        out.items   = d.items
        break
      }
      case 'concentration': {
        const v = ins.variant || 'moderate'
        out.title   = t('analyze.ai.concentration.title')
        out.summary = t('analyze.ai.concentration.summary', { pct: d.topPct })
        out.detail  = (d.top3 || []).map((i) => `${i.name}: ${cur}${i.revenue.toFixed(2)}`).join('\n')
        out.action  = t(`analyze.ai.concentration.action_${v}`)
        break
      }
      case 'day_opportunity': {
        const best  = wd.full(d.bestDay)
        const worst = wd.full(d.worstDay)
        out.title   = t('analyze.ai.day_opportunity.title')
        out.summary = t('analyze.ai.day_opportunity.summary', { worst, best, pct: d.gapPct })
        out.detail  = t('analyze.ai.day_opportunity.detail', {
          best, worst,
          currency: cur,
          bestTotal:  d.bestTotal,
          worstTotal: d.worstTotal,
          bestCount:  d.bestCount,
          worstCount: d.worstCount
        })
        out.action  = t('analyze.ai.day_opportunity.action', { worst })
        break
      }
      case 'combo': {
        out.title   = t('analyze.ai.combo.title')
        out.summary = t(`analyze.ai.combo.summary_${d.count === 1 ? 'one' : 'other'}`, { count: d.count })
        out.action  = t('analyze.ai.combo.action')
        out.items   = d.pairs
        break
      }
      case 'order_value': {
        const v = ins.variant || 'avg_above'
        out.title   = t('analyze.ai.order_value.title')
        out.summary = t(`analyze.ai.order_value.summary_${v}`, {
          currency: cur, avg: d.avg.toFixed(2), median: d.median.toFixed(2)
        })
        out.detail  = t('analyze.ai.order_value.detail', {
          currency: cur,
          lowCount:  d.lowCount,
          highCount: d.highCount,
          lowThreshold:  d.lowThreshold.toFixed(2),
          highThreshold: d.highThreshold.toFixed(2)
        })
        out.action  = t(`analyze.ai.order_value.action_${v}`)
        break
      }
      case 'category_dominance': {
        const v = ins.variant || 'moderate'
        out.title   = t('analyze.ai.category_dominance.title')
        out.summary = t('analyze.ai.category_dominance.summary', { name: d.topName, pct: d.topPct })
        out.detail  = (d.breakdown || [])
          .map((c) => `${c.name}: ${cur}${c.revenue.toFixed(2)} (${c.pct}%)`)
          .join('\n')
        out.action  = t(`analyze.ai.category_dominance.action_${v}`)
        break
      }
      default:
        out.title = ins.type
    }
    return out
  }
}

/* ------------------------------------------------------------------ */
/*  Small reusable pieces                                              */
/* ------------------------------------------------------------------ */

function StatCard({ label, value, sub, icon: Icon, dark = false }) {
  return (
    <Card dark={dark} className="!p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${dark ? 'text-gray-400' : 'text-ink-muted'}`}>{label}</p>
          <p className={`font-bold text-xl ${dark ? 'text-white' : 'text-ink'}`}>{value}</p>
          {sub && <p className={`text-[10px] mt-0.5 ${dark ? 'text-gray-400' : 'text-ink-muted'}`}>{sub}</p>}
        </div>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${dark ? 'bg-white/10' : 'bg-brand-pale'}`}>
          <Icon size={16} className={dark ? 'text-white' : 'text-brand'} />
        </div>
      </div>
    </Card>
  )
}

function EmptyState({ icon: Icon = Sparkles, title, hint }) {
  return (
    <Card className="text-center !p-10">
      <Icon size={28} className="text-gray-300 mx-auto mb-3" />
      <p className="font-semibold text-ink">{title}</p>
      {hint && <p className="text-sm text-ink-muted mt-1">{hint}</p>}
    </Card>
  )
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-card animate-pulse" />
        ))}
      </div>
      <div className="h-56 bg-gray-100 rounded-card animate-pulse" />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Modals                                                             */
/* ------------------------------------------------------------------ */

function MonthDetailModal({ open, onClose, month, byDay }) {
  const { t } = useTranslation()
  const cur = useCurrency()
  const formatMonth = useMonthFormatter()
  if (!month) return null
  const days = (byDay || []).filter((d) => d.day.startsWith(month.month))
  return (
    <Modal open={open} onClose={onClose} title={t('analyze.dailyBreakdown', { month: formatMonth(month.month) })} size="lg">
      <div className="space-y-1 max-h-80 overflow-y-auto">
        <div className="grid grid-cols-4 text-[11px] font-semibold text-ink-muted uppercase pb-2 border-b border-border-warm">
          <span>{t('common.date')}</span>
          <span className="text-right">{t('analyze.ordersLabel')}</span>
          <span className="text-right">{t('common.revenue')}</span>
          <span className="text-right">{t('common.avg')}</span>
        </div>
        {days.length === 0 && <p className="text-sm text-ink-muted py-4 text-center">{t('analyze.noDaily')}</p>}
        {days.map((d) => (
          <div key={d.day} className="grid grid-cols-4 py-2 text-sm border-b border-border-warm last:border-0">
            <span className="text-ink">{d.day}</span>
            <span className="text-right text-ink-muted">{d.count}</span>
            <span className="text-right font-semibold text-ink">{cur}{d.total.toFixed(2)}</span>
            <span className="text-right text-ink-muted">{cur}{d.count > 0 ? (d.total / d.count).toFixed(2) : '0.00'}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-between pt-4 mt-4 border-t border-border-warm text-sm font-semibold">
        <span className="text-ink">{t('common.total')}</span>
        <span className="text-brand">{cur}{month.total.toFixed(2)} {t('analyze.fromOrders', { count: month.count })}</span>
      </div>
    </Modal>
  )
}

function InsightDetailModal({ open, onClose, insight }) {
  const { t } = useTranslation()
  const cur = useCurrency()
  const translate = useAITranslator()
  if (!insight) return null
  const sev = SEV[insight.severity] || SEV.info
  const view = translate(insight)
  return (
    <Modal open={open} onClose={onClose} title={view.title} size="lg">
      <div className="space-y-4">
        <div className={`p-4 rounded-xl ${sev.bg} ${sev.border} border`}>
          <p className={`text-sm font-medium ${sev.text}`}>{view.summary}</p>
        </div>

        {view.detail && (
          <div>
            <p className="text-xs font-semibold text-ink-muted uppercase mb-1">{t('analyze.details')}</p>
            <p className="text-sm text-ink whitespace-pre-line">{view.detail}</p>
          </div>
        )}

        {view.items && view.items.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-ink-muted uppercase mb-2">{t('analyze.itemsLabel')}</p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {view.items.map((it, i) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 text-sm">
                  <span className="font-medium text-ink">{it.name || it.pair}</span>
                  <div className="flex items-center gap-3 text-ink-muted text-xs">
                    {it.count != null && <span>{t('analyze.ordersCount', { count: it.count })}</span>}
                    {it.avg != null && <span>{t('analyze.perItem', { currency: cur, amount: it.avg })}</span>}
                    {it.revenue != null && <span>{cur}{Number(it.revenue).toFixed(2)}</span>}
                    {it.pct != null && <span>{it.pct}%</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-4 rounded-xl bg-brand-pale/60 border border-brand/20">
          <p className="text-xs font-semibold text-brand uppercase mb-1">{t('analyze.recommendedAction')}</p>
          <p className="text-sm text-ink">{view.action}</p>
        </div>
      </div>
    </Modal>
  )
}

function ItemsModal({ open, onClose, title, items }) {
  const { t } = useTranslation()
  const cur = useCurrency()
  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      <div className="space-y-1 max-h-96 overflow-y-auto">
        <div className="grid grid-cols-4 text-[11px] font-semibold text-ink-muted uppercase pb-2 border-b border-border-warm">
          <span className="col-span-2">{t('analyze.item')}</span>
          <span className="text-right">{t('analyze.ordersLabel')}</span>
          <span className="text-right">{t('common.revenue')}</span>
        </div>
        {(items || []).map((it, i) => (
          <div key={i} className="grid grid-cols-4 py-2 text-sm border-b border-border-warm last:border-0">
            <span className="col-span-2 font-medium text-ink">{it.name}</span>
            <span className="text-right text-ink-muted">{it.count}</span>
            <span className="text-right font-semibold text-ink">{cur}{it.revenue.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/*  Tab views                                                          */
/* ------------------------------------------------------------------ */

function OverviewTab({ stats, range, hasAdvancedData }) {
  const { t } = useTranslation()
  const cur = useCurrency()
  const showItemsPerOrder = hasAdvancedData && stats.avg_items_per_order != null
  return (
    <div className="space-y-4">
      <div className={`grid gap-3 ${showItemsPerOrder ? 'grid-cols-2 lg:grid-cols-5' : 'grid-cols-2 lg:grid-cols-4'}`}>
        <StatCard
          label={range === 'today' ? t('analyze.todayRevenue') : t('analyze.periodRevenue')}
          value={`${cur}${(stats.total_earnings || 0).toFixed(2)}`}
          icon={DollarSign} dark
        />
        <StatCard label={t('analyze.ordersLabel')} value={stats.total_orders} icon={ShoppingBag} />
        <StatCard
          label={t('analyze.avgOrder')}
          value={`${cur}${stats.total_orders ? (stats.total_earnings / stats.total_orders).toFixed(2) : '0.00'}`}
          icon={BarChart2} dark
        />
        <StatCard label={t('analyze.categoriesLabel')} value={stats.by_category?.length || 0} icon={Package} />
        {showItemsPerOrder && (
          <StatCard label={t('analyze.avgItemsPerOrder')} value={stats.avg_items_per_order || '—'} icon={ShoppingCart} />
        )}
      </div>

      {stats.by_day?.length > 0 && (
        <Card>
          <CardHeader title={t('analyze.revenueOverTime')} />
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={stats.by_day} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F5F0EB" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#78716C' }} />
              <YAxis tick={{ fontSize: 11, fill: '#78716C' }} />
              <Tooltip formatter={(v) => [`${cur}${Number(v).toFixed(2)}`, t('common.revenue')]} />
              <Line type="monotone" dataKey="total" stroke="#FF3131" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {stats.by_category?.length > 0 && (
        <Card>
          <CardHeader title={t('analyze.revenueByCategory')} />
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={stats.by_category} dataKey="revenue" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {stats.by_category.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => `${cur}${Number(v).toFixed(2)}`} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  )
}

function TrendsTab({ stats, canAdvanced, onMonthClick }) {
  const { t } = useTranslation()
  const cur = useCurrency()
  const wd = useWeekday()
  const formatMonth = useMonthFormatter()

  if (!canAdvanced) {
    return <EmptyState icon={Lock} title={t('analyze.advancedRequired', { level: ADVANCED_ANALYZE_MIN_LEVEL })} hint={t('analyze.upgradeHint')} />
  }
  if (!stats.by_month) {
    return <Skeleton />
  }

  return (
    <div className="space-y-4">
      {stats.by_month?.length > 0 && (
        <Card>
          <CardHeader title={t('analyze.monthlyRevenue')} />
          <div className="space-y-1">
            <div className="grid grid-cols-5 text-[11px] font-semibold text-ink-muted uppercase pb-2 border-b border-border-warm">
              <span>{t('common.month')}</span>
              <span className="text-right">{t('analyze.ordersLabel')}</span>
              <span className="text-right">{t('common.revenue')}</span>
              <span className="text-right">{t('analyze.avgOrderShort')}</span>
              <span></span>
            </div>
            {stats.by_month.map((m) => (
              <div key={m.month} className="grid grid-cols-5 items-center py-2.5 border-b border-border-warm last:border-0 hover:bg-gray-50 rounded-lg transition-colors">
                <span className="text-sm font-medium text-ink">{formatMonth(m.month)}</span>
                <span className="text-sm text-right text-ink-muted">{m.count}</span>
                <span className="text-sm text-right font-semibold text-ink">{cur}{m.total.toFixed(2)}</span>
                <span className="text-sm text-right text-ink-muted">{cur}{m.avg_order.toFixed(2)}</span>
                <div className="text-right">
                  <button onClick={() => onMonthClick(m)}
                    className="text-[11px] text-brand font-semibold hover:underline inline-flex items-center gap-0.5">
                    {t('analyze.daily')} <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {stats.by_hour?.length > 0 && (
          <Card>
            <CardHeader title={t('analyze.hourlyDistribution')} />
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.by_hour} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F5F0EB" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#78716C' }} tickFormatter={(h) => `${h}:00`} />
                <YAxis tick={{ fontSize: 10, fill: '#78716C' }} />
                <Tooltip
                  labelFormatter={(h) => `${h}:00–${h + 1}:00`}
                  formatter={(v, name) => [
                    name === 'count' ? t('analyze.ordersCount', { count: v }) : `${cur}${Number(v).toFixed(2)}`,
                    name === 'count' ? t('analyze.ordersLabel') : t('common.revenue')
                  ]}
                />
                <Bar dataKey="count" fill="#FF3131" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {stats.by_weekday?.length > 0 && (
          <Card>
            <CardHeader title={t('analyze.dayOfWeek')} />
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.by_weekday.map((d) => ({ ...d, name: wd.short(d.day) }))} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F5F0EB" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#78716C' }} />
                <YAxis tick={{ fontSize: 10, fill: '#78716C' }} />
                <Tooltip formatter={(v, name) => [
                  name === 'total' ? `${cur}${Number(v).toFixed(2)}` : v,
                  name === 'total' ? t('common.revenue') : t('analyze.ordersLabel')
                ]} />
                <Bar dataKey="total" fill="#1C1917" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {stats.payment_methods?.length > 0 && (
          <Card>
            <CardHeader title={t('analyze.paymentMethods')} />
            <div className="flex items-center gap-6">
              <div className="w-32 h-32 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.payment_methods} dataKey="total" nameKey="method" cx="50%" cy="50%" innerRadius={28} outerRadius={52}>
                      {stats.payment_methods.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => `${cur}${Number(v).toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {stats.payment_methods.map((pm, i) => (
                  <div key={pm.method} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-sm font-medium text-ink capitalize">{t(`common.${pm.method}`, { defaultValue: pm.method })}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-ink">{cur}{pm.total.toFixed(2)}</span>
                      <span className="text-xs text-ink-muted ml-2">({pm.count})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {stats.discount_stats && (
          <Card>
            <CardHeader title={t('analyze.discountUsage')} />
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-gray-50 rounded-xl">
                  <p className="text-xs text-ink-muted">{t('analyze.discountedOrders')}</p>
                  <p className="text-lg font-bold text-ink">{stats.discount_stats.orders_with_discount}</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-xl">
                  <p className="text-xs text-ink-muted">{t('analyze.totalDiscounted')}</p>
                  <p className="text-lg font-bold text-brand">{cur}{stats.discount_stats.total_discount.toFixed(2)}</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-xl">
                  <p className="text-xs text-ink-muted">{t('analyze.pctOfOrders')}</p>
                  <p className="text-lg font-bold text-ink">{stats.discount_stats.pct_of_orders}%</p>
                </div>
              </div>
              {stats.total_orders > 0 && (
                <p className="text-xs text-ink-muted">
                  {stats.discount_stats.pct_of_orders > 30
                    ? t('analyze.highDiscountWarning')
                    : t('analyze.healthyDiscount')}
                </p>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

function ItemsTab({ stats, canAdvanced, onItemsClick }) {
  const { t } = useTranslation()
  const cur = useCurrency()
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {stats.popular_items?.length > 0 && (
          <Card>
            <CardHeader
              title={t('analyze.topItems')}
              action={stats.popular_items.length > 8 && (
                <button
                  onClick={() => onItemsClick({ title: t('analyze.allItemsByOrders'), items: stats.popular_items })}
                  className="text-xs text-brand font-semibold hover:underline"
                >
                  {t('analyze.viewAll')}
                </button>
              )}
            />
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={stats.popular_items.slice(0, 8)} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F5F0EB" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#78716C' }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#78716C' }} width={110} />
                <Tooltip />
                <Bar dataKey="count" fill="#FF3131" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {stats.by_category?.length > 0 && (
          <Card>
            <CardHeader title={t('analyze.revenueByCategory')} />
            <div className="space-y-2">
              {stats.by_category.map((c, i) => {
                const total = stats.by_category.reduce((s, x) => s + x.revenue, 0)
                const pct = total > 0 ? (c.revenue / total) * 100 : 0
                return (
                  <div key={c.name}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-ink truncate">{c.name}</span>
                      <span className="text-ink-muted ml-2">{cur}{c.revenue.toFixed(2)}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}
      </div>

      {canAdvanced && stats.cross_product?.length > 0 && (
        <Card>
          <CardHeader title={t('analyze.crossProduct')} subtitle={t('analyze.crossProductSub')} />
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {stats.cross_product.map((pair, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-lg">
                <span className="text-sm text-ink">{pair.pair}</span>
                <span className="text-xs font-bold text-brand bg-brand-pale px-2 py-0.5 rounded-pill">{pair.count}×</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {canAdvanced && stats.campaign_suggestions?.length > 0 && (
        <Card>
          <CardHeader
            title={t('analyze.campaignManager')}
            subtitle={t('analyze.campaignSub')}
            action={<span className="px-2 py-0.5 bg-brand-pale text-brand text-xs font-bold rounded-pill">{t('analyze.smart')}</span>}
          />
          <div className="space-y-2">
            {stats.campaign_suggestions.map((s, i) => {
              const level = s.level || 'steady'
              const tone = level === 'low' ? 'border-amber-200 bg-amber-50' : level === 'high' ? 'border-green-200 bg-green-50' : 'border-border-warm bg-gray-50'
              const txt  = level === 'low' ? 'text-amber-700' : level === 'high' ? 'text-green-700' : 'text-ink-muted'
              return (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${tone}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">{s.item}</p>
                    <p className={`text-xs mt-0.5 ${txt}`}>{t(`analyze.campaign.${level}`)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-ink-muted">{t('analyze.ordersCount', { count: s.count })}</p>
                    <p className="text-xs font-semibold text-ink">{t('analyze.perItem', { currency: cur, amount: s.avg_revenue })}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}

function AITab({ stats, canAdvanced, onInsightClick }) {
  const { t } = useTranslation()
  const translate = useAITranslator()

  if (!canAdvanced) {
    return <EmptyState icon={Lock} title={t('analyze.advancedRequired', { level: ADVANCED_ANALYZE_MIN_LEVEL })} hint={t('analyze.upgradeHint')} />
  }
  if (!stats.ai_insights) {
    return <Skeleton />
  }
  if (!stats.ai_insights.length) {
    return <EmptyState icon={Brain} title={t('analyze.noInsights')} />
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Brain size={16} className="text-brand" />
        <h2 className="font-bold text-sm text-ink uppercase tracking-wide">{t('analyze.aiAnalysis')}</h2>
        <span className="px-2 py-0.5 bg-brand-pale text-brand text-[10px] font-bold rounded-pill">{t('analyze.feastAI')}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {stats.ai_insights.map((ins, i) => {
          const sev = SEV[ins.severity] || SEV.info
          const SevIcon = sev.icon
          const view = translate(ins)
          return (
            <Card key={i} hover onClick={() => onInsightClick(ins)} className="!p-4">
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${sev.bg}`}>
                  <SevIcon size={16} className={sev.text} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-ink">{view.title}</p>
                    <ChevronRight size={14} className="text-ink-muted flex-shrink-0" />
                  </div>
                  <p className="text-xs text-ink-muted line-clamp-2">{view.summary}</p>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export function AnalyzePage() {
  const { t } = useTranslation()
  const level = useRestaurantStore((s) => s.level)

  const [range, setRange] = useState('30d')
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  const [monthModal, setMonthModal] = useState(null)
  const [insightModal, setInsightModal] = useState(null)
  const [itemsModal, setItemsModal] = useState(null)

  const canAdvanced = level >= ADVANCED_ANALYZE_MIN_LEVEL

  function getRangeDates(r) {
    const now = Date.now()
    const day = 86400000
    switch (r) {
      case 'today': return { from: now - (now % day), to: now }
      case '7d':    return { from: now - 7  * day, to: now }
      case '30d':   return { from: now - 30 * day, to: now }
      case '90d':   return { from: now - 90 * day, to: now }
      default:      return { from: now - 30 * day, to: now }
    }
  }

  // Advanced data is fetched whenever the user has access AND
  // either has the toggle on, or is viewing a tab that needs it.
  const tabNeedsAdvanced = activeTab === 'trends' || activeTab === 'ai'
  const wantsAdvanced = canAdvanced && (showAdvanced || tabNeedsAdvanced)

  async function load() {
    setLoading(true)
    const { from, to } = getRangeDates(range)
    const data = wantsAdvanced
      ? await window.feastAPI.analyze.advanced(from, to)
      : await window.feastAPI.analyze.basic(from, to)
    setStats(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [range, wantsAdvanced])

  const tabs = useMemo(() => ([
    { id: 'overview', icon: LayoutGrid, label: t('analyze.tabs.overview') },
    { id: 'trends',   icon: LineIcon,   label: t('analyze.tabs.trends'),   advanced: true },
    { id: 'items',    icon: Package,    label: t('analyze.tabs.items') },
    { id: 'ai',       icon: Brain,      label: t('analyze.tabs.ai'),       advanced: true }
  ]), [t])

  const hasAnyData = stats && stats.total_orders > 0

  return (
    <div className="space-y-4 overflow-y-auto flex-1 min-h-0 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-bold text-xl text-ink">{t('analyze.analyze')}</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            {[
              { v: 'today', l: t('analyze.today') },
              { v: '7d',    l: t('analyze.7days') },
              { v: '30d',   l: t('analyze.30days') },
              { v: '90d',   l: t('analyze.90days') }
            ].map((r) => (
              <button key={r.v} onClick={() => setRange(r.v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${range === r.v ? 'bg-white shadow text-ink' : 'text-ink-muted hover:text-ink'}`}>
                {r.l}
              </button>
            ))}
          </div>
          {canAdvanced ? (
            <button onClick={() => setShowAdvanced(!showAdvanced)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${showAdvanced ? 'bg-brand text-white border-brand' : 'bg-white text-ink-muted border-border-warm hover:border-gray-300'}`}>
              <TrendingUp size={13} /> {t('analyze.advanced')}
            </button>
          ) : (
            <button onClick={() => window.open('https://feast.tr/dash/premium', '_blank')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-gray-200 text-gray-400 bg-white">
              <Lock size={12} /> {t('analyze.advancedLevel', { level: ADVANCED_ANALYZE_MIN_LEVEL })}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border-warm overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const locked = tab.advanced && !canAdvanced
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => !locked && setActiveTab(tab.id)}
              disabled={locked}
              className={[
                'relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors',
                active ? 'text-brand' : locked ? 'text-gray-300 cursor-not-allowed' : 'text-ink-muted hover:text-ink'
              ].join(' ')}
            >
              <Icon size={14} />
              {tab.label}
              {locked && <Lock size={10} />}
              {active && <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-brand rounded-full" />}
            </button>
          )
        })}
      </div>

      {/* Body */}
      {loading ? (
        <Skeleton />
      ) : !stats ? null : !hasAnyData ? (
        <EmptyState title={t('analyze.noData')} hint={t('analyze.noDataHint')} />
      ) : (
        <>
          {activeTab === 'overview' && <OverviewTab stats={stats} range={range} hasAdvancedData={wantsAdvanced} />}
          {activeTab === 'trends'   && <TrendsTab   stats={stats} canAdvanced={canAdvanced} onMonthClick={setMonthModal} />}
          {activeTab === 'items'    && <ItemsTab    stats={stats} canAdvanced={canAdvanced} onItemsClick={setItemsModal} />}
          {activeTab === 'ai'       && <AITab       stats={stats} canAdvanced={canAdvanced} onInsightClick={setInsightModal} />}
        </>
      )}

      {showAdvanced && !canAdvanced && (
        <Card className="text-center !p-12">
          <Lock size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="font-bold text-ink mb-1">{t('analyze.advancedRequired', { level: ADVANCED_ANALYZE_MIN_LEVEL })}</p>
          <p className="text-sm text-ink-muted mb-4">{t('analyze.upgradeHint')}</p>
          <Button onClick={() => window.open('https://feast.tr/dash/premium', '_blank')} icon={ExternalLink} variant="secondary">
            {t('analyze.upgradeBtn')}
          </Button>
        </Card>
      )}

      {/* Modals */}
      <MonthDetailModal open={!!monthModal} onClose={() => setMonthModal(null)} month={monthModal} byDay={stats?.by_day} />
      <InsightDetailModal open={!!insightModal} onClose={() => setInsightModal(null)} insight={insightModal} />
      {itemsModal && <ItemsModal open={!!itemsModal} onClose={() => setItemsModal(null)} title={itemsModal.title} items={itemsModal.items} />}
    </div>
  )
}
