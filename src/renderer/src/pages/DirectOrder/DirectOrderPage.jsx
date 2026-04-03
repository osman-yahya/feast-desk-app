import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ShoppingCart, Trash2, CreditCard, Plus, Minus, Tag, ChevronRight } from 'lucide-react'
import { Modal } from '../../components/ui/Modal.jsx'
import { Button } from '../../components/ui/Button.jsx'
import { useRestaurantStore } from '../../store/useRestaurantStore.js'
import { useOrderStore } from '../../store/useOrderStore.js'
import { useSettingsStore } from '../../store/useSettingsStore.js'
import { useToast } from '../../components/ui/Toast.jsx'

export function DirectOrderPage() {
  const { t } = useTranslation()
  const menu = useRestaurantStore((s) => s.menu)
  const { directOrder, directItems, createOrder, addItem, removeItem, updateItem, clearDirectOrder } = useOrderStore()
  const { discounts, settings } = useSettingsStore()
  const toast = useToast()

  const categories = menu?.content?.categories || []
  const [activeCatIdx, setActiveCatIdx] = useState(0)
  const [showCheckout, setShowCheckout] = useState(false)
  const [discountPct, setDiscountPct] = useState(0)
  const [manualDiscount, setManualDiscount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [checkoutNote, setCheckoutNote] = useState('')
  const [finalizing, setFinalizing] = useState(false)
  const [bill, setBill] = useState(null)

  useEffect(() => {
    setActiveCatIdx(0)
  }, [menu])

  const activeCategory = categories[activeCatIdx]
  const activeItems = activeCategory?.items || []
  const currency = settings?.currency_symbol || '₺'

  const effectiveDiscount = manualDiscount !== '' ? parseFloat(manualDiscount) || 0 : discountPct

  async function handleAddItem(menuItem) {
    if (menuItem.sold_out) return
    let order = directOrder
    if (!order) order = await createOrder(null)
    await addItem(order.id, {
      menu_item_id: String(menuItem.id),
      menu_item_name: menuItem.name,
      category_name: activeCategory?.name,
      unit_price: parseFloat(menuItem.price),
      quantity: 1
    }, null)
  }

  async function handleQtyChange(item, delta) {
    const newQty = item.quantity + delta
    if (newQty <= 0) {
      await removeItem(item.id, directOrder?.id, null)
    } else {
      await updateItem(item.id, { quantity: newQty }, null)
    }
  }

  async function openCheckout() {
    if (!directOrder || !directItems.length) return
    const b = await window.feastAPI.checkout.buildBill(directOrder.id, effectiveDiscount || undefined)
    setBill(b)
    setShowCheckout(true)
  }

  async function handleFinalize() {
    if (!directOrder) return
    setFinalizing(true)
    const result = await window.feastAPI.checkout.finalize(
      directOrder.id, paymentMethod, effectiveDiscount || undefined, checkoutNote || null
    )
    setFinalizing(false)
    if (result.success) {
      toast(t('directOrder.checkoutComplete', { currency, amount: result.checkout.grand_total.toFixed(2) }), 'success')
      setShowCheckout(false)
      clearDirectOrder()
      setBill(null)
      setDiscountPct(0)
      setManualDiscount('')
    } else {
      toast(result.error || t('directOrder.checkoutFailed'), 'error')
    }
  }

  const totalItems = directItems.reduce((s, i) => s + i.quantity, 0)
  const cartSubtotal = directItems.reduce((s, i) => s + (i.unit_price * i.quantity), 0)
  const discountAmount = cartSubtotal * effectiveDiscount / 100
  const grandTotal = cartSubtotal - discountAmount

  return (
    <div className="flex flex-1 min-h-0 -m-6">

      {/* ── Left: Category list ── */}
      <div className="w-44 flex-shrink-0 bg-white border-r border-border-warm flex flex-col h-full overflow-hidden">
        <div className="px-4 py-3 border-b border-border-warm flex-shrink-0">
          <h2 className="font-bold text-xs text-ink-muted uppercase tracking-wider">{t('directOrder.categories')}</h2>
        </div>
        <div className="flex-1 overflow-y-auto py-2 px-2">
          {categories.length === 0 ? (
            <p className="text-xs text-ink-muted px-2 py-4 text-center">{t('directOrder.noCategories')}</p>
          ) : (
            categories.map((cat, i) => (
              <button
                key={i}
                onClick={() => setActiveCatIdx(i)}
                className={`w-full text-left px-3 py-3 rounded-xl text-sm font-medium transition-all mb-0.5 flex items-center justify-between group active:scale-95 ${
                  activeCatIdx === i
                    ? 'bg-brand text-white'
                    : 'text-ink-muted hover:bg-gray-50 hover:text-ink'
                }`}
              >
                <span className="truncate">{cat.name}</span>
                <span className={`text-[10px] font-semibold ml-1 flex-shrink-0 ${activeCatIdx === i ? 'text-white/70' : 'text-gray-400'}`}>
                  {cat.items?.length || 0}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Center: Items grid ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Category title bar */}
        <div className="px-5 py-3 border-b border-border-warm bg-white flex-shrink-0 flex items-center gap-2">
          <h1 className="font-bold text-base text-ink">{activeCategory?.name || t('directOrder.selectCategory')}</h1>
          {activeItems.length > 0 && (
            <span className="text-xs text-ink-muted font-medium">{activeItems.length} {t('common.items')}</span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {activeItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <p className="text-sm text-ink-muted">{t('directOrder.noItems')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
              {activeItems.map((item) => {
                const inCart = directItems.find((i) => i.menu_item_name === item.name)
                return (
                  <button
                    key={item.id ?? item.name}
                    onClick={() => handleAddItem(item)}
                    disabled={item.sold_out}
                    className={`relative text-left p-4 bg-white border-2 rounded-2xl transition-all shadow-card hover:shadow-card-hover group ${
                      item.sold_out
                        ? 'opacity-40 cursor-not-allowed border-border-warm'
                        : inCart
                        ? 'border-brand bg-brand-pale'
                        : 'border-border-warm hover:border-brand'
                    }`}
                  >
                    {inCart && (
                      <span className="absolute top-2 right-2 w-5 h-5 bg-brand text-white text-[10px] font-black rounded-full flex items-center justify-center">
                        {inCart.quantity}
                      </span>
                    )}
                    <p className="font-semibold text-sm text-ink leading-snug pr-4">{item.name}</p>
                    {item.description && (
                      <p className="text-[11px] text-ink-muted mt-0.5 line-clamp-2">{item.description}</p>
                    )}
                    <p className={`font-bold text-sm mt-2 ${inCart ? 'text-brand' : 'text-brand'}`}>
                      {currency}{parseFloat(item.price).toFixed(2)}
                    </p>
                    {item.sold_out && (
                      <span className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-2xl text-xs font-bold text-gray-400">
                        {t('directOrder.soldOut')}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Cart ── */}
      <div className="w-72 flex-shrink-0 bg-white border-l border-border-warm flex flex-col h-full overflow-hidden">
        {/* Cart header */}
        <div className="px-4 py-3 border-b border-border-warm flex-shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart size={15} className="text-brand" />
            <span className="font-bold text-sm text-ink">{t('directOrder.order')}</span>
            {totalItems > 0 && (
              <span className="bg-brand text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </div>
          {directItems.length > 0 && (
            <button
              onClick={() => { clearDirectOrder(); toast(t('directOrder.orderCleared'), 'info') }}
              className="text-[11px] text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1"
            >
              <Trash2 size={11} /> {t('directOrder.clear')}
            </button>
          )}
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {directItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center py-8">
              <ShoppingCart size={28} className="text-gray-200" />
              <p className="text-xs text-ink-muted">{t('directOrder.tapToAdd')}</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {directItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2 py-2 border-b border-border-warm last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-ink truncate">{item.menu_item_name}</p>
                    <p className="text-xs text-brand font-bold">{currency}{(item.unit_price * item.quantity).toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleQtyChange(item, -1)}
                      className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200 transition-colors active:scale-95"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
                    <button
                      onClick={() => handleQtyChange(item, 1)}
                      className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200 transition-colors active:scale-95"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Discount + Totals + Checkout */}
        <div className="border-t border-border-warm px-3 py-3 space-y-3 flex-shrink-0">
          {/* Discount section — always visible */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Tag size={11} className="text-ink-muted" />
              <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">{t('common.discount')}</span>
            </div>

            {/* Predefined chips */}
            {discounts.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                <button
                  onClick={() => { setDiscountPct(0); setManualDiscount('') }}
                  className={`px-2 py-1 rounded-pill text-[11px] font-semibold transition-colors ${
                    effectiveDiscount === 0 ? 'bg-brand text-white' : 'bg-gray-100 text-ink-muted hover:bg-gray-200'
                  }`}
                >
                  {t('common.none')}
                </button>
                {discounts.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => { setDiscountPct(d.pct); setManualDiscount('') }}
                    className={`px-2 py-1 rounded-pill text-[11px] font-semibold transition-colors ${
                      discountPct === d.pct && manualDiscount === '' ? 'bg-brand text-white' : 'bg-gray-100 text-ink-muted hover:bg-gray-200'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            )}

            {/* Manual percentage input */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={manualDiscount}
                  onChange={(e) => {
                    setManualDiscount(e.target.value)
                    setDiscountPct(0)
                  }}
                  placeholder={discountPct > 0 ? `${discountPct}%` : '0%'}
                  className="w-full border border-border-warm rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-brand pr-7 text-center"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-muted font-semibold">%</span>
              </div>
              {(manualDiscount !== '' || discountPct > 0) && (
                <button
                  onClick={() => { setManualDiscount(''); setDiscountPct(0) }}
                  className="text-[11px] text-gray-400 hover:text-red-400"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Totals */}
          {directItems.length > 0 && (
            <div className="bg-surface-dark rounded-xl p-3 space-y-1">
              <div className="flex justify-between text-xs text-gray-400">
                <span>{t('common.subtotal')}</span><span>{currency}{cartSubtotal.toFixed(2)}</span>
              </div>
              {effectiveDiscount > 0 && (
                <div className="flex justify-between text-xs text-green-400">
                  <span>{t('common.discount')} {effectiveDiscount}%</span>
                  <span>-{currency}{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm text-white pt-1 border-t border-white/10">
                <span>{t('common.total')}</span><span>{currency}{grandTotal.toFixed(2)}</span>
              </div>
            </div>
          )}

          <Button
            onClick={openCheckout}
            disabled={!directItems.length}
            className="w-full"
            icon={CreditCard}
          >
            {t('directOrder.checkout')}
          </Button>
        </div>
      </div>

      {/* Checkout modal */}
      <Modal open={showCheckout} onClose={() => setShowCheckout(false)} title={t('directOrder.checkout')} size="md">
        {bill && (
          <div className="space-y-4">
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {bill.items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-ink">{item.menu_item_name} <span className="text-ink-muted">×{item.quantity}</span></span>
                  <span className={item.is_free ? 'line-through text-gray-400' : 'text-ink font-medium'}>
                    {currency}{item.line_total.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-border-warm pt-3 space-y-1.5">
              <div className="flex justify-between text-sm text-ink-muted"><span>{t('common.subtotal')}</span><span>{currency}{bill.subtotal.toFixed(2)}</span></div>
              {bill.discount_total > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>{t('common.discount')} ({effectiveDiscount}%)</span><span>-{currency}{bill.discount_total.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base text-ink pt-1 border-t border-border-warm">
                <span>{t('common.total')}</span><span className="text-brand">{currency}{bill.grand_total.toFixed(2)}</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-muted uppercase tracking-wide block mb-2">{t('common.payment')}</label>
              <div className="flex gap-2">
                {['cash', 'card', 'other'].map((m) => (
                  <button key={m} onClick={() => setPaymentMethod(m)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold capitalize transition-colors ${paymentMethod === m ? 'bg-brand text-white' : 'bg-gray-100 text-ink-muted hover:bg-gray-200'}`}
                  >{t(`common.${m}`)}</button>
                ))}
              </div>
            </div>
            <input
              value={checkoutNote}
              onChange={(e) => setCheckoutNote(e.target.value)}
              placeholder={t('directOrder.noteOptional')}
              className="w-full border border-border-warm rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand"
            />
            <Button onClick={handleFinalize} loading={finalizing} className="w-full" size="lg">
              {t('directOrder.confirmPayment')}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  )
}
