import React, { useState, useEffect } from 'react'
import { BarChart2, TrendingUp, Calendar, Package, DollarSign, ShoppingBag, Lock, ExternalLink } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts'
import { Card, CardHeader } from '../../components/ui/Card.jsx'
import { Button } from '../../components/ui/Button.jsx'
import { useRestaurantStore } from '../../store/useRestaurantStore.js'
import { ADVANCED_ANALYZE_MIN_LEVEL } from '../../config/modules.config.js'

const COLORS = ['#FF3131', '#1C1917', '#78716C', '#E7E0D8', '#44403C']

function StatCard({ label, value, icon: Icon, dark = false }) {
  return (
    <Card dark={dark} className="!p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${dark ? 'text-gray-400' : 'text-ink-muted'}`}>{label}</p>
          <p className={`font-bold text-2xl ${dark ? 'text-white' : 'text-ink'}`}>{value}</p>
        </div>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${dark ? 'bg-white/10' : 'bg-brand-pale'}`}>
          <Icon size={18} className={dark ? 'text-white' : 'text-brand'} />
        </div>
      </div>
    </Card>
  )
}

export function AnalyzePage() {
  const level = useRestaurantStore((s) => s.level)
  const currency = '₺'

  const [range, setRange] = useState('7d')
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  function getRangeDates(r) {
    const now = Date.now()
    const day = 86400000
    switch (r) {
      case 'today': return { from: now - now % day, to: now }
      case '7d': return { from: now - 7 * day, to: now }
      case '30d': return { from: now - 30 * day, to: now }
      case '90d': return { from: now - 90 * day, to: now }
      default: return { from: now - 7 * day, to: now }
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

  useEffect(() => {
    load()
  }, [range, showAdvanced])

  const canAdvanced = level >= ADVANCED_ANALYZE_MIN_LEVEL

  return (
    <div className="space-y-6 overflow-y-auto flex-1 min-h-0 pb-4">
      <div className="flex items-center justify-between">
        <h1 className="font-bold text-xl text-ink">Analyze</h1>
        <div className="flex items-center gap-3">
          {/* Range selector */}
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
          {/* Advanced toggle */}
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
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Earnings" value={`${currency}${stats.total_earnings?.toFixed(2)}`} icon={DollarSign} dark />
            <StatCard label="Orders" value={stats.total_orders} icon={ShoppingBag} />
            <StatCard label="Avg. Order" value={`${currency}${stats.total_orders ? (stats.total_earnings / stats.total_orders).toFixed(2) : '0.00'}`} icon={BarChart2} dark />
            <StatCard label="Categories" value={stats.by_category?.length || 0} icon={Package} />
          </div>

          {/* Earnings by day chart */}
          {stats.by_day?.length > 0 && (
            <Card>
              <CardHeader title="Earnings Over Time" />
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={stats.by_day} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F5F0EB" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#78716C' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#78716C' }} />
                  <Tooltip formatter={(v) => [`${currency}${v.toFixed(2)}`, 'Revenue']} />
                  <Line type="monotone" dataKey="total" stroke="#FF3131" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Popular items */}
            {stats.popular_items?.length > 0 && (
              <Card>
                <CardHeader title="Top Items by Orders" />
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

            {/* Category breakdown */}
            {stats.by_category?.length > 0 && (
              <Card>
                <CardHeader title="Revenue by Category" />
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={stats.by_category} dataKey="revenue" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {stats.by_category.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => `${currency}${v.toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            )}
          </div>

          {/* Advanced analytics */}
          {showAdvanced && canAdvanced && (
            <>
              {/* Cross-product matrix */}
              {stats.cross_product?.length > 0 && (
                <Card>
                  <CardHeader title="Products Often Ordered Together" subtitle="Items appearing in the same checkout" />
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {stats.cross_product.map((pair, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-border-warm last:border-0">
                        <span className="text-sm text-ink">{pair.pair}</span>
                        <span className="text-xs font-bold text-brand bg-brand-pale px-2 py-0.5 rounded-pill">{pair.count}×</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Smart Campaign Manager */}
              {stats.campaign_suggestions?.length > 0 && (
                <Card>
                  <CardHeader
                    title="Smart Campaign Manager"
                    subtitle="AI-driven promotion suggestions based on your sales data"
                    action={<span className="px-2 py-0.5 bg-brand-pale text-brand text-xs font-bold rounded-pill">Smart</span>}
                  />
                  <div className="space-y-3">
                    {stats.campaign_suggestions.map((s, i) => (
                      <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${s.suggestion.includes('Low') ? 'border-amber-200 bg-amber-50' : s.suggestion.includes('High') ? 'border-green-200 bg-green-50' : 'border-border-warm bg-gray-50'}`}>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-ink">{s.item}</p>
                          <p className={`text-xs mt-0.5 ${s.suggestion.includes('Low') ? 'text-amber-700' : s.suggestion.includes('High') ? 'text-green-700' : 'text-ink-muted'}`}>{s.suggestion}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-ink-muted">{s.count} orders</p>
                          <p className="text-xs font-semibold text-ink">{currency}{s.avg_revenue}/ea</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}

          {showAdvanced && !canAdvanced && (
            <Card className="text-center !p-12">
              <Lock size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="font-bold text-ink mb-1">Advanced Analytics requires Level {ADVANCED_ANALYZE_MIN_LEVEL}</p>
              <p className="text-sm text-ink-muted mb-4">Upgrade your feast.  subscription to unlock cross-product analysis and Smart Campaign Manager.</p>
              <Button onClick={() => window.open('https://feast.tr/dash/premium', '_blank')} icon={ExternalLink} variant="secondary">Upgrade on feast.tr</Button>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
