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
  const suggestions = basic.popular_items
    .filter((i) => i.revenue > 0)
    .map((i) => ({
      item: i.name,
      count: i.count,
      avg_revenue: parseFloat((i.revenue / i.count).toFixed(2)),
      suggestion:
        i.count < 5
          ? 'Low frequency — consider promotion'
          : i.count > 30
            ? 'High performer — feature prominently'
            : 'Steady seller'
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
/* ------------------------------------------------------------------ */

function generateAIInsights(basic, checkouts, byHour, byWeekday, crossProduct) {
  const insights = []

  // 1. Revenue Trend — compare first half vs second half of the period
  if (checkouts.length >= 4) {
    const mid = Math.floor(checkouts.length / 2)
    const firstHalf = checkouts.slice(0, mid).reduce((s, c) => s + c.grand_total, 0)
    const secondHalf = checkouts.slice(mid).reduce((s, c) => s + c.grand_total, 0)

    if (firstHalf > 0) {
      const change = ((secondHalf - firstHalf) / firstHalf) * 100
      const dir = change > 5 ? 'up' : change < -5 ? 'down' : 'stable'
      insights.push({
        type: 'trend',
        title: dir === 'up' ? 'Revenue Growing' : dir === 'down' ? 'Revenue Declining' : 'Revenue Stable',
        severity: dir === 'down' ? 'warning' : dir === 'up' ? 'success' : 'info',
        summary:
          dir === 'up'
            ? `Revenue increased ${Math.abs(change).toFixed(1)}% in the second half of this period.`
            : dir === 'down'
              ? `Revenue decreased ${Math.abs(change).toFixed(1)}% in the second half of this period.`
              : 'Revenue remained stable throughout this period.',
        detail: `First half: ₺${firstHalf.toFixed(2)} (${mid} orders) → Second half: ₺${secondHalf.toFixed(2)} (${checkouts.length - mid} orders)`,
        action:
          dir === 'down'
            ? 'Review menu pricing, run promotions, or investigate drops in foot traffic.'
            : dir === 'up'
              ? 'Momentum is positive. Consider expanding successful items or testing slight price increases.'
              : 'Consistent demand. Focus on margin optimization and upselling.'
      })
    }
  }

  // 2. Peak Hours
  if (byHour.length > 0) {
    const totalOrders = byHour.reduce((s, h) => s + h.count, 0)
    const sorted = [...byHour].sort((a, b) => b.count - a.count)
    const peak = sorted.slice(0, 3)
    const peakPct = totalOrders > 0 ? ((peak.reduce((s, h) => s + h.count, 0) / totalOrders) * 100).toFixed(0) : 0
    const dead = sorted.filter((h) => h.count > 0).slice(-3).reverse()

    insights.push({
      type: 'peak_hours',
      title: 'Peak Hour Analysis',
      severity: 'info',
      summary: `${peakPct}% of orders concentrate in your top 3 hours: ${peak.map((h) => `${String(h.hour).padStart(2, '0')}:00`).join(', ')}.`,
      detail: peak.map((h) => `${String(h.hour).padStart(2, '0')}:00 — ${h.count} orders, ₺${h.total}`).join('\n'),
      action: `Ensure full staffing at ${String(peak[0].hour).padStart(2, '0')}:00–${String(peak[0].hour + 1).padStart(2, '0')}:00.${dead.length > 0 ? ` Consider happy-hour deals at ${dead.map((h) => String(h.hour).padStart(2, '0') + ':00').join(', ')} to boost off-peak sales.` : ''}`
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
        title: 'Star Products',
        severity: 'success',
        summary: `${stars.length} item(s) lead in both volume and revenue per sale.`,
        items: stars.map((i) => ({ name: i.name, count: i.count, revenue: i.revenue, avg: parseFloat((i.revenue / i.count).toFixed(2)) })),
        action: 'Ensure consistent quality and stock. Test slight price increases to grow margin without losing volume.'
      })
    }
    if (gems.length > 0) {
      insights.push({
        type: 'hidden_gems',
        title: 'Hidden Gems Detected',
        severity: 'success',
        summary: `${gems.length} item(s) earn above-average revenue per sale but have low order count.`,
        items: gems.map((i) => ({ name: i.name, count: i.count, revenue: i.revenue, avg: parseFloat((i.revenue / i.count).toFixed(2)) })),
        action: 'Promote these on your menu board or via waiter recommendations — they convert well but need visibility.'
      })
    }
    if (weak.length > 0) {
      insights.push({
        type: 'underperformers',
        title: 'Underperforming Items',
        severity: 'warning',
        summary: `${weak.length} item(s) have low orders and below-average revenue.`,
        items: weak.map((i) => ({ name: i.name, count: i.count, revenue: i.revenue })),
        action: 'Consider removing, revamping the recipe, or replacing these with better-performing alternatives.'
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
        title: 'Revenue Concentration Risk',
        severity: top3Pct > 70 ? 'warning' : 'info',
        summary: `Top 3 items account for ${top3Pct.toFixed(0)}% of item revenue.`,
        detail: basic.popular_items.slice(0, 3).map((i) => `${i.name}: ₺${i.revenue.toFixed(2)}`).join('\n'),
        action:
          top3Pct > 70
            ? 'High dependency — if any top item becomes unavailable, revenue drops significantly. Actively promote mid-tier items.'
            : 'Moderate concentration. Keep monitoring and nurture variety across the menu.'
      })
    }
  }

  // 5. Day-of-Week Opportunity
  if (byWeekday.length >= 5) {
    const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const mapped = byWeekday.map((d) => ({ ...d, name: names[d.day] }))
    const sorted = [...mapped].sort((a, b) => b.total - a.total)
    const best = sorted[0]
    const worst = sorted[sorted.length - 1]

    if (best.total > 0 && worst.total >= 0) {
      const gap = best.total > 0 ? ((best.total - worst.total) / best.total) * 100 : 0
      if (gap > 30) {
        insights.push({
          type: 'day_opportunity',
          title: 'Weekday Opportunity',
          severity: 'info',
          summary: `${worst.name} generates ${gap.toFixed(0)}% less revenue than ${best.name}.`,
          detail: `Best: ${best.name} — ₺${best.total} (${best.count} orders)\nWeakest: ${worst.name} — ₺${worst.total} (${worst.count} orders)`,
          action: `Run ${worst.name}-specific promotions (happy hours, combo deals) to lift traffic on your slowest day.`
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
        title: 'Combo Menu Opportunities',
        severity: 'success',
        summary: `${viable.length} item pair(s) are frequently ordered together — combo-deal candidates.`,
        items: viable.map((p) => ({
          pair: p.pair,
          count: p.count,
          pct: parseFloat(((p.count / checkouts.length) * 100).toFixed(1))
        })),
        action: 'Bundle these into combo deals. Combos increase perceived value and average order size.'
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
        title: 'Order Value Skew',
        severity: 'info',
        summary:
          avg > median
            ? `Average order (₺${avg.toFixed(2)}) exceeds median (₺${median.toFixed(2)}) — a few large orders inflate the average.`
            : `Median (₺${median.toFixed(2)}) exceeds average (₺${avg.toFixed(2)}) — many small orders pull the average down.`,
        detail: `${low} orders below ₺${(avg * 0.5).toFixed(2)} | ${high} orders above ₺${(avg * 1.5).toFixed(2)}`,
        action:
          avg > median
            ? 'Upsell add-ons (sides, drinks, desserts) to raise the typical order size, not just a few big ones.'
            : 'Order sizes are consistent. Focus on upselling strategies to lift the average ticket.'
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
        title: 'Category Dominance',
        severity: topPct > 70 ? 'warning' : 'info',
        summary: `"${topCat.name}" dominates with ${topPct.toFixed(0)}% of category revenue.`,
        detail: basic.by_category.slice(0, 5).map((c) => `${c.name}: ₺${c.revenue.toFixed(2)} (${totalCatRev > 0 ? ((c.revenue / totalCatRev) * 100).toFixed(0) : 0}%)`).join('\n'),
        action:
          topPct > 70
            ? 'Over-reliance on one category. Promote other categories with deals or menu placement changes.'
            : 'One category leads strongly. Consider featuring second-tier categories to diversify revenue.'
      })
    }
  }

  return insights
}