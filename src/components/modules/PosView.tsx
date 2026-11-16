import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Printer,
  Edit2,
  History,
  ShoppingCart,
  MessageCircle,
} from 'lucide-react';
import { useBusiness } from '../../context/BusinessContext';
import { InvoiceLine, InvoiceType } from '../../types/business';
import {
  buildWhatsAppLink,
  computeMethodBalance,
  computePartyBalance,
  computeProductStats,
  todayISO,
} from '../../utils/calculations';

interface CartItem {
  productId: string;
  productName: string;
  description: string;
  qty: number;
  rate: number;
  costRate: number;
}

export const PosView: React.FC = () => {
  const {
    db,
    currentUser,
    tr,
    fmt,
    editingInvoiceId,
    setEditingInvoiceId,
    saveInvoice,
    deleteInvoice,
    checkMethodBalance,
    requestAdminAuth,
    requestFinancialConfirm,
    notify,
    setPrintPayload,
  } = useBusiness();

  const [subTab, setSubTab] = useState<'create' | 'history'>('create');
  const [mode, setMode] = useState<InvoiceType>('sale');
  const [date, setDate] = useState(todayISO());
  const [partyId, setPartyId] = useState('pty-walk-cust');
  const [prodSearch, setProdSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [showMargins, setShowMargins] = useState(true);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountType, setDiscountType] = useState<'percent' | 'flat'>('flat');
  const [discountValue, setDiscountValue] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [methodId, setMethodId] = useState(db.methods[0]?.id || '');
  const [note, setNote] = useState('');

  // History filter
  const [histSearch, setHistSearch] = useState('');
  const [histType, setHistType] = useState<'all' | 'sale' | 'purchase'>('all');

  const productStats = useMemo(
    () => computeProductStats(db.products, db.invoices, db.invLines),
    [db.products, db.invoices, db.invLines]
  );

  const categories = useMemo(
    () => db.attrs.filter((a) => a.type === 'category').map((a) => a.name),
    [db.attrs]
  );

  const partyOptions = useMemo(
    () =>
      db.parties.filter((p) =>
        mode === 'sale' ? p.type === 'customer' : p.type === 'supplier'
      ),
    [db.parties, mode]
  );

  // Sync default party when switching Sale <-> Purchase (unless editing)
  useEffect(() => {
    if (editingInvoiceId) return;
    const valid = partyOptions.some((p) => p.id === partyId);
    if (!valid && partyOptions.length > 0) {
      setPartyId(partyOptions[0].id);
    }
  }, [mode, partyOptions, partyId, editingInvoiceId]);

  // Load invoice into editor when editingInvoiceId changes
  useEffect(() => {
    if (!editingInvoiceId) return;
    const inv = db.invoices.find((i) => i.id === editingInvoiceId);
    if (!inv) return;
    const lines = db.invLines.filter((l) => l.invoiceId === inv.id);
    setSubTab('create');
    setMode(inv.type);
    setDate(inv.date);
    setPartyId(inv.partyId);
    setDiscountType(inv.discountType);
    setDiscountValue(inv.discountValue);
    setTaxPercent(inv.taxPercent);
    setPaidAmount(inv.paidAmount);
    setMethodId(inv.methodId);
    setNote(inv.note);
    setCart(
      lines.map((l) => ({
        productId: l.productId,
        productName: l.productName,
        description: l.description,
        qty: l.qty,
        rate: l.rate,
        costRate: l.costRate,
      }))
    );
  }, [editingInvoiceId, db.invoices, db.invLines]);

  const selectedParty = useMemo(
    () => db.parties.find((p) => p.id === partyId) || null,
    [db.parties, partyId]
  );

  // Previous due before this invoice
  const prevDue = useMemo(() => {
    if (!selectedParty || selectedParty.isWalking) return 0;
    const fullBal = computePartyBalance(selectedParty, db);
    if (editingInvoiceId) {
      const oldInv = db.invoices.find((i) => i.id === editingInvoiceId);
      if (oldInv && oldInv.partyId === selectedParty.id) {
        const oldNet = oldInv.subtotal - oldInv.discountAmount + oldInv.taxAmount;
        return Math.round((fullBal - (oldNet - oldInv.paidAmount)) * 100) / 100;
      }
    }
    return fullBal;
  }, [selectedParty, db, editingInvoiceId]);

  const filteredProducts = useMemo(() => {
    const q = prodSearch.trim().toLowerCase();
    return productStats.filter((s) => {
      if (catFilter && s.product.category !== catFilter) return false;
      if (
        q &&
        !s.product.name.toLowerCase().includes(q) &&
        !s.product.sku.toLowerCase().includes(q) &&
        !s.product.brand.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [productStats, prodSearch, catFilter]);

  const addToCart = (stat: (typeof productStats)[number]) => {
    const p = stat.product;
    if (mode === 'sale' && stat.currentStock <= 0) {
      notify('error', `${p.name}: ${tr('outOfStock')}`);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === p.id);
      if (existing) {
        return prev.map((c) =>
          c.productId === p.id ? { ...c, qty: c.qty + 1 } : c
        );
      }
      return [
        ...prev,
        {
          productId: p.id,
          productName: p.name,
          description: '',
          qty: 1,
          rate: mode === 'sale' ? p.sellPrice : p.buyPrice,
          costRate: p.buyPrice,
        },
      ];
    });
  };

  const subtotal = useMemo(
    () => cart.reduce((s, item) => s + item.qty * item.rate, 0),
    [cart]
  );

  const discountAmount = useMemo(() => {
    if (discountType === 'percent') {
      return Math.round(((subtotal * discountValue) / 100) * 100) / 100;
    }
    return Math.min(subtotal, discountValue || 0);
  }, [subtotal, discountType, discountValue]);

  const taxable = Math.max(0, subtotal - discountAmount);
  const taxAmount = Math.round(((taxable * (taxPercent || 0)) / 100) * 100) / 100;
  const invoiceNet = taxable + taxAmount;
  const grandTotal = Math.round((invoiceNet + prevDue) * 100) / 100;
  const currentDue = Math.round((grandTotal - (paidAmount || 0)) * 100) / 100;

  const estimatedProfit = useMemo(
    () =>
      cart.reduce(
        (s, item) => s + (item.rate - item.costRate) * item.qty,
        0
      ) - discountAmount,
    [cart, discountAmount]
  );

  // Enforce Walking full payment auto-fill convenience
  useEffect(() => {
    if (selectedParty?.isWalking && !editingInvoiceId) {
      setPaidAmount(Math.max(0, invoiceNet));
    }
  }, [selectedParty, invoiceNet, editingInvoiceId]);

  const resetForm = () => {
    setCart([]);
    setDiscountValue(0);
    setTaxPercent(0);
    setPaidAmount(0);
    setNote('');
    setEditingInvoiceId(null);
  };

  const handleCommit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      notify('error', tr('cart') + ' empty');
      return;
    }
    if (!selectedParty) return;

    // Walking full payment enforcement
    if (selectedParty.isWalking && Math.abs(paidAmount - invoiceNet) > 0.01) {
      notify('error', tr('walkingFullPayRule'));
      return;
    }

    // Strict stock check on sale
    if (mode === 'sale') {
      for (const item of cart) {
        const stat = productStats.find((s) => s.product.id === item.productId);
        let available = stat?.currentStock ?? 0;
        if (editingInvoiceId) {
          const prevLine = db.invLines.find(
            (l) =>
              l.invoiceId === editingInvoiceId &&
              l.productId === item.productId
          );
          if (prevLine) available += prevLine.qty;
        }
        if (item.qty > available) {
          notify('error', `${item.productName}: insufficient stock (${available})`);
          return;
        }
      }
    }

    // Strict balance check on purchase payout
    if (
      mode === 'purchase' &&
      paidAmount > 0 &&
      !checkMethodBalance(methodId, paidAmount, editingInvoiceId || undefined)
    ) {
      notify('error', tr('insufficientBalance'));
      return;
    }

    const isEdit = Boolean(editingInvoiceId);
    const existingInv = isEdit
      ? db.invoices.find((i) => i.id === editingInvoiceId)
      : null;

    const invoiceId = existingInv?.id || `inv-${Date.now()}`;
    const invoiceNo =
      existingInv?.invoiceNo ||
      `${mode === 'sale' ? 'SAL' : 'PUR'}-${new Date().getFullYear()}-${String(
        db.invoices.length + 1
      ).padStart(3, '0')}`;

    const invoiceObj = {
      id: invoiceId,
      invoiceNo,
      type: mode,
      date,
      partyId: selectedParty.id,
      partyName: selectedParty.name,
      subtotal,
      discountType,
      discountValue,
      discountAmount,
      taxPercent,
      taxAmount,
      prevDue,
      grandTotal,
      paidAmount: Number(paidAmount) || 0,
      methodId,
      dueAmount: currentDue,
      note: note.trim(),
      createdBy: existingInv?.createdBy || currentUser?.fullName || 'User',
      createdAt: existingInv?.createdAt || todayISO(),
    };

    const lineObjs: InvoiceLine[] = cart.map((c, idx) => ({
      id: `ln-${invoiceId}-${idx}`,
      invoiceId,
      productId: c.productId,
      productName: c.productName,
      description: c.description,
      qty: c.qty,
      rate: c.rate,
      costRate: mode === 'sale' ? c.costRate : c.rate,
      total: Math.round(c.qty * c.rate * 100) / 100,
    }));

    requestFinancialConfirm(
      {
        title: tr('confirmCommitTitle'),
        details: `${invoiceNo} · ${selectedParty.name} (${cart.length} items)`,
        amountLabel: `${tr('grandTotal')}: ${fmt(grandTotal)} · ${tr('paidAmount')}: ${fmt(paidAmount)}`,
      },
      () => {
        saveInvoice(invoiceObj, lineObjs, isEdit);
        resetForm();
        setPrintPayload({ kind: 'invoice', invoiceId });
      }
    );
  };

  const filteredHistory = useMemo(() => {
    const q = histSearch.trim().toLowerCase();
    return db.invoices
      .filter((i) => (histType === 'all' ? true : i.type === histType))
      .filter(
        (i) =>
          !q ||
          i.invoiceNo.toLowerCase().includes(q) ||
          i.partyName.toLowerCase().includes(q)
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [db.invoices, histSearch, histType]);

  return (
    <div className="space-y-5">
      {/* Top POS Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => {
              setSubTab('create');
              if (!editingInvoiceId) setMode('sale');
            }}
            className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              subTab === 'create' && mode === 'sale'
                ? 'bg-emerald-700 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            {tr('saleMode')}
          </button>
          <button
            type="button"
            onClick={() => {
              setSubTab('create');
              if (!editingInvoiceId) setMode('purchase');
            }}
            className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              subTab === 'create' && mode === 'purchase'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            {tr('purchaseMode')}
          </button>
          <button
            type="button"
            onClick={() => setSubTab('history')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              subTab === 'history'
                ? 'bg-emerald-700 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            {tr('invoiceHistory')} ({db.invoices.length})
          </button>
        </div>

        {subTab === 'create' && (
          <div className="flex items-center gap-2">
            {mode === 'sale' && (
              <button
                type="button"
                onClick={() => setShowMargins((s) => !s)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {showMargins ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5" />
                    {tr('hideMargins')}
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5" />
                    {tr('showMargins')}
                  </>
                )}
              </button>
            )}
            {editingInvoiceId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800"
              >
                {tr('cancel')} Edit
              </button>
            )}
          </div>
        )}
      </div>

      {subTab === 'create' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left: Product Catalog */}
          <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={prodSearch}
                  onChange={(e) => setProdSearch(e.target.value)}
                  placeholder={tr('searchProducts')}
                  className="w-full rounded-lg border border-slate-300 py-2 pl-8 pr-3 text-xs focus:border-emerald-600 focus:outline-none"
                />
              </div>
              <select
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs max-w-[130px]"
              >
                <option value="">{tr('all')}</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[540px] overflow-y-auto pr-1">
              {filteredProducts.map((stat) => {
                const p = stat.product;
                const price = mode === 'sale' ? p.sellPrice : p.buyPrice;
                const disabled = mode === 'sale' && stat.currentStock <= 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => addToCart(stat)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      disabled
                        ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                        : 'border-slate-200 bg-white hover:border-emerald-500 hover:bg-emerald-50/40'
                    }`}
                  >
                    <div className="font-semibold text-xs text-slate-900 line-clamp-1">
                      {p.name}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                      {p.sku} · {p.brand}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs font-mono tabular-nums">
                      <span className="font-bold text-emerald-700">
                        {fmt(price)}
                      </span>
                      <span
                        className={`text-[11px] font-medium ${
                          stat.currentStock <= 0
                            ? 'text-rose-600'
                            : stat.currentStock <= p.reorderLevel
                              ? 'text-amber-600'
                              : 'text-slate-500'
                        }`}
                      >
                        Stock: {stat.currentStock}
                      </span>
                    </div>
                    {mode === 'sale' && showMargins && (
                      <div className="mt-1 text-[10px] text-slate-400 font-mono">
                        Cost: {fmt(p.buyPrice)} · Margin: {fmt(p.sellPrice - p.buyPrice)}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Cart & Billing */}
          <form
            onSubmit={handleCommit}
            className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-5 space-y-4 text-xs"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  {tr('date')}
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-medium text-slate-700 mb-1">
                  {tr('selectParty')}
                </label>
                <select
                  value={partyId}
                  onChange={(e) => setPartyId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                >
                  {partyOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.isWalking ? `(${tr('walkingMode')})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Cart Table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                      <th className="py-2 px-3 text-left font-semibold">{tr('productName')}</th>
                      <th className="py-2 px-2 text-right font-semibold w-20">{tr('qty')}</th>
                      <th className="py-2 px-2 text-right font-semibold w-28">{tr('rate')}</th>
                      <th className="py-2 px-3 text-right font-semibold">{tr('amount')}</th>
                      <th className="py-2 px-2 w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cart.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          Click products on the left to add to {tr('cart')}
                        </td>
                      </tr>
                    ) : (
                      cart.map((item, idx) => (
                        <tr key={item.productId}>
                          <td className="py-2 px-3">
                            <div className="font-medium text-slate-900">
                              {item.productName}
                            </div>
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) =>
                                setCart((prev) =>
                                  prev.map((c, i) =>
                                    i === idx
                                      ? { ...c, description: e.target.value }
                                      : c
                                  )
                                )
                              }
                              placeholder={tr('description')}
                              className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-600"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              min={1}
                              value={item.qty}
                              onChange={(e) =>
                                setCart((prev) =>
                                  prev.map((c, i) =>
                                    i === idx
                                      ? { ...c, qty: Math.max(1, Number(e.target.value)) }
                                      : c
                                  )
                                )
                              }
                              className="w-full rounded border border-slate-300 px-2 py-1 text-right font-mono"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={item.rate}
                              onChange={(e) =>
                                setCart((prev) =>
                                  prev.map((c, i) =>
                                    i === idx
                                      ? { ...c, rate: Math.max(0, Number(e.target.value)) }
                                      : c
                                  )
                                )
                              }
                              className="w-full rounded border border-slate-300 px-2 py-1 text-right font-mono"
                            />
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold tabular-nums">
                            {fmt(item.qty * item.rate)}
                          </td>
                          <td className="py-2 px-2 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                setCart((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="rounded p-1 text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pricing & Payment Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      {tr('discount')}
                    </label>
                    <div className="flex">
                      <select
                        value={discountType}
                        onChange={(e) =>
                          setDiscountType(e.target.value as 'percent' | 'flat')
                        }
                        className="rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 px-2 py-2"
                      >
                        <option value="flat">Flat</option>
                        <option value="percent">%</option>
                      </select>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={discountValue}
                        onChange={(e) =>
                          setDiscountValue(Number(e.target.value))
                        }
                        className="w-full rounded-r-lg border border-slate-300 px-2.5 py-2 font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      {tr('tax')}
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={taxPercent}
                      onChange={(e) => setTaxPercent(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {tr('paymentMethod')}
                  </label>
                  <select
                    value={methodId}
                    onChange={(e) => setMethodId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                  >
                    {db.methods.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({fmt(computeMethodBalance(m.id, db))})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {tr('note')}
                  </label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                <div className="flex justify-between text-slate-600">
                  <span>{tr('subtotal')}</span>
                  <span className="font-mono tabular-nums">{fmt(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>{tr('discount')}</span>
                    <span className="font-mono tabular-nums">-{fmt(discountAmount)}</span>
                  </div>
                )}
                {taxAmount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>{tr('tax')}</span>
                    <span className="font-mono tabular-nums">+{fmt(taxAmount)}</span>
                  </div>
                )}
                {prevDue !== 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>{tr('prevDue')}</span>
                    <span className="font-mono tabular-nums">{fmt(prevDue)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900">
                  <span>{tr('grandTotal')}</span>
                  <span className="font-mono tabular-nums">{fmt(grandTotal)}</span>
                </div>

                <div className="pt-1">
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    {tr('paidAmount')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-right font-mono font-bold text-emerald-800"
                  />
                </div>

                <div className="flex justify-between pt-1 font-semibold">
                  <span>{tr('currentDue')}</span>
                  <span
                    className={`font-mono tabular-nums ${
                      currentDue > 0 ? 'text-rose-700' : 'text-emerald-700'
                    }`}
                  >
                    {fmt(currentDue)}
                  </span>
                </div>

                {mode === 'sale' && showMargins && cart.length > 0 && (
                  <div className="flex justify-between border-t border-slate-200 pt-1.5 text-[11px] text-emerald-700 font-medium">
                    <span>Est. {tr('profit')}</span>
                    <span className="font-mono tabular-nums">{fmt(estimatedProfit)}</span>
                  </div>
                )}
              </div>
            </div>

            {selectedParty?.isWalking && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                {tr('walkingFullPayRule')}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="submit"
                className="rounded-lg bg-emerald-700 px-6 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800"
              >
                {editingInvoiceId
                  ? tr('updateInvoice')
                  : mode === 'sale'
                    ? tr('completeSale')
                    : tr('completePurchase')}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Invoice History & Search */
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={histSearch}
                onChange={(e) => setHistSearch(e.target.value)}
                placeholder={tr('search')}
                className="w-full rounded-lg border border-slate-300 py-2 pl-8 pr-3 text-xs"
              />
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-0.5 text-xs">
              {(['all', 'sale', 'purchase'] as const).map((tp) => (
                <button
                  key={tp}
                  type="button"
                  onClick={() => setHistType(tp)}
                  className={`rounded-md px-3 py-1.5 font-medium ${
                    histType === tp
                      ? 'bg-emerald-700 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tp === 'all'
                    ? tr('all')
                    : tp === 'sale'
                      ? tr('saleMode')
                      : tr('purchaseMode')}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="py-3 px-4 text-left font-semibold">{tr('invoiceNo')}</th>
                    <th className="py-3 px-3 text-left font-semibold">{tr('date')}</th>
                    <th className="py-3 px-3 text-left font-semibold">{tr('partyName')}</th>
                    <th className="py-3 px-3 text-right font-semibold">{tr('grandTotal')}</th>
                    <th className="py-3 px-3 text-right font-semibold">{tr('paidAmount')}</th>
                    <th className="py-3 px-3 text-right font-semibold">{tr('currentDue')}</th>
                    <th className="py-3 px-4 text-right font-semibold">{tr('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHistory.map((inv) => {
                    const party = db.parties.find((p) => p.id === inv.partyId);
                    const waMsg = `${db.settings.companyName}\n${inv.invoiceNo} (${inv.date})\nTotal: ${fmt(inv.grandTotal)}\nPaid: ${fmt(inv.paidAmount)}\nDue: ${fmt(inv.dueAmount)}`;
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">
                          {inv.invoiceNo}
                          <div className="text-[10px] font-sans font-normal text-slate-500">
                            {inv.type === 'sale' ? tr('saleMode') : tr('purchaseMode')}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {inv.date}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-800">
                          {inv.partyName}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold">
                          {fmt(inv.grandTotal)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-700">
                          {fmt(inv.paidAmount)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-rose-700">
                          {fmt(inv.dueAmount)}
                        </td>
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setPrintPayload({
                                  kind: 'invoice',
                                  invoiceId: inv.id,
                                })
                              }
                              title={tr('testPrint')}
                              className="rounded-md p-1.5 text-slate-600 hover:bg-slate-200"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </button>
                            <a
                              href={buildWhatsAppLink(party?.phone || '', waMsg)}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={tr('whatsappShare')}
                              className="rounded-md p-1.5 text-emerald-700 hover:bg-emerald-50"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </a>
                            <button
                              type="button"
                              onClick={() =>
                                requestAdminAuth(() =>
                                  setEditingInvoiceId(inv.id)
                                )
                              }
                              title={tr('edit')}
                              className="rounded-md p-1.5 text-slate-600 hover:bg-slate-200"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                requestAdminAuth(() => deleteInvoice(inv.id))
                              }
                              title={tr('delete')}
                              className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
