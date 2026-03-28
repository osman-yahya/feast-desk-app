import React, { useState, useEffect } from 'react'
import { X, Plus, Minus, CreditCard, Tag, Gift, Users, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button.jsx'
import { ConfirmLock } from '../../components/ui/ConfirmLock.jsx'
import { Modal } from '../../components/ui/Modal.jsx'
import { Card } from '../../components/ui/Card.jsx'
import { useOrderStore } from '../../store/useOrderStore.js'
import { useRestaurantStore } from '../../store/useRestaurantStore.js'
import { useSettingsStore } from '../../store/useSettingsStore.js'
import { useTableStore } from '../../store/useTableStore.js'
import { useToast } from '../../components/ui/Toast.jsx'

export function TableOrderDrawer({ tableId, table, onClose }) {
  const { tableOrders, loadTableOrder, createOrder, addItem, removeItem, updateItem, clearTableOrder } = useOrderStore()
  const menu = useRestaurantStore((s) => s.menu)
  const { discounts } = useSettingsStore()
  const { updateTableStatusLocally } = useTableStore()
  const toast = useToast()

  const [showAddItems, setShowAddItems] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [showDutch, setShowDutch] = useState(false)
  const [activeCatIdx, setActiveCatIdx] = useState(0)
  const [discountPct, setDiscountPct] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [bill, setBill] = useState(null)
  const [appliedDiscount, setAppliedDiscount] = useState(null) // discount locked at bill-build time
  const [finalizing, setFinalizing] = useState(false)
  const [dutchSelected, setDutchSelected] = useState(new Map()) // id → qty
  const [dutchBill, setDutchBill] = useState(null)

  const entry = tableOrders[tableId]
  const order = entry?.order
  const items = entry?.items || []
  const categories = menu?.content?.categories || []
  const currency = '₺'

  useEffect(() => {
    loadTableOrder(tableId)
    setActiveCatIdx(0)
  }, [tableId])

  async function getOrCreateOrder() {
    if (order) return order
    const newOrder = await createOrder(tableId)
    updateTableStatusLocally(tableId, 'occupied')
    return newOrder
  }

  async function handleAddMenuItem(menuItem) {
    const o = await getOrCreateOrder()
    await addItem(o.id, {
      menu_item_id: String(menuItem.id ?? menuItem.name),
      menu_item_name: menuItem.name,
      category_name: categories[activeCatIdx]?.name,
      unit_price: parseFloat(menuItem.price),
      quantity: 1
    }, tableId)
    toast(`+ ${menuItem.name}`, 'info')
  }

  async function handleQtyChange(item, delta) {
    const newQty = item.quantity + delta
    if (newQty <= 0) {
      await removeItem(item.id, order?.id, tableId)
    } else {
      await updateItem(item.id, { quantity: newQty }, tableId)
    }
  }

  async function handleToggleFree(item) {
    await window.feastAPI.checkout.markFree(item.id, !item.is_free)
    await updateItem(item.id, { is_free: !item.is_free ? 1 : 0 }, tableId)
  }

  async function openCheckout() {
    if (!order || !items.length) return
    // Lock the discount now so the bill displayed matches what will be finalized
    const pct = discountPct > 0 ? discountPct : null
    const b = await window.feastAPI.checkout.buildBill(order.id, pct)
    setBill(b)
    setAppliedDiscount(pct)
    setShowCheckout(true)
  }

  async function handleFinalize() {
    if (!order) return
    setFinalizing(true)
    const result = await window.feastAPI.checkout.finalize(order.id, paymentMethod, appliedDiscount, null)
    setFinalizing(false)
    if (result.success) {
      toast(`Table ${table?.name} — Paid ${currency}${result.checkout.grand_total.toFixed(2)}`, 'success')
      setShowCheckout(false)
      setAppliedDiscount(null)
      clearTableOrder(tableId)
      updateTableStatusLocally(tableId, 'empty')
      onClose()
    } else {
      toast(result.error || 'Checkout failed', 'error')
    }
  }

  async function handleDeleteOrder() {
    if (!order) return
    await window.feastAPI.checkout.deleteOrder(order.id)
    clearTableOrder(tableId)
    updateTableStatusLocally(tableId, 'empty')
    toast('Order deleted', 'info')
    onClose()
  }

  // Dutch treat: calculate partial bill for selected items
  async function openDutch() {
    setDutchSelected(new Map())
    setDutchBill(null)
    setShowDutch(true)
  }

  function calcDutchBill() {
    let total = 0
    for (const [itemId, qty] of dutchSelected.entries()) {
      const item = items.find((i) => i.id === itemId)
      if (item && !item.is_free && qty > 0) {
        const pct = discountPct > 0 ? discountPct : (item.discount_pct || 0)
        total += item.unit_price * qty * (1 - pct / 100)
      }
    }
    setDutchBill(parseFloat(total.toFixed(2)))
  }

  async function handleMarkDutchPaid() {
    // Mark fully-selected items as paid_partial
    const fullItemIds = [...dutchSelected.entries()]
      .filter(([itemId, qty]) => {
        const item = items.find((i) => i.id === itemId)
        return item && qty >= item.quantity
      })
      .map(([itemId]) => itemId)
    if (fullItemIds.length) await window.feastAPI.checkout.markPartialPaid(fullItemIds)
    await loadTableOrder(tableId)
    toast(`Partial payment recorded — ${currency}${dutchBill?.toFixed(2)}`, 'success')
    setShowDutch(false)
  }

  const subtotal = items.reduce((s, i) => s + (!i.is_free ? i.unit_price * i.quantity : 0), 0)
  const paidPartialTotal = items.filter((i) => i.is_paid_partial).reduce((s, i) => s + (i.unit_price * i.quantity), 0)

  return (
    <div className="w-80 flex-shrink-0 bg-white border-l border-border-warm flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-warm flex-shrink-0">
        <div>
          <h2 className="font-bold text-sm text-ink">Table {table?.name}</h2>
          <p className="text-xs text-ink-muted">{items.length} items</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <X size={16} className="text-ink-muted" />
        </button>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-center">
            <p className="text-sm text-ink-muted">No items yet</p>
            <Button size="sm" icon={Plus} onClick={() => setShowAddItems(true)}>Add Items</Button>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className={`flex items-center gap-2 py-2 border-b border-border-warm last:border-0 ${item.is_paid_partial ? 'opacity-50' : ''}`}>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium truncate ${item.is_free ? 'line-through text-gray-400' : 'text-ink'}`}>
                  {item.menu_item_name}
                </p>
                <p className="text-xs text-brand font-semibold">
                  {item.is_free ? 'Free' : `${currency}${(item.unit_price * item.quantity).toFixed(2)}`}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleToggleFree(item)}
                  className={`p-1.5 rounded-lg transition-colors ${item.is_free ? 'text-green-500' : 'text-gray-300 hover:text-green-400'}`}
                  title="Mark free"
                >
                  <Gift size={14} />
                </button>
                <button onClick={() => handleQtyChange(item, -1)} className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200 active:scale-95">
                  <Minus size={12} />
                </button>
                <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
                <button onClick={() => handleQtyChange(item, 1)} className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200 active:scale-95">
                  <Plus size={12} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-4 border-t border-border-warm flex-shrink-0 space-y-3">
        {/* Discount chips */}
        {items.length > 0 && discounts.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <button onClick={() => setDiscountPct(0)}
              className={`px-2 py-0.5 rounded-pill text-xs font-medium ${discountPct === 0 ? 'bg-brand text-white' : 'bg-gray-100 text-ink-muted hover:bg-gray-200'}`}>
              No discount
            </button>
            {discounts.map((d) => (
              <button key={d.id} onClick={() => setDiscountPct(d.pct)}
                className={`px-2 py-0.5 rounded-pill text-xs font-medium ${discountPct === d.pct ? 'bg-brand text-white' : 'bg-gray-100 text-ink-muted hover:bg-gray-200'}`}>
                {d.label}
              </button>
            ))}
          </div>
        )}

        {/* Total line */}
        {items.length > 0 && (
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-ink-muted">
              {discountPct > 0 ? `Total (${discountPct}% off)` : 'Total'}
              {paidPartialTotal > 0 && <span className="text-blue-500 ml-1">· {currency}{paidPartialTotal.toFixed(2)} paid</span>}
            </span>
            <span className="font-bold text-sm text-brand">
              {currency}{(subtotal * (1 - discountPct / 100) - paidPartialTotal).toFixed(2)}
            </span>
          </div>
        )}

        <div className="flex gap-2">
          <Button size="sm" variant="secondary" icon={Plus} onClick={() => setShowAddItems(true)} className="flex-1">
            Add Items
          </Button>
          {items.length > 0 && (
            <Button size="sm" variant="secondary" icon={Users} onClick={openDutch} title="Dutch treat">
              Split
            </Button>
          )}
        </div>

        {items.length > 0 && (
          <Button icon={CreditCard} onClick={openCheckout} className="w-full">
            Checkout
          </Button>
        )}

        {order && (
          <ConfirmLock onConfirm={handleDeleteOrder} label="Hold to Delete Order" className="w-full justify-center" />
        )}
      </div>

      {/* Add items modal */}
      <Modal open={showAddItems} onClose={() => setShowAddItems(false)} title="Add Items" size="lg">
        <div className="flex gap-4 h-96">
          {/* Category list */}
          <div className="w-40 flex-shrink-0 border-r border-border-warm pr-3 overflow-y-auto">
            {categories.map((cat, i) => (
              <button key={i} onClick={() => setActiveCatIdx(i)}
                className={`w-full text-left px-3 py-3 rounded-xl text-sm font-semibold mb-0.5 transition-colors active:scale-95 ${activeCatIdx === i ? 'bg-brand text-white' : 'text-ink-muted hover:bg-gray-100 hover:text-ink'}`}>
                {cat.name}
              </button>
            ))}
          </div>
          {/* Items grid */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 gap-2">
              {(categories[activeCatIdx]?.items || []).map((item, idx) => (
                <button key={item.id ?? idx} onClick={() => handleAddMenuItem(item)}
                  disabled={item.sold_out}
                  className={`text-left p-4 border border-border-warm rounded-xl transition-all active:scale-95 ${item.sold_out ? 'opacity-50' : 'hover:border-brand hover:bg-brand-pale active:bg-brand-pale'}`}>
                  <p className="text-sm font-semibold text-ink leading-tight">{item.name}</p>
                  <p className="text-sm text-brand font-bold mt-1">{currency}{parseFloat(item.price).toFixed(2)}</p>
                  {item.sold_out && <p className="text-xs text-gray-400 mt-0.5">Sold out</p>}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Checkout modal */}
      <Modal open={showCheckout} onClose={() => { setShowCheckout(false); setAppliedDiscount(null) }} title={`Checkout — Table ${table?.name}`} size="md">
        {bill && (
          <div className="space-y-4">
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {bill.items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className={item.is_free ? 'line-through text-gray-400' : 'text-ink'}>{item.menu_item_name} ×{item.quantity}</span>
                  <span className="font-medium text-ink">{currency}{item.line_total.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-border-warm pt-3 space-y-1">
              <div className="flex justify-between text-sm text-ink-muted"><span>Subtotal</span><span>{currency}{bill.subtotal.toFixed(2)}</span></div>
              {bill.discount_total > 0 && <div className="flex justify-between text-sm text-green-600"><span>Discount</span><span>-{currency}{bill.discount_total.toFixed(2)}</span></div>}
              <div className="flex justify-between font-bold text-base text-ink pt-1"><span>Total</span><span className="text-brand">{currency}{bill.grand_total.toFixed(2)}</span></div>
            </div>
            <div className="flex gap-2">
              {['cash', 'card', 'other'].map((m) => (
                <button key={m} onClick={() => setPaymentMethod(m)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold capitalize ${paymentMethod === m ? 'bg-brand text-white' : 'bg-gray-100 text-ink-muted hover:bg-gray-200'}`}>{m}</button>
              ))}
            </div>
            <Button onClick={handleFinalize} loading={finalizing} className="w-full" size="lg">Confirm Payment</Button>
          </div>
        )}
      </Modal>

      {/* Dutch treat modal */}
      <Modal open={showDutch} onClose={() => setShowDutch(false)} title="Split Bill" size="sm">
        <div className="space-y-3">
          <p className="text-sm text-ink-muted">Select items and quantities for this person:</p>
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {items.filter((i) => !i.is_paid_partial && !i.is_free).map((item) => {
              const selectedQty = dutchSelected.get(item.id) || 0
              return (
                <div key={item.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink truncate">{item.menu_item_name}</p>
                    <p className="text-xs text-brand font-semibold">{currency}{item.unit_price.toFixed(2)} ea</p>
                  </div>
                  {/* Qty stepper */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => {
                        const next = new Map(dutchSelected)
                        const q = Math.max(0, (next.get(item.id) || 0) - 1)
                        if (q === 0) next.delete(item.id); else next.set(item.id, q)
                        setDutchSelected(next)
                        setDutchBill(null)
                      }}
                      className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200"
                    ><Minus size={10} /></button>
                    <span className="text-xs font-bold w-8 text-center">{selectedQty}/{item.quantity}</span>
                    <button
                      onClick={() => {
                        const next = new Map(dutchSelected)
                        const q = Math.min(item.quantity, (next.get(item.id) || 0) + 1)
                        next.set(item.id, q)
                        setDutchSelected(next)
                        setDutchBill(null)
                      }}
                      className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200"
                    ><Plus size={10} /></button>
                  </div>
                </div>
              )
            })}
          </div>
          {dutchSelected.size > 0 && (
            <Button onClick={calcDutchBill} variant="secondary" className="w-full" size="sm">Calculate</Button>
          )}
          {dutchBill !== null && (
            <div className="bg-surface-dark rounded-xl p-3 text-center">
              <p className="text-gray-400 text-xs">Amount to pay</p>
              <p className="text-white font-black text-2xl">{currency}{dutchBill.toFixed(2)}</p>
            </div>
          )}
          {dutchBill !== null && (
            <Button onClick={handleMarkDutchPaid} className="w-full">Mark as Paid</Button>
          )}
        </div>
      </Modal>
    </div>
  )
}
