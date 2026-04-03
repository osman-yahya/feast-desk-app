import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Plus, Minus, CreditCard, Tag, Gift, Users, Trash2, SplitSquareVertical, Hash } from 'lucide-react'
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
  const { t } = useTranslation()

  const [showAddItems, setShowAddItems] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [showDutch, setShowDutch] = useState(false)
  const [showEqualSplit, setShowEqualSplit] = useState(false)
  const [activeCatIdx, setActiveCatIdx] = useState(0)
  const [discountPct, setDiscountPct] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [bill, setBill] = useState(null)
  const [appliedDiscount, setAppliedDiscount] = useState(null)
  const [finalizing, setFinalizing] = useState(false)
  const [cashierNote, setCashierNote] = useState('')
  const [dutchSelected, setDutchSelected] = useState(new Map())
  const [dutchBill, setDutchBill] = useState(null)
  const [splitCount, setSplitCount] = useState(2)

  const entry = tableOrders[tableId]
  const order = entry?.order
  const items = entry?.items || []
  const categories = menu?.content?.categories || []
  const currency = '₺'

  useEffect(() => {
    loadTableOrder(tableId)
    setActiveCatIdx(0)
  }, [tableId])

  // --- Helpers ---

  // Compute discounted price of a single item row
  function itemEffectiveTotal(item) {
    if (item.is_free) return 0
    const base = item.unit_price * item.quantity
    const pct = discountPct > 0 ? discountPct : (item.discount_pct || 0)
    return parseFloat((base * (1 - pct / 100)).toFixed(2))
  }

  const unpaidItems = items.filter((i) => !i.is_paid_partial)
  const paidItems = items.filter((i) => i.is_paid_partial)

  // Remaining total (after removing already-paid split amounts)
  const remainingTotal = unpaidItems.reduce((s, i) => s + itemEffectiveTotal(i), 0)
  const paidPartialTotal = paidItems.reduce((s, i) => {
    if (i.is_free) return s
    const base = i.unit_price * i.quantity
    const pct = discountPct > 0 ? discountPct : (i.discount_pct || 0)
    return s + parseFloat((base * (1 - pct / 100)).toFixed(2))
  }, 0)

  // --- Order actions ---

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

  // --- Checkout ---

  async function openCheckout() {
    if (!order || !items.length) return
    const pct = discountPct > 0 ? discountPct : null
    const b = await window.feastAPI.checkout.buildBill(order.id, pct)
    setBill(b)
    setAppliedDiscount(pct)
    setCashierNote('')
    setShowCheckout(true)
  }

  async function handleFinalize() {
    if (!order) return
    setFinalizing(true)
    const result = await window.feastAPI.checkout.finalize(order.id, paymentMethod, appliedDiscount, cashierNote || null)
    setFinalizing(false)
    if (result.success) {
      toast(t('tableDrawer.tablePaid', { name: table?.name, currency, amount: result.checkout.grand_total.toFixed(2) }), 'success')
      setShowCheckout(false)
      setAppliedDiscount(null)
      clearTableOrder(tableId)
      updateTableStatusLocally(tableId, 'empty')
      onClose()
    } else {
      toast(result.error || t('directOrder.checkoutFailed'), 'error')
    }
  }

  async function handleDeleteOrder() {
    if (!order) return
    await window.feastAPI.checkout.deleteOrder(order.id)
    clearTableOrder(tableId)
    updateTableStatusLocally(tableId, 'empty')
    toast(t('tableDrawer.orderDeleted'), 'info')
    onClose()
  }

  // --- Dutch treat (item-by-item split) ---

  function openDutch() {
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
    setDutchBill(Math.max(0, parseFloat(total.toFixed(2))))
  }

  async function handleMarkDutchPaid() {
    const fullItemIds = [...dutchSelected.entries()]
      .filter(([itemId, qty]) => {
        const item = items.find((i) => i.id === itemId)
        return item && qty >= item.quantity
      })
      .map(([itemId]) => itemId)
    if (fullItemIds.length) await window.feastAPI.checkout.markPartialPaid(fullItemIds)
    await loadTableOrder(tableId)
    toast(t('tableDrawer.partialPayment', { currency, amount: dutchBill?.toFixed(2) }), 'success')
    setShowDutch(false)
  }

  // --- Equal split ---

  function openEqualSplit() {
    setSplitCount(2)
    setShowEqualSplit(true)
  }

  const perPersonAmount = remainingTotal > 0 ? Math.max(0, parseFloat((remainingTotal / splitCount).toFixed(2))) : 0

  return (
    <div className="w-80 flex-shrink-0 bg-white border-l border-border-warm flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-warm flex-shrink-0">
        <div>
          <h2 className="font-bold text-sm text-ink">{t('tableDrawer.table', { name: table?.name })}</h2>
          <p className="text-xs text-ink-muted">{items.length} {t('common.items')}</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <X size={16} className="text-ink-muted" />
        </button>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-center">
            <p className="text-sm text-ink-muted">{t('tableDrawer.noItems')}</p>
            <Button size="sm" icon={Plus} onClick={() => setShowAddItems(true)}>{t('tableDrawer.addItems')}</Button>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className={`flex items-center gap-2 py-2 border-b border-border-warm last:border-0 ${item.is_paid_partial ? 'opacity-40' : ''}`}>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium truncate ${item.is_free ? 'line-through text-gray-400' : 'text-ink'}`}>
                  {item.menu_item_name}
                  {item.is_paid_partial && <span className="ml-1 text-blue-500 text-[10px]">PAID</span>}
                </p>
                <p className="text-xs text-brand font-semibold">
                  {item.is_free ? 'Free' : `${currency}${(item.unit_price * item.quantity).toFixed(2)}`}
                  {!item.is_free && (discountPct > 0 || item.discount_pct > 0) && !item.is_paid_partial && (
                    <span className="text-green-600 ml-1 text-[10px]">
                      -{discountPct > 0 ? discountPct : item.discount_pct}%
                    </span>
                  )}
                </p>
              </div>
              {!item.is_paid_partial && (
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
              )}
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
              {t('tableDrawer.noDiscount')}
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
          <div className="space-y-1 px-1">
            {paidPartialTotal > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-blue-500">{t('tableDrawer.alreadyPaid')}</span>
                <span className="text-[11px] text-blue-500 font-semibold">{currency}{paidPartialTotal.toFixed(2)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-ink-muted">
                {discountPct > 0 ? t('tableDrawer.remainingWithDiscount', { pct: discountPct }) : t('tableDrawer.remaining')}
              </span>
              <span className="font-bold text-sm text-brand">
                {currency}{Math.max(0, remainingTotal).toFixed(2)}
              </span>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button size="sm" variant="secondary" icon={Plus} onClick={() => setShowAddItems(true)} className="flex-1">
            {t('tableDrawer.addItems')}
          </Button>
          {items.length > 0 && (
            <>
              <Button size="sm" variant="secondary" icon={Users} onClick={openDutch} title="Split by items">
                {t('tableDrawer.split')}
              </Button>
              <Button size="sm" variant="secondary" icon={Hash} onClick={openEqualSplit} title="Split equally">
                ÷N
              </Button>
            </>
          )}
        </div>

        {items.length > 0 && (
          <Button icon={CreditCard} onClick={openCheckout} className="w-full">
            {t('tableDrawer.checkout')}
          </Button>
        )}

        {order && (
          <ConfirmLock onConfirm={handleDeleteOrder} label={t('tableDrawer.holdToDelete')} className="w-full justify-center" />
        )}
      </div>

      {/* Add items modal */}
      <Modal open={showAddItems} onClose={() => setShowAddItems(false)} title={t('tableDrawer.addItems')} size="lg">
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
                  {item.sold_out && <p className="text-xs text-gray-400 mt-0.5">{t('tableDrawer.soldOut')}</p>}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Checkout modal — expanded */}
      <Modal open={showCheckout} onClose={() => { setShowCheckout(false); setAppliedDiscount(null) }} title={t('tableDrawer.checkoutTable', { name: table?.name })} size="lg">
        {bill && (
          <div className="flex gap-6">
            {/* Left: item breakdown */}
            <div className="flex-1 min-w-0 space-y-4">
              <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wide">{t('tableDrawer.orderItems')}</h3>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-2">
                {bill.items.map((item) => (
                  <div key={item.id} className={`flex justify-between text-sm py-1.5 ${item.is_paid_partial ? 'opacity-40' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <span className={item.is_free ? 'line-through text-gray-400' : 'text-ink'}>
                        {item.menu_item_name}
                      </span>
                      <span className="text-ink-muted ml-1">×{item.quantity}</span>
                      {item.is_paid_partial && <span className="text-blue-500 text-[10px] ml-1">PAID</span>}
                      {item.applied_pct > 0 && !item.is_paid_partial && (
                        <span className="text-green-600 text-[10px] ml-1">-{item.applied_pct}%</span>
                      )}
                    </div>
                    <span className="font-medium text-ink ml-2 flex-shrink-0">{currency}{item.line_total.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Cashier note */}
              <div>
                <label className="text-xs text-ink-muted block mb-1">{t('directOrder.noteOptional')}</label>
                <input
                  type="text"
                  value={cashierNote}
                  onChange={(e) => setCashierNote(e.target.value)}
                  placeholder={t('tableDrawer.notePlaceholder')}
                  className="w-full border border-border-warm rounded-xl px-3 py-2 text-sm text-ink placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>
            </div>

            {/* Right: summary + payment */}
            <div className="w-56 flex-shrink-0 space-y-4">
              {/* Bill summary card */}
              <div className="bg-surface-dark rounded-2xl p-4 space-y-2">
                <div className="flex justify-between text-sm text-gray-400">
                  <span>{t('common.subtotal')}</span>
                  <span>{currency}{bill.subtotal.toFixed(2)}</span>
                </div>
                {bill.discount_total > 0 && (
                  <div className="flex justify-between text-sm text-green-400">
                    <span>{t('common.discount')}</span>
                    <span>-{currency}{bill.discount_total.toFixed(2)}</span>
                  </div>
                )}
                {paidPartialTotal > 0 && (
                  <div className="flex justify-between text-sm text-blue-400">
                    <span>{t('tableDrawer.paidSplit')}</span>
                    <span>-{currency}{paidPartialTotal.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-gray-700 pt-2">
                  <div className="flex justify-between font-bold text-lg text-white">
                    <span>{t('common.total')}</span>
                    <span>{currency}{bill.grand_total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Payment method */}
              <div>
                <p className="text-xs text-ink-muted mb-2">{t('tableDrawer.paymentMethod')}</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {['cash', 'card', 'other'].map((m) => (
                    <button key={m} onClick={() => setPaymentMethod(m)}
                      className={`py-2.5 rounded-xl text-sm font-semibold capitalize transition-all ${paymentMethod === m ? 'bg-brand text-white shadow-md scale-105' : 'bg-gray-100 text-ink-muted hover:bg-gray-200'}`}>
                      {t('common.' + m)}
                    </button>
                  ))}
                </div>
              </div>

              <Button onClick={handleFinalize} loading={finalizing} className="w-full" size="lg">
                {t('directOrder.confirmPayment')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Dutch treat modal (split by items) */}
      <Modal open={showDutch} onClose={() => setShowDutch(false)} title={t('tableDrawer.splitByItems')} size="md">
        <div className="space-y-3">
          <p className="text-sm text-ink-muted">{t('tableDrawer.selectItemsHint')}</p>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {unpaidItems.filter((i) => !i.is_free).map((item) => {
              const selectedQty = dutchSelected.get(item.id) || 0
              const pct = discountPct > 0 ? discountPct : (item.discount_pct || 0)
              const effectivePrice = item.unit_price * (1 - pct / 100)
              return (
                <div key={item.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink truncate">{item.menu_item_name}</p>
                    <p className="text-xs text-brand font-semibold">
                      {currency}{effectivePrice.toFixed(2)} ea
                      {pct > 0 && <span className="text-green-600 ml-1 text-[10px]">(-{pct}%)</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => {
                        const next = new Map(dutchSelected)
                        const q = Math.max(0, (next.get(item.id) || 0) - 1)
                        if (q === 0) next.delete(item.id); else next.set(item.id, q)
                        setDutchSelected(next)
                        setDutchBill(null)
                      }}
                      className="w-7 h-7 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200"
                    ><Minus size={12} /></button>
                    <span className="text-xs font-bold w-8 text-center">{selectedQty}/{item.quantity}</span>
                    <button
                      onClick={() => {
                        const next = new Map(dutchSelected)
                        const q = Math.min(item.quantity, (next.get(item.id) || 0) + 1)
                        next.set(item.id, q)
                        setDutchSelected(next)
                        setDutchBill(null)
                      }}
                      className="w-7 h-7 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200"
                    ><Plus size={12} /></button>
                  </div>
                </div>
              )
            })}
          </div>
          {dutchSelected.size > 0 && (
            <Button onClick={calcDutchBill} variant="secondary" className="w-full" size="sm">{t('tableDrawer.calculate')}</Button>
          )}
          {dutchBill !== null && (
            <div className="bg-surface-dark rounded-xl p-4 text-center">
              <p className="text-gray-400 text-xs">{t('tableDrawer.thisPersonPays')}</p>
              <p className="text-white font-black text-2xl">{currency}{dutchBill.toFixed(2)}</p>
            </div>
          )}
          {dutchBill !== null && (
            <Button onClick={handleMarkDutchPaid} className="w-full">{t('tableDrawer.markAsPaid')}</Button>
          )}
        </div>
      </Modal>

      {/* Equal split modal */}
      <Modal open={showEqualSplit} onClose={() => setShowEqualSplit(false)} title={t('tableDrawer.splitEqually')} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">{t('tableDrawer.divideHint')}</p>

          {/* Total being split */}
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xs text-ink-muted">{t('tableDrawer.remainingTotal')}</p>
            <p className="text-lg font-bold text-ink">{currency}{Math.max(0, remainingTotal).toFixed(2)}</p>
          </div>

          {/* Person count selector */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setSplitCount((c) => Math.max(2, c - 1))}
              className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200 active:scale-95 transition-all"
            >
              <Minus size={16} />
            </button>
            <div className="text-center">
              <p className="text-3xl font-black text-ink">{splitCount}</p>
              <p className="text-xs text-ink-muted">{t('common.people')}</p>
            </div>
            <button
              onClick={() => setSplitCount((c) => Math.min(20, c + 1))}
              className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200 active:scale-95 transition-all"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Quick presets */}
          <div className="flex justify-center gap-2">
            {[2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                onClick={() => setSplitCount(n)}
                className={`w-9 h-9 rounded-full text-sm font-bold transition-all ${splitCount === n ? 'bg-brand text-white scale-110' : 'bg-gray-100 text-ink-muted hover:bg-gray-200'}`}
              >
                {n}
              </button>
            ))}
          </div>

          {/* Per person result */}
          <div className="bg-surface-dark rounded-2xl p-4 text-center">
            <p className="text-gray-400 text-xs">{t('tableDrawer.perPerson')}</p>
            <p className="text-white font-black text-3xl">{currency}{perPersonAmount.toFixed(2)}</p>
            <p className="text-gray-500 text-[11px] mt-1">
              {currency}{perPersonAmount.toFixed(2)} × {splitCount} = {currency}{(perPersonAmount * splitCount).toFixed(2)}
              {parseFloat((perPersonAmount * splitCount).toFixed(2)) !== parseFloat(Math.max(0, remainingTotal).toFixed(2)) && (
                <span className="text-amber-400 ml-1">
                  {t('tableDrawer.rounding', { currency, amount: Math.abs(remainingTotal - perPersonAmount * splitCount).toFixed(2) })}
                </span>
              )}
            </p>
          </div>

          <Button onClick={() => setShowEqualSplit(false)} variant="secondary" className="w-full">{t('common.done')}</Button>
        </div>
      </Modal>
    </div>
  )
}
