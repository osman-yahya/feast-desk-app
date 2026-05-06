import { getDb } from '../db/database.js'

export function getBasicStats(fromTs, toTs) {
  const db = getDb()

  const earnings = db
    .prepare('SELECT COALESCE(SUM(grand_total), 0) as total, COUNT(*) as count FROM checkouts WHERE paid_at BETWEEN ? AND ?')
    .get(fromTs, toTs)

  const byDay = db
    .prepare(`
      SELECT date(paid_at / 1000, 'unixepoch', 'localtime') as day,
             SUM(grand_total) as total,
             COUNT(*) as count
      FROM checkouts
      WHERE paid_at BETWEEN ? AND ?
      GROUP BY day
      ORDER BY day ASC
    `)
    .all(fromTs, toTs)

  const checkouts = db
    .prepare('SELECT items_snapshot FROM checkouts WHERE paid_at BETWEEN ? AND ?')
    .all(fromTs, toTs)

  const itemCounts = {}
  for (const c of checkouts) {
    try {
      const items = JSON.parse(c.items_snapshot)
      for (const item of items) {
        if (!item.is_free) {
          const key = item.menu_item_name
          if (!itemCounts[key]) itemCounts[key] = { name: key, count: 0, revenue: 0 }
          itemCounts[key].count += item.quantity || 1
          itemCounts[key].revenue += item.line_total || 0
        }
      }
    } catch {}
  }

  const popularItems = Object.values(itemCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  const categoryRevenue = {}
  for (const c of checkouts) {
    try {
      const items = JSON.parse(c.items_snapshot)
      for (const item of items) {
        if (!item.is_free && item.category_name) {
          const k = item.category_name
          if (!categoryRevenue[k]) categoryRevenue[k] = 0
          categoryRevenue[k] += item.line_total || 0
        }
      }
    } catch {}
  }
  const byCategory = Object.entries(categoryRevenue)
    .map(([name, revenue]) => ({ name, revenue: parseFloat(revenue.toFixed(2)) }))
    .sort((a, b) => b.revenue - a.revenue)

  return {
    total_earnings: parseFloat(earnings.total.toFixed(2)),
    total_orders: earnings.count,
    by_day: byDay.map((d) => ({ ...d, total: parseFloat(d.total.toFixed(2)) })),
    popular_items: popularItems.map((i) => ({ ...i, revenue: parseFloat(i.revenue.toFixed(2)) })),
    by_category: byCategory
  }
}

export function getAdvancedStats(fromTs, toTs) {
  const basic = getBasicStats(fromTs, toTs)
  const db = getDb()

  // Full checkout records for JS-side analysis
  const checkouts = db
    .prepare('SELECT * FROM checkouts WHERE paid_at BETWEEN ? AND ? ORDER BY paid_at ASC')
    .all(fromTs, toTs)

  // --- Monthly breakdown ---
  const byMonth = db
    .prepare(`
      SELECT strftime('%Y-%m', paid_at / 1000, 'unixepoch', 'localtime') as month,
             SUM(grand_total) as total,
             COUNT(*) as count,
             AVG(grand_total) as avg_order
      FROM checkouts
      WHERE paid_at BETWEEN ? AND ?
      GROUP BY month
      ORDER BY month ASC
    `)
    .all(fromTs, toTs)
    .map((r) => ({
      month: r.month,
      total: parseFloat(r.total.toFixed(2)),
      count: r.count,
      avg_order: parseFloat(r.avg_order.toFixed(2))
    }))

  // --- Hourly distribution ---
  const byHour = db
    .prepare(`
      SELECT CAST(strftime('%H', paid_at / 1000, 'unixepoch', 'localtime') AS INTEGER) as hour,
             SUM(grand_total) as total,
             COUNT(*) as count
      FROM checkouts
      WHERE paid_at BETWEEN ? AND ?
      GROUP BY hour
      ORDER BY hour ASC
    `)
    .all(fromTs, toTs)
    .map((r) => ({ hour: r.hour, total: parseFloat(r.total.toFixed(2)), count: r.count }))

  // --- Day-of-week distribution ---
  const byWeekday = db
    .prepare(`
      SELECT CAST(strftime('%w', paid_at / 1000, 'unixepoch', 'localtime') AS INTEGER) as day,
             SUM(grand_total) as total,
             COUNT(*) as count
      FROM checkouts
      WHERE paid_at BETWEEN ? AND ?
      GROUP BY day
      ORDER BY day ASC
    `)
    .all(fromTs, toTs)
    .map((r) => ({ day: r.day, total: parseFloat(r.total.toFixed(2)), count: r.count }))

  // --- Payment method breakdown ---
  const paymentMethods = db
    .prepare(`
      SELECT COALESCE(payment_method, 'cash') as method,
             SUM(grand_total) as total,
             COUNT(*) as count
      FROM checkouts
      WHERE paid_at BETWEEN ? AND ?
      GROUP BY method
      ORDER BY total DESC
    `)
    .all(fromTs, toTs)
    .map((r) => ({ method: r.method, total: parseFloat(r.total.toFixed(2)), count: r.count }))

  // --- Discount stats ---
  const discountRow = db
    .prepare(`
      SELECT COUNT(*) as count,
             COALESCE(SUM(discount_total), 0) as total_discount
      FROM checkouts
      WHERE paid_at BETWEEN ? AND ?
        AND discount_total > 0
    `)
    .get(fromTs, toTs)

  const discountStats = {
    orders_with_discount: discountRow.count,
    total_discount: parseFloat(discountRow.total_discount.toFixed(2)),
    pct_of_orders: basic.total_orders > 0
      ? parseFloat(((discountRow.count / basic.total_orders) * 100).toFixed(1))
      : 0
  }

  // --- Cross-product analysis & avg items per order ---
  const pairs = {}
  let totalItemsInOrders = 0
  for (const c of checkouts) {
    try {
      const items = JSON.parse(c.items_snapshot)
      const paid = items.filter((i) => !i.is_free)
      totalItemsInOrders += paid.reduce((sum, i) => sum + (i.quantity || 1), 0)
      const names = [...new Set(paid.map((i) => i.menu_item_name))]
      for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
          const key = [names[i], names[j]].sort().join(' + ')
          pairs[key] = (pairs[key] || 0) + 1
        }
      }
    } catch {}
  }

  const crossProduct = Object.entries(pairs)
    .map(([pair, count]) => ({ pair, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  const avgItemsPerOrder = checkouts.length > 0
    ? parseFloat((totalItemsInOrders / checkouts.length).toFixed(1))
    : 0

  // --- Campaign suggestions ---
  // `level` is a stable code; the renderer translates it.
  const suggestions = basic.popular_items
    .filter((i) => i.revenue > 0)
    .map((i) => ({
      item: i.name,
      count: i.count,
      avg_revenue: parseFloat((i.revenue / i.count).toFixed(2)),
      level: i.count < 5 ? 'low' : i.count > 30 ? 'high' : 'steady'
    }))

  // --- AI Insights ---
  const ai_insights = generateAIInsights(basic, checkouts, byHour, byWeekday, crossProduct)

  return {
    ...basic,
    by_month: byMonth,
    by_hour: byHour,
    by_weekday: byWeekday,
    payment_methods: paymentMethods,
    discount_stats: discountStats,
    avg_items_per_order: avgItemsPerOrder,
    cross_product: crossProduct,
    campaign_suggestions: suggestions,
    ai_insights
  }
}

/* ------------------------------------------------------------------ */
/*  AI Insights Engine                                                 */
/*  Rule-based analytics labelled as "AI" — no ML, fully deterministic */
/*                                                                     */
/*  Each insight is emitted as { type, severity, variant?, data }.     */
/*  All user-facing strings are translated in the renderer using       */
/*  these structured fields — server stays language-agnostic.          */
/* ------------------------------------------------------------------ */

function generateAIInsights(basic, checkouts, byHour, byWeekday, crossProduct) {
  const insights = []

  // 1. Revenue Trend
  if (checkouts.length >= 4) {
    const mid = Math.floor(checkouts.length / 2)
    const firstHalf = checkouts.slice(0, mid).reduce((s, c) => s + c.grand_total, 0)
    const secondHalf = checkouts.slice(mid).reduce((s, c) => s + c.grand_total, 0)

    if (firstHalf > 0) {
      const change = ((secondHalf - firstHalf) / firstHalf) * 100
      const dir = change > 5 ? 'up' : change < -5 ? 'down' : 'stable'
      insights.push({
        type: 'trend',
        variant: dir,
        severity: dir === 'down' ? 'warning' : dir === 'up' ? 'success' : 'info',
        data: {
          changePct: parseFloat(Math.abs(change).toFixed(1)),
          firstHalfTotal: parseFloat(firstHalf.toFixed(2)),
          secondHalfTotal: parseFloat(secondHalf.toFixed(2)),
          firstHalfCount: mid,
          secondHalfCount: checkouts.length - mid
        }
      })
    }
  }

  // 2. Peak Hours
  if (byHour.length > 0) {
    const totalOrders = byHour.reduce((s, h) => s + h.count, 0)
    const sorted = [...byHour].sort((a, b) => b.count - a.count)
    const peak = sorted.slice(0, 3)
    const peakPct = totalOrders > 0
      ? parseFloat(((peak.reduce((s, h) => s + h.count, 0) / totalOrders) * 100).toFixed(0))
      : 0
    const dead = sorted.filter((h) => h.count > 0).slice(-3).reverse()

    insights.push({
      type: 'peak_hours',
      severity: 'info',
      data: {
        peakPct,
        peak: peak.map((h) => ({ hour: h.hour, count: h.count, total: h.total })),
        dead: dead.map((h) => ({ hour: h.hour, count: h.count, total: h.total }))
      }
    })
  }

  // 3. Menu Health — Stars / Hidden Gems / Underperformers
  if (basic.popular_items.length >= 5) {
    const items = basic.popular_items
    const avgCount = items.reduce((s, i) => s + i.count, 0) / items.length
    const avgRev = items.reduce((s, i) => s + i.revenue / i.count, 0) / items.length

    const stars = items.filter((i) => i.count >= avgCount && i.revenue / i.count >= avgRev)
    const gems = items.filter((i) => i.count < avgCount && i.revenue / i.count > avgRev * 1.2)
    const weak = items.filter((i) => i.count < avgCount * 0.5 && i.revenue / i.count < avgRev * 0.8)

    if (stars.length > 0) {
      insights.push({
        type: 'stars',
        severity: 'success',
        data: {
          count: stars.length,
          items: stars.map((i) => ({
            name: i.name,
            count: i.count,
            revenue: i.revenue,
            avg: parseFloat((i.revenue / i.count).toFixed(2))
          }))
        }
      })
    }
    if (gems.length > 0) {
      insights.push({
        type: 'hidden_gems',
        severity: 'success',
        data: {
          count: gems.length,
          items: gems.map((i) => ({
            name: i.name,
            count: i.count,
            revenue: i.revenue,
            avg: parseFloat((i.revenue / i.count).toFixed(2))
          }))
        }
      })
    }
    if (weak.length > 0) {
      insights.push({
        type: 'underperformers',
        severity: 'warning',
        data: {
          count: weak.length,
          items: weak.map((i) => ({ name: i.name, count: i.count, revenue: i.revenue }))
        }
      })
    }
  }

  // 4. Revenue Concentration Risk
  if (basic.popular_items.length >= 5) {
    const totalRev = basic.popular_items.reduce((s, i) => s + i.revenue, 0)
    const top3Rev = basic.popular_items.slice(0, 3).reduce((s, i) => s + i.revenue, 0)
    const top3Pct = totalRev > 0 ? (top3Rev / totalRev) * 100 : 0

    if (top3Pct > 50) {
      insights.push({
        type: 'concentration',
        variant: top3Pct > 70 ? 'high' : 'moderate',
        severity: top3Pct > 70 ? 'warning' : 'info',
        data: {
          topPct: parseFloat(top3Pct.toFixed(0)),
          top3: basic.popular_items.slice(0, 3).map((i) => ({
            name: i.name,
            revenue: parseFloat(i.revenue.toFixed(2))
          }))
        }
      })
    }
  }

  // 5. Day-of-Week Opportunity
  if (byWeekday.length >= 5) {
    const sorted = [...byWeekday].sort((a, b) => b.total - a.total)
    const best = sorted[0]
    const worst = sorted[sorted.length - 1]

    if (best.total > 0 && worst.total >= 0) {
      const gap = best.total > 0 ? ((best.total - worst.total) / best.total) * 100 : 0
      if (gap > 30) {
        insights.push({
          type: 'day_opportunity',
          severity: 'info',
          data: {
            gapPct: parseFloat(gap.toFixed(0)),
            bestDay: best.day,
            worstDay: worst.day,
            bestTotal: best.total,
            worstTotal: worst.total,
            bestCount: best.count,
            worstCount: worst.count
          }
        })
      }
    }
  }

  // 6. Combo Potential
  if (crossProduct.length > 0 && checkouts.length > 0) {
    const viable = crossProduct.slice(0, 5).filter((p) => p.count >= 3)
    if (viable.length > 0) {
      insights.push({
        type: 'combo',
        severity: 'success',
        data: {
          count: viable.length,
          pairs: viable.map((p) => ({
            pair: p.pair,
            count: p.count,
            pct: parseFloat(((p.count / checkouts.length) * 100).toFixed(1))
          }))
        }
      })
    }
  }

  // 7. Order Value Distribution
  if (checkouts.length >= 10) {
    const totals = checkouts.map((c) => c.grand_total).sort((a, b) => a - b)
    const avg = totals.reduce((s, t) => s + t, 0) / totals.length
    const median = totals[Math.floor(totals.length / 2)]
    const low = totals.filter((t) => t < avg * 0.5).length
    const high = totals.filter((t) => t > avg * 1.5).length

    if (Math.abs(avg - median) > avg * 0.15) {
      insights.push({
        type: 'order_value',
        variant: avg > median ? 'avg_above' : 'median_above',
        severity: 'info',
        data: {
          avg: parseFloat(avg.toFixed(2)),
          median: parseFloat(median.toFixed(2)),
          lowCount: low,
          highCount: high,
          lowThreshold: parseFloat((avg * 0.5).toFixed(2)),
          highThreshold: parseFloat((avg * 1.5).toFixed(2))
        }
      })
    }
  }

  // 8. Category Dominance
  if (basic.by_category.length >= 3) {
    const totalCatRev = basic.by_category.reduce((s, c) => s + c.revenue, 0)
    const topCat = basic.by_category[0]
    const topPct = totalCatRev > 0 ? (topCat.revenue / totalCatRev) * 100 : 0

    if (topPct > 50) {
      insights.push({
        type: 'category_dominance',
        variant: topPct > 70 ? 'high' : 'moderate',
        severity: topPct > 70 ? 'warning' : 'info',
        data: {
          topName: topCat.name,
          topPct: parseFloat(topPct.toFixed(0)),
          breakdown: basic.by_category.slice(0, 5).map((c) => ({
            name: c.name,
            revenue: parseFloat(c.revenue.toFixed(2)),
            pct: totalCatRev > 0 ? parseFloat(((c.revenue / totalCatRev) * 100).toFixed(0)) : 0
          }))
        }
      })
    }
  }

  return insights
}