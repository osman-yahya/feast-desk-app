import { getDb } from '../db/database.js'
import { settingsRepo } from '../db/repositories/settings.repo.js'

export function getBasicStats(fromTs, toTs) {
  const db = getDb()

  // Total earnings
  const earnings = db
    .prepare('SELECT COALESCE(SUM(grand_total), 0) as total, COUNT(*) as count FROM checkouts WHERE paid_at BETWEEN ? AND ?')
    .get(fromTs, toTs)

  // Earnings by day
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

  // Popular items (from items_snapshot JSON)
  // We aggregate by parsing snapshots
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

  // Category breakdown
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

  // Cross-product analysis: which items appear together most often
  const db = getDb()
  const checkouts = db
    .prepare('SELECT items_snapshot FROM checkouts WHERE paid_at BETWEEN ? AND ?')
    .all(fromTs, toTs)

  const pairs = {}
  for (const c of checkouts) {
    try {
      const items = JSON.parse(c.items_snapshot)
      const names = [...new Set(items.filter((i) => !i.is_free).map((i) => i.menu_item_name))]
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

  // Smart Campaign suggestions: high revenue items with low frequency = promote them
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

  return { ...basic, cross_product: crossProduct, campaign_suggestions: suggestions }
}
