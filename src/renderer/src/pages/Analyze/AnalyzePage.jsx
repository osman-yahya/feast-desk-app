import React, { useState, useEffect } from 'react'
import {
  BarChart2, TrendingUp, Calendar, Package, DollarSign, ShoppingBag,
  Lock, ExternalLink, Clock, CreditCard, Percent, Brain, ChevronRight,
  Star, Gem, AlertTriangle, Zap, ArrowUpRight, ArrowDownRight, Minus,
  Users, Layers, ShoppingCart, X, Info
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts'
import { Card, CardHeader } from '../../components/ui/Card.jsx'
import { Button } from '../../components/ui/Button.jsx'
import { Modal } from '../../components/ui/Modal.jsx'
import { useRestaurantStore } from '../../store/useRestaurantStore.js'
import { ADVANCED_ANALYZE_MIN_LEVEL } from '../../config/modules.config.js'

const COLORS = ['#FF3131', '#1C1917', '#78716C', '#E7E0D8', '#44403C', '#DC2626', '#92400E', '#065F46']
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const CUR = '₺'

/* ------------------------------------------------------------------ */
/*  Small reusable pieces                                              */
/* ------------------------------------------------------------------ */

function StatCard({ label, value, sub, icon: Icon, dark = false }) {
  return (
    <Card dark={dark} className="!p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-[11px] font-semibold uppercase tracking-wide mb-1 ${dark ? 'text-gray-400' : 'text-ink-muted'}`}>{label}</p>
          <p className={`font-bold text-2xl ${dark ? 'text-white' : 'text-ink'}`}>{value}</p>
          {sub && <p className={`text-[11px] mt-0.5 ${dark ? 'text-gray-400' : 'text-ink-muted'}`}>{sub}</p>}
        </div>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${dark ? 'bg-white/10' : 'bg-brand-pale'}`}>
          <Icon size={18} className={dark ? 'text-white' : 'text-brand'} />
        </div>
      </div>
    </Card>
  )
}

function SectionTitle({ icon: Icon, title, badge }) {
  return (
    <div className="flex items-center gap-2 mt-2">
      {Icon && <Icon size={16} className="text-brand" />}
      <h2 className="font-bold text-sm text-ink uppercase tracking-wide">{title}</h2>
      {badge && <span className="px-2 py-0.5 bg-brand-pale text-brand text-[10px] font-bold rounded-pill">{badge}</span>}
    </div>
  )
}

function formatMonth(ym) {
  const [y, m] = ym.split('-')
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`
}

/* ------------------------------------------------------------------ */
/*  Insight severity helpers                                           */
/* ------------------------------------------------------------------ */

const SEV = {
  success: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: Star },
  warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: AlertTriangle },
  info:    { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700', icon: Info }
}

/* ------------------------------------------------------------------ */
/*  Modals                                                             */
/* ------------------------------------------------------------------ */

function MonthDetailModal({ open, onClose, month, byDay }) {
  if (!month) return null
  const days = (byDay || []).filter((d) => d.day.startsWith(month.month))
  return (
    <Modal open={open} onClose={onClose} title={`Daily Breakdown — ${formatMonth(month.month)}`} size="lg">
      <div className="space-y-1 max-h-80 overflow-y-auto">
        <div className="grid grid-cols-4 text-[11px] font-semibold text-ink-muted uppercase pb-2 border-b border-border-warm">
          <span>Date</span><span className="text-right">Orders</span><span className="text-right">Revenue</span><span className="text-right">Avg</span>
        </div>
        {days.length === 0 && <p className="text-sm text-ink-muted py-4 text-center">No daily data for this month.</p>}
        {days.map((d) => (
          <div key={d.day} className="grid grid-cols-4 py-2 text-sm border-b border-border-warm last:border-0">
            <span className="text-ink">{d.day}</span>
            <span className="text-right text-ink-muted">{d.count}</span>
            <span className="text-right font-semibold text-ink">{CUR}{d.total.toFixed(2)}</span>
            <span className="text-right text-ink-muted">{CUR}{d.count > 0 ? (d.total / d.count).toFixed(2) : '0.00'}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-between pt-4 mt-4 border-t border-border-warm text-sm font-semibold">
        <span className="text-ink">Total</span>
        <span className="text-brand">{CUR}{month.total.toFixed(2)} from {month.count} orders</span>
      </div>
    </Modal>
  )
}

function InsightDetailModal({ open, onClose, insight }) {
  if (!insight) return null
  const sev = SEV[insight.severity] || SEV.info
  return (
    <Modal open={open} onClose={onClose} title={insight.title} size="lg">
      <div className="space-y-4">
        <div className={`p-4 rounded-xl ${sev.bg} ${sev.border} border`}>
          <p className={`text-sm font-medium ${sev.text}`}>{insight.summary}</p>
        </div>

        {insight.detail && (
          <div>
            <p className="text-xs font-semibold text-ink-muted uppercase mb-1">Details</p>
            <p className="text-sm text-ink whitespace-pre-line">{insight.detail}</p>
          </div>
        )}

        {insight.items && insight.items.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-ink-muted uppercase mb-2">Items</p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {insight.items.map((it, i) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 text-sm">
                  <span className="font-medium text-ink">{it.name || it.pair}</span>
                  <div className="flex items-center gap-3 text-ink-muted text-xs">
                    {it.count != null && <span>{it.count} orders</span>}
                    {it.avg != null && <span>{CUR}{it.avg}/ea</span>}
                    {it.revenue != null && <span>{CUR}{it.revenue.toFixed(2)}</span>}
                    {it.pct != null && <span>{it.pct}% of orders</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-4 rounded-xl bg-brand-pale/60 border border-brand/20">
          <p className="text-xs font-semibold text-brand uppercase mb-1">Recommended Action</p>
          <p className="text-sm text-ink">{insight.action}</p>
        </div>
      </div>
    </Modal>
  )
}

function ItemsModal({ open, onClose, title, items }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      <div className="space-y-1 max-h-96 overflow-y-auto">
        <div className="grid grid-cols-4 text-[11px] font-semibold text-ink-muted uppercase pb-2 border-b border-border-warm">
          <span className="col-span-2">Item</span><span className="text-right">Orders</span><span className="text-right">Revenue</span>
        </div>
        {(items || []).map((it, i) => (
          <div key={i} className="grid grid-cols-4 py-2 text-sm border-b border-border-warm last:border-0">
            <span className="col-span-2 font-medium text-ink">{it.name}</span>
            <span className="text-right text-ink-muted">{it.count}</span>
            <span className="text-right font-semibold text-ink">{CUR}{it.revenue.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export function AnalyzePage() {
  const level = useRestaurantStore((s) => s.level)

  const [range, setRange] = useState('30d')
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Modal state
  const [monthModal, setMonthModal] = useState(null)
  const [insightModal, setInsightModal] = useState(null)
  const [itemsModal, setItemsModal] = useState(null)

  function getRangeDates(r) {
    const now = Date.now()
    const day = 86400000
    switch (r) {
      case 'today': return { from: now - (now % day), to: now }
      case '7d':    return { from: now - 7 * day, to: now }
      case '30d':   return { from: now - 30 * day, to: now }
      case '90d':   return { from: now - 90 * day, to: now }
      default:      return { from: now - 30 * day, to: now }
    }
  }

  async function load(r) {
    setLoading(true)
    const { from, to } = getRangeDates(r || range)
    const isAdv = showAdvanced && level >= ADVANCED_ANALYZE_MIN_LEVEL
    const data = isAdv
      ? await window.feastAPI.analyze.advanced(from, to)
      : await window.feastAPI.analyze.basic(from, to)
    setStats(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [range, showAdvanced])

  const canAdvanced = level >= ADVANCED_ANALYZE_MIN_LEVEL
  const isAdv = showAdvanced && canAdvanced

  return (
    <div className="space-y-5 overflow-y-auto flex-1 min-h-0 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-bold text-xl text-ink">Analyze</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            {[
              { v: 'today', l: 'Today' },
              { v: '7d', l: '7 Days' },
              { v: '30d', l: '30 Days' },
              { v: '90d', l: '90 Days' }
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
              <TrendingUp size={13} /> Advanced
            </button>
          ) : (
            <button onClick={() => window.open('https://feast.tr/dash/premium', '_blank')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-gray-200 text-gray-400 bg-white">
              <Lock size={12} /> Advanced (Level {ADVANCED_ANALYZE_MIN_LEVEL})
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !stats ? null : (
        <>
          {/* ============ KPI CARDS ============ */}
          <div className={`grid gap-4 ${isAdv ? 'grid-cols-2 lg:grid-cols-5' : 'grid-cols-2 lg:grid-cols-4'}`}>
            <StatCard label={range === 'today' ? "Today's Revenue" : 'Period Revenue'} value={`${CUR}${stats.total_earnings?.toFixed(2)}`} icon={DollarSign} dark />
            <StatCard label="Orders" value={stats.total_orders} icon={ShoppingBag} />
            <StatCard label="Avg. Order" value={`${CUR}${stats.total_orders ? (stats.total_earnings / stats.total_orders).toFixed(2) : '0.00'}`} icon={BarChart2} dark />
            <StatCard label="Categories" value={stats.by_category?.length || 0} icon={Package} />
            {isAdv && (
              <StatCard label="Avg. Items / Order" value={stats.avg_items_per_order || '—'} icon={ShoppingCart} />
            )}
          </div>

          {/* ============ REVENUE OVER TIME ============ */}
          {stats.by_day?.length > 0 && (
            <Card>
              <CardHeader title="Revenue Over Time" />
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={stats.by_day} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F5F0EB" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#78716C' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#78716C' }} />
                  <Tooltip formatter={(v) => [`${CUR}${Number(v).toFixed(2)}`, 'Revenue']} />
                  <Line type="monotone" dataKey="total" stroke="#FF3131" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* ============ TOP ITEMS + CATEGORY PIE ============ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {stats.popular_items?.length > 0 && (
              <Card>
                <CardHeader title="Top Items by Orders"
                  action={stats.popular_items.length > 8 && (
                    <button onClick={() => setItemsModal({ title: 'All Items by Orders', items: stats.popular_items })}
                      className="text-xs text-brand font-semibold hover:underline">View all</button>
                  )} />
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats.popular_items.slice(0, 8)} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5F0EB" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#78716C' }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#78716C' }} width={90} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#FF3131" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}

            {stats.by_category?.length > 0 && (
              <Card>
                <CardHeader title="Revenue by Category" />
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={stats.by_category} dataKey="revenue" nameKey="name" cx="50%" cy="50%" outerRadius={70}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {stats.by_category.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => `${CUR}${Number(v).toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            )}
          </div>

          {/* ============ ADVANCED SECTION ============ */}
          {isAdv && (
            <>
              {/* --- MONTHLY REVENUE TABLE --- */}
              {stats.by_month?.length > 0 && (
                <>
                  <SectionTitle icon={Calendar} title="Monthly Revenue" />
                  <Card>
                    <div className="space-y-1">
                      <div className="grid grid-cols-5 text-[11px] font-semibold text-ink-muted uppercase pb-2 border-b border-border-warm">
                        <span>Month</span><span className="text-right">Orders</span><span className="text-right">Revenue</span><span className="text-right">Avg Order</span><span></span>
                      </div>
                      {stats.by_month.map((m) => (
                        <div key={m.month} className="grid grid-cols-5 items-center py-2.5 border-b border-border-warm last:border-0 hover:bg-gray-50 rounded-lg transition-colors">
                          <span className="text-sm font-medium text-ink">{formatMonth(m.month)}</span>
                          <span className="text-sm text-right text-ink-muted">{m.count}</span>
                          <span className="text-sm text-right font-semibold text-ink">{CUR}{m.total.toFixed(2)}</span>
                          <span className="text-sm text-right text-ink-muted">{CUR}{m.avg_order.toFixed(2)}</span>
                          <div className="text-right">
                            <button onClick={() => setMonthModal(m)}
                              className="text-[11px] text-brand font-semibold hover:underline inline-flex items-center gap-0.5">
                              Daily <ChevronRight size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </>
              )}

              {/* --- HOURLY + WEEKDAY CHARTS --- */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {stats.by_hour?.length > 0 && (
                  <div>
                    <SectionTitle icon={Clock} title="Hourly Distribution" />
                    <Card className="mt-2">
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={stats.by_hour} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F5F0EB" />
                          <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#78716C' }} tickFormatter={(h) => `${h}:00`} />
                          <YAxis tick={{ fontSize: 10, fill: '#78716C' }} />
                          <Tooltip labelFormatter={(h) => `${h}:00–${h + 1}:00`}
                            formatter={(v, name) => [name === 'count' ? `${v} orders` : `${CUR}${Number(v).toFixed(2)}`, name === 'count' ? 'Orders' : 'Revenue']} />
                          <Bar dataKey="count" fill="#FF3131" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </Card>
                  </div>
                )}

                {stats.by_weekday?.length > 0 && (
                  <div>
                    <SectionTitle icon={Calendar} title="Day-of-Week Performance" />
                    <Card className="mt-2">
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={stats.by_weekday.map((d) => ({ ...d, name: DAY_NAMES[d.day] }))} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F5F0EB" />
                          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#78716C' }} />
                          <YAxis tick={{ fontSize: 10, fill: '#78716C' }} />
                          <Tooltip formatter={(v, name) => [name === 'total' ? `${CUR}${Number(v).toFixed(2)}` : v, name === 'total' ? 'Revenue' : 'Orders']} />
                          <Bar dataKey="total" fill="#1C1917" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </Card>
                  </div>
                )}
              </div>

              {/* --- PAYMENT METHODS + DISCOUNT STATS --- */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {stats.payment_methods?.length > 0 && (
                  <Card>
                    <CardHeader title="Payment Methods" />
                    <div className="flex items-center gap-6">
                      <div className="w-32 h-32 flex-shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={stats.payment_methods} dataKey="total" nameKey="method" cx="50%" cy="50%" innerRadius={28} outerRadius={52}>
                              {stats.payment_methods.map((_, i) => (
                                <Cell key={i} fill={COLORS[i % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v) => `${CUR}${Number(v).toFixed(2)}`} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex-1 space-y-2">
                        {stats.payment_methods.map((pm, i) => (
                          <div key={pm.method} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                              <span className="text-sm font-medium text-ink capitalize">{pm.method}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-semibold text-ink">{CUR}{pm.total.toFixed(2)}</span>
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
                    <CardHeader title="Discount Usage" />
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="text-center p-3 bg-gray-50 rounded-xl">
                          <p className="text-xs text-ink-muted">Discounted Orders</p>
                          <p className="text-lg font-bold text-ink">{stats.discount_stats.orders_with_discount}</p>
                        </div>
                        <div className="text-center p-3 bg-gray-50 rounded-xl">
                          <p className="text-xs text-ink-muted">Total Discounted</p>
                          <p className="text-lg font-bold text-brand">{CUR}{stats.discount_stats.total_discount.toFixed(2)}</p>
                        </div>
                        <div className="text-center p-3 bg-gray-50 rounded-xl">
                          <p className="text-xs text-ink-muted">% of Orders</p>
                          <p className="text-lg font-bold text-ink">{stats.discount_stats.pct_of_orders}%</p>
                        </div>
                      </div>
                      {stats.total_orders > 0 && (
                        <div className="text-xs text-ink-muted">
                          {stats.discount_stats.pct_of_orders > 30
                            ? 'High discount usage — review whether discounts are driving incremental sales or eroding margin.'
                            : 'Discount usage is within a healthy range.'}
                        </div>
                      )}
                    </div>
                  </Card>
                )}
              </div>

              {/* --- CROSS-PRODUCT MATRIX --- */}
              {stats.cross_product?.length > 0 && (
                <Card>
                  <CardHeader title="Products Often Ordered Together" subtitle="Items appearing in the same checkout" />
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {stats.cross_product.map((pair, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-border-warm last:border-0">
                        <span className="text-sm text-ink">{pair.pair}</span>
                        <span className="text-xs font-bold text-brand bg-brand-pale px-2 py-0.5 rounded-pill">{pair.count}x</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* --- CAMPAIGN MANAGER --- */}
              {stats.campaign_suggestions?.length > 0 && (
                <Card>
                  <CardHeader title="Campaign Manager"
                    subtitle="Promotion suggestions based on sales data"
                    action={<span className="px-2 py-0.5 bg-brand-pale text-brand text-xs font-bold rounded-pill">Smart</span>} />
                  <div className="space-y-3">
                    {stats.campaign_suggestions.map((s, i) => (
                      <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${s.suggestion.includes('Low') ? 'border-amber-200 bg-amber-50' : s.suggestion.includes('High') ? 'border-green-200 bg-green-50' : 'border-border-warm bg-gray-50'}`}>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-ink">{s.item}</p>
                          <p className={`text-xs mt-0.5 ${s.suggestion.includes('Low') ? 'text-amber-700' : s.suggestion.includes('High') ? 'text-green-700' : 'text-ink-muted'}`}>{s.suggestion}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-ink-muted">{s.count} orders</p>
                          <p className="text-xs font-semibold text-ink">{CUR}{s.avg_revenue}/ea</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* ============ AI INSIGHTS ============ */}
              {stats.ai_insights?.length > 0 && (
                <>
                  <SectionTitle icon={Brain} title="AI Analysis" badge="feast AI" />
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {stats.ai_insights.map((ins, i) => {
                      const sev = SEV[ins.severity] || SEV.info
                      const SevIcon = sev.icon
                      return (
                        <Card key={i} hover onClick={() => setInsightModal(ins)} className="!p-4">
                          <div className="flex items-start gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${sev.bg}`}>
                              <SevIcon size={16} className={sev.text} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-sm font-semibold text-ink">{ins.title}</p>
                                <ChevronRight size={14} className="text-ink-muted flex-shrink-0" />
                              </div>
                              <p className="text-xs text-ink-muted line-clamp-2">{ins.summary}</p>
                            </div>
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {/* Locked state */}
          {showAdvanced && !canAdvanced && (
            <Card className="text-center !p-12">
              <Lock size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="font-bold text-ink mb-1">Advanced Analytics requires Level {ADVANCED_ANALYZE_MIN_LEVEL}</p>
              <p className="text-sm text-ink-muted mb-4">Upgrade your feast. subscription to unlock detailed analytics and AI analysis.</p>
              <Button onClick={() => window.open('https://feast.tr/dash/premium', '_blank')} icon={ExternalLink} variant="secondary">Upgrade on feast.tr</Button>
            </Card>
          )}
        </>
      )}

      {/* Modals */}
      <MonthDetailModal open={!!monthModal} onClose={() => setMonthModal(null)} month={monthModal} byDay={stats?.by_day} />
      <InsightDetailModal open={!!insightModal} onClose={() => setInsightModal(null)} insight={insightModal} />
      {itemsModal && <ItemsModal open={!!itemsModal} onClose={() => setItemsModal(null)} title={itemsModal.title} items={itemsModal.items} />}
    </div>
  )
}
