import React, { useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Printer,
  Edit2,
  Trash2,
  FileSpreadsheet,
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { useBusiness } from '../../context/BusinessContext';
import { AttrType, Product } from '../../types/business';
import { computeProductStats, todayISO } from '../../utils/calculations';

export const InventoryView: React.FC = () => {
  const {
    db,
    tr,
    fmt,
    addAttr,
    upsertProduct,
    deleteProduct,
    requestAdminAuth,
    setPrintPayload,
  } = useBusiness();

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [colorFilter, setColorFilter] = useState('');
  const [sizeFilter, setSizeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'healthy' | 'low' | 'out'>('');

  // Product Form Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    sku: '',
    name: '',
    category: '',
    brand: '',
    color: '',
    size: '',
    buyPrice: 0,
    sellPrice: 0,
    openingStock: 0,
    reorderLevel: 5,
  });

  // Inline quick-add attribute input
  const [quickAttr, setQuickAttr] = useState<{ type: AttrType | null; val: string }>({
    type: null,
    val: '',
  });

  // Product Ledger Modal
  const [ledgerProductId, setLedgerProductId] = useState<string | null>(null);

  const stats = useMemo(
    () => computeProductStats(db.products, db.invoices, db.invLines),
    [db.products, db.invoices, db.invLines]
  );

  const attrsByType = (type: AttrType) =>
    db.attrs.filter((a) => a.type === type).map((a) => a.name);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stats.filter((s) => {
      const p = s.product;
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !p.sku.toLowerCase().includes(q) &&
        !p.brand.toLowerCase().includes(q)
      )
        return false;
      if (catFilter && p.category !== catFilter) return false;
      if (brandFilter && p.brand !== brandFilter) return false;
      if (colorFilter && p.color !== colorFilter) return false;
      if (sizeFilter && p.size !== sizeFilter) return false;
      if (statusFilter && s.status !== statusFilter) return false;
      return true;
    });
  }, [stats, search, catFilter, brandFilter, colorFilter, sizeFilter, statusFilter]);

  const totals = useMemo(() => {
    return {
      totalItems: filtered.length,
      totalUnits: filtered.reduce((s, r) => s + Math.max(0, r.currentStock), 0),
      totalStockValue: filtered.reduce((s, r) => s + r.stockValue, 0),
      totalProfit: filtered.reduce((s, r) => s + r.profit, 0),
    };
  }, [filtered]);

  const openAdd = () => {
    setEditingId(null);
    setForm({
      sku: `BP-${1000 + db.products.length + 1}`,
      name: '',
      category: attrsByType('category')[0] || '',
      brand: attrsByType('brand')[0] || '',
      color: attrsByType('color')[0] || '',
      size: attrsByType('size')[0] || '',
      buyPrice: 0,
      sellPrice: 0,
      openingStock: 0,
      reorderLevel: 5,
    });
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    requestAdminAuth(() => {
      setEditingId(p.id);
      setForm({
        sku: p.sku,
        name: p.name,
        category: p.category,
        brand: p.brand,
        color: p.color,
        size: p.size,
        buyPrice: p.buyPrice,
        sellPrice: p.sellPrice,
        openingStock: p.openingStock,
        reorderLevel: p.reorderLevel,
      });
      setModalOpen(true);
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const existing = db.products.find((p) => p.id === editingId);
    upsertProduct({
      id: editingId || `prd-${Date.now()}`,
      sku: form.sku.trim() || `BP-${Date.now().toString().slice(-4)}`,
      name: form.name.trim(),
      category: form.category,
      brand: form.brand,
      color: form.color,
      size: form.size,
      buyPrice: Number(form.buyPrice) || 0,
      sellPrice: Number(form.sellPrice) || 0,
      openingStock: Number(form.openingStock) || 0,
      reorderLevel: Number(form.reorderLevel) || 0,
      createdAt: existing?.createdAt || todayISO(),
    });
    setModalOpen(false);
  };

  const handleQuickAttrSave = () => {
    if (!quickAttr.type || !quickAttr.val.trim()) return;
    const val = quickAttr.val.trim();
    addAttr(quickAttr.type, val);
    setForm((prev) => ({ ...prev, [quickAttr.type!]: val }));
    setQuickAttr({ type: null, val: '' });
  };

  const ledgerData = useMemo(() => {
    if (!ledgerProductId) return null;
    const stat = stats.find((s) => s.product.id === ledgerProductId);
    if (!stat) return null;
    const invMap = new Map(db.invoices.map((i) => [i.id, i]));
    const rows = db.invLines
      .filter((l) => l.productId === ledgerProductId && invMap.has(l.invoiceId))
      .map((l) => {
        const inv = invMap.get(l.invoiceId)!;
        return {
          line: l,
          invoice: inv,
        };
      })
      .sort((a, b) => a.invoice.date.localeCompare(b.invoice.date));

    let running = stat.product.openingStock;
    const ledgerRows = rows.map((r) => {
      const qtyIn = r.invoice.type === 'purchase' ? r.line.qty : 0;
      const qtyOut = r.invoice.type === 'sale' ? r.line.qty : 0;
      running += qtyIn - qtyOut;
      const lineProfit =
        r.invoice.type === 'sale'
          ? (r.line.rate - r.line.costRate) * r.line.qty
          : 0;
      return { ...r, qtyIn, qtyOut, running, lineProfit };
    });

    return { stat, ledgerRows };
  }, [ledgerProductId, stats, db.invoices, db.invLines]);

  const handlePrintStock = () => {
    setPrintPayload({
      kind: 'report',
      title: tr('inventory'),
      subtitle: `${filtered.length} SKUs · ${todayISO()}`,
      summary: [
        { label: tr('productName'), value: String(totals.totalItems) },
        { label: tr('currentStock'), value: String(totals.totalUnits) },
        { label: tr('stockValue'), value: fmt(totals.totalStockValue) },
        { label: tr('profit'), value: fmt(totals.totalProfit) },
      ],
      columns: [
        { label: tr('sku') },
        { label: tr('productName') },
        { label: tr('category') },
        { label: tr('openingStock'), align: 'right' },
        { label: tr('purchased'), align: 'right' },
        { label: tr('sold'), align: 'right' },
        { label: tr('currentStock'), align: 'right' },
        { label: tr('stockValue'), align: 'right' },
      ],
      rows: filtered.map((s) => [
        s.product.sku,
        s.product.name,
        `${s.product.category} / ${s.product.brand}`,
        s.product.openingStock,
        s.purchasedQty,
        s.soldQty,
        s.currentStock,
        fmt(s.stockValue),
      ]),
    });
  };

  return (
    <div className="space-y-5">
      {/* Header & Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1 min-w-[260px]">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-[11px] text-slate-500">SKUs</div>
            <div className="text-base font-bold font-mono text-slate-900 tabular-nums">
              {totals.totalItems}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-[11px] text-slate-500">{tr('currentStock')}</div>
            <div className="text-base font-bold font-mono text-slate-900 tabular-nums">
              {totals.totalUnits}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-[11px] text-slate-500">{tr('stockValue')}</div>
            <div className="text-base font-bold font-mono text-emerald-700 tabular-nums">
              {fmt(totals.totalStockValue)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-[11px] text-slate-500">{tr('profit')}</div>
            <div className="text-base font-bold font-mono text-emerald-700 tabular-nums">
              {fmt(totals.totalProfit)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrintStock}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Printer className="h-3.5 w-3.5" />
            {tr('print')}
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            {tr('addProduct')}
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
        <div className="relative lg:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr('search')}
            className="w-full rounded-lg border border-slate-300 py-2 pl-8 pr-3 text-xs focus:border-emerald-600 focus:outline-none"
          />
        </div>

        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs"
        >
          <option value="">{tr('category')}: {tr('all')}</option>
          {attrsByType('category').map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs"
        >
          <option value="">{tr('brand')}: {tr('all')}</option>
          {attrsByType('brand').map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>

        <select
          value={colorFilter}
          onChange={(e) => setColorFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs"
        >
          <option value="">{tr('color')}: {tr('all')}</option>
          {attrsByType('color').map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as '' | 'healthy' | 'low' | 'out')}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs"
        >
          <option value="">{tr('status')}: {tr('all')}</option>
          <option value="healthy">{tr('healthy')}</option>
          <option value="low">{tr('lowStock')}</option>
          <option value="out">{tr('outOfStock')}</option>
        </select>
      </div>

      {/* Stock Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="py-3 px-4 text-left font-semibold">{tr('productName')}</th>
                <th className="py-3 px-3 text-left font-semibold">{tr('category')}</th>
                <th className="py-3 px-3 text-right font-semibold">{tr('buyPrice')}</th>
                <th className="py-3 px-3 text-right font-semibold">{tr('sellPrice')}</th>
                <th className="py-3 px-3 text-right font-semibold">{tr('openingStock')}</th>
                <th className="py-3 px-3 text-right font-semibold">{tr('purchased')}</th>
                <th className="py-3 px-3 text-right font-semibold">{tr('sold')}</th>
                <th className="py-3 px-3 text-right font-semibold">{tr('currentStock')}</th>
                <th className="py-3 px-3 text-right font-semibold">{tr('stockValue')}</th>
                <th className="py-3 px-3 text-right font-semibold">{tr('profit')}</th>
                <th className="py-3 px-3 text-left font-semibold">{tr('status')}</th>
                <th className="py-3 px-4 text-right font-semibold">{tr('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-10 text-center text-slate-400">
                    {tr('noData')}
                  </td>
                </tr>
              ) : (
                filtered.map((s) => {
                  const p = s.product;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-slate-900">{p.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {p.sku} · {p.color} · {p.size}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        <div>{p.category}</div>
                        <div className="text-[11px] text-slate-400">{p.brand}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                        {fmt(p.buyPrice)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-medium text-slate-900">
                        {fmt(p.sellPrice)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-500">
                        {p.openingStock}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                        +{s.purchasedQty}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                        -{s.soldQty}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                        {s.currentStock}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                        {fmt(s.stockValue)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-emerald-700">
                        {fmt(s.profit)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {s.status === 'healthy' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {tr('healthy')}
                          </span>
                        ) : s.status === 'low' ? (
                          <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {tr('lowStock')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-700 font-medium">
                            <XCircle className="h-3.5 w-3.5" />
                            {tr('outOfStock')}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setLedgerProductId(p.id)}
                            title={tr('productLedger')}
                            className="rounded-md p-1.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                          >
                            <FileSpreadsheet className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(p)}
                            title={tr('edit')}
                            className="rounded-md p-1.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              requestAdminAuth(() => deleteProduct(p.id))
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
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Product Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-base font-bold text-slate-900">
                {editingId ? tr('editProduct') : tr('addProduct')}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {tr('sku')}
                  </label>
                  <input
                    type="text"
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">
                    {tr('productName')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              {/* Dynamic Attributes with Inline + Quick Add */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(
                  [
                    ['category', tr('category')],
                    ['brand', tr('brand')],
                    ['color', tr('color')],
                    ['size', tr('size')],
                  ] as [AttrType, string][]
                ).map(([attrKey, label]) => (
                  <div key={attrKey}>
                    <label className="block font-medium text-slate-700 mb-1">
                      {label}
                    </label>
                    <div className="flex gap-1.5">
                      <select
                        value={form[attrKey as 'category' | 'brand' | 'color' | 'size']}
                        onChange={(e) =>
                          setForm({ ...form, [attrKey]: e.target.value })
                        }
                        className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-2"
                      >
                        <option value="">—</option>
                        {attrsByType(attrKey).map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setQuickAttr({ type: attrKey, val: '' })}
                        title={tr('quickAddAttr')}
                        className="rounded-lg border border-slate-300 px-2.5 text-slate-700 hover:bg-slate-100"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {quickAttr.type === attrKey && (
                      <div className="mt-1.5 flex gap-1.5">
                        <input
                          type="text"
                          autoFocus
                          value={quickAttr.val}
                          onChange={(e) =>
                            setQuickAttr({ ...quickAttr, val: e.target.value })
                          }
                          placeholder={`${tr('add')} ${label}`}
                          className="flex-1 rounded-lg border border-emerald-400 px-2.5 py-1.5 text-xs"
                        />
                        <button
                          type="button"
                          onClick={handleQuickAttrSave}
                          className="rounded-lg bg-emerald-700 px-2.5 py-1.5 text-white font-medium"
                        >
                          {tr('save')}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {tr('buyPrice')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={form.buyPrice}
                    onChange={(e) =>
                      setForm({ ...form, buyPrice: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {tr('sellPrice')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={form.sellPrice}
                    onChange={(e) =>
                      setForm({ ...form, sellPrice: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {tr('openingStock')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.openingStock}
                    onChange={(e) =>
                      setForm({ ...form, openingStock: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {tr('reorderLevel')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.reorderLevel}
                    onChange={(e) =>
                      setForm({ ...form, reorderLevel: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
                >
                  {tr('cancel')}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-700 px-5 py-2 font-semibold text-white hover:bg-emerald-800"
                >
                  {tr('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Ledger Modal */}
      {ledgerData && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {tr('productLedger')}: {ledgerData.stat.product.name}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {ledgerData.stat.product.sku} · {tr('openingStock')}:{' '}
                  {ledgerData.stat.product.openingStock} · {tr('currentStock')}:{' '}
                  {ledgerData.stat.currentStock}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLedgerProductId(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 text-left font-medium">{tr('date')}</th>
                    <th className="py-2 text-left font-medium">{tr('invoiceNo')}</th>
                    <th className="py-2 text-left font-medium">{tr('partyName')}</th>
                    <th className="py-2 text-right font-medium">{tr('purchased')}</th>
                    <th className="py-2 text-right font-medium">{tr('sold')}</th>
                    <th className="py-2 text-right font-medium">{tr('rate')}</th>
                    <th className="py-2 text-right font-medium">{tr('profit')}</th>
                    <th className="py-2 text-right font-medium">{tr('currentStock')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="bg-slate-50/60">
                    <td className="py-2 font-mono text-slate-500">
                      {ledgerData.stat.product.createdAt}
                    </td>
                    <td className="py-2 text-slate-500">—</td>
                    <td className="py-2 font-medium text-slate-700">
                      {tr('openingStock')}
                    </td>
                    <td className="py-2 text-right font-mono">—</td>
                    <td className="py-2 text-right font-mono">—</td>
                    <td className="py-2 text-right font-mono">
                      {fmt(ledgerData.stat.product.buyPrice)}
                    </td>
                    <td className="py-2 text-right font-mono">—</td>
                    <td className="py-2 text-right font-mono font-bold">
                      {ledgerData.stat.product.openingStock}
                    </td>
                  </tr>
                  {ledgerData.ledgerRows.map((row) => (
                    <tr key={row.line.id} className="hover:bg-slate-50">
                      <td className="py-2.5 font-mono text-slate-600">
                        {row.invoice.date}
                      </td>
                      <td className="py-2.5">
                        <button
                          type="button"
                          onClick={() =>
                            setPrintPayload({
                              kind: 'invoice',
                              invoiceId: row.invoice.id,
                            })
                          }
                          className="font-mono font-semibold text-emerald-700 hover:underline"
                        >
                          {row.invoice.invoiceNo}
                        </button>
                      </td>
                      <td className="py-2.5 text-slate-800">
                        {row.invoice.partyName}
                      </td>
                      <td className="py-2.5 text-right font-mono text-emerald-700">
                        {row.qtyIn > 0 ? `+${row.qtyIn}` : '—'}
                      </td>
                      <td className="py-2.5 text-right font-mono text-amber-700">
                        {row.qtyOut > 0 ? `-${row.qtyOut}` : '—'}
                      </td>
                      <td className="py-2.5 text-right font-mono">
                        {fmt(row.line.rate)}
                      </td>
                      <td className="py-2.5 text-right font-mono text-emerald-700">
                        {row.lineProfit !== 0 ? fmt(row.lineProfit) : '—'}
                      </td>
                      <td className="py-2.5 text-right font-mono font-bold text-slate-900">
                        {row.running}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
