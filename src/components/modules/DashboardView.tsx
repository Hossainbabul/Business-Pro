import React, { useMemo, useState } from 'react';
import {
  ShoppingBag,
  ShoppingCart,
  CreditCard,
  Receipt,
  TrendingUp,
  Landmark,
  Package,
  BookOpen,
  AlertTriangle,
  Printer,
  X,
} from 'lucide-react';
import { useBusiness } from '../../context/BusinessContext';
import {
  computeCashbookEntries,
  computeCombinedBalance,
  computeMethodBalance,
  computePartyBalance,
  computeProductStats,
  daysAgoISO,
  todayISO,
} from '../../utils/calculations';
import {
  DonutChart,
  FourteenDayTrendChart,
  SixMonthBarChart,
} from '../common/SvgCharts';

type PeriodFilter = 'day' | 'month' | 'year' | 'all' | 'custom';

export const DashboardView: React.FC = () => {
  const {
    db,
    tr,
    fmt,
    setActiveModule,
    hasPermission,
    setPrintPayload,
  } = useBusiness();

  const today = todayISO();
  const [period, setPeriod] = useState<PeriodFilter>('month');
  const [customFrom, setCustomFrom] = useState(daysAgoISO(30));
  const [customTo, setCustomTo] = useState(today);

  // Cashbook modal state
  const [cashbookOpen, setCashbookOpen] = useState(false);
  const [cashbookMode, setCashbookMode] = useState<'daily' | 'monthly'>('daily');
  const [cashbookDate, setCashbookDate] = useState(today);
  const [cashbookMonth, setCashbookMonth] = useState(today.slice(0, 7));

  const inRange = (dateStr: string) => {
    if (period === 'all') return true;
    if (period === 'day') return dateStr === today;
    if (period === 'month') return dateStr.slice(0, 7) === today.slice(0, 7);
    if (period === 'year') return dateStr.slice(0, 4) === today.slice(0, 4);
    return dateStr >= customFrom && dateStr <= customTo;
  };

  // Top Summary Metrics
  const combinedBalance = useMemo(() => computeCombinedBalance(db), [db]);

  const todaySales = useMemo(
    () =>
      db.invoices
        .filter((i) => i.type === 'sale' && i.date === today)
        .reduce((s, i) => s + (i.subtotal - i.discountAmount + i.taxAmount), 0),
    [db.invoices, today]
  );

  const todayExpense = useMemo(
    () =>
      db.expenses
        .filter((e) => e.date === today)
        .reduce((s, e) => s + e.amount, 0),
    [db.expenses, today]
  );

  const partyBalances = useMemo(() => {
    return db.parties.map((p) => ({
      party: p,
      balance: computePartyBalance(p, db),
    }));
  }, [db]);

  const totalReceivable = useMemo(
    () =>
      partyBalances
        .filter((x) => x.party.type === 'customer' && x.balance > 0)
        .reduce((s, x) => s + x.balance, 0),
    [partyBalances]
  );

  const totalPayable = useMemo(
    () =>
      partyBalances
        .filter((x) => x.party.type === 'supplier' && x.balance > 0)
        .reduce((s, x) => s + x.balance, 0),
    [partyBalances]
  );

  // Period Analytics
  const periodMetrics = useMemo(() => {
    const periodInvoices = db.invoices.filter((i) => inRange(i.date));
    const saleInvs = periodInvoices.filter((i) => i.type === 'sale');
    const purInvs = periodInvoices.filter((i) => i.type === 'purchase');

    const totalSales = saleInvs.reduce(
      (s, i) => s + (i.subtotal - i.discountAmount + i.taxAmount),
      0
    );
    const totalPurchase = purInvs.reduce(
      (s, i) => s + (i.subtotal - i.discountAmount + i.taxAmount),
      0
    );

    const saleIds = new Set(saleInvs.map((i) => i.id));
    const grossProfitFromLines = db.invLines
      .filter((l) => saleIds.has(l.invoiceId))
      .reduce((s, l) => s + (l.rate - l.costRate) * l.qty, 0);
    const saleDiscounts = saleInvs.reduce((s, i) => s + i.discountAmount, 0);

    const totalExpense = db.expenses
      .filter((e) => inRange(e.date))
      .reduce((s, e) => s + e.amount, 0);

    const netProfit = grossProfitFromLines - saleDiscounts - totalExpense;

    const cashEntries = computeCashbookEntries(db).filter((c) =>
      inRange(c.date)
    );
    const cashIn = cashEntries.reduce((s, c) => s + c.cashIn, 0);
    const cashOut = cashEntries.reduce((s, c) => s + c.cashOut, 0);

    return {
      totalSales,
      totalPurchase,
      netProfit,
      totalExpense,
      cashIn,
      cashOut,
    };
  }, [db, period, customFrom, customTo]);

  // 6-Month Chart Data
  const sixMonthData = useMemo(() => {
    const months: { ym: string; label: string }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en-US', { month: 'short' });
      months.push({ ym, label });
    }

    return months.map(({ ym, label }) => {
      const salesInvs = db.invoices.filter(
        (inv) => inv.type === 'sale' && inv.date.startsWith(ym)
      );
      const purInvs = db.invoices.filter(
        (inv) => inv.type === 'purchase' && inv.date.startsWith(ym)
      );
      const sales = salesInvs.reduce(
        (s, i) => s + (i.subtotal - i.discountAmount + i.taxAmount),
        0
      );
      const purchase = purInvs.reduce(
        (s, i) => s + (i.subtotal - i.discountAmount + i.taxAmount),
        0
      );
      const ids = new Set(salesInvs.map((i) => i.id));
      const gross = db.invLines
        .filter((l) => ids.has(l.invoiceId))
        .reduce((s, l) => s + (l.rate - l.costRate) * l.qty, 0);
      const disc = salesInvs.reduce((s, i) => s + i.discountAmount, 0);
      const exp = db.expenses
        .filter((e) => e.date.startsWith(ym))
        .reduce((s, e) => s + e.amount, 0);

      return { label, sales, purchase, profit: gross - disc - exp };
    });
  }, [db.invoices, db.invLines, db.expenses]);

  // 14-Day Trend
  const fourteenDayData = useMemo(() => {
    const arr: { label: string; sales: number; expense: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const iso = daysAgoISO(i);
      const sales = db.invoices
        .filter((inv) => inv.type === 'sale' && inv.date === iso)
        .reduce((s, inv) => s + (inv.subtotal - inv.discountAmount + inv.taxAmount), 0);
      const expense = db.expenses
        .filter((e) => e.date === iso)
        .reduce((s, e) => s + e.amount, 0);
      arr.push({ label: iso.slice(5), sales, expense });
    }
    return arr;
  }, [db.invoices, db.expenses]);

  // Donuts
  const expenseSlices = useMemo(() => {
    const palette = ['#059669', '#0f172a', '#d97706', '#0ea5e9', '#8b5cf6'];
    const map = new Map<string, number>();
    db.expenses
      .filter((e) => inRange(e.date))
      .forEach((e) => {
        map.set(e.category, (map.get(e.category) || 0) + e.amount);
      });
    return Array.from(map.entries()).map(([label, value], idx) => ({
      label,
      value,
      color: palette[idx % palette.length],
    }));
  }, [db.expenses, period, customFrom, customTo]);

  const methodSlices = useMemo(() => {
    const palette = ['#059669', '#0284c7', '#334155', '#d97706'];
    return db.methods.map((m, idx) => ({
      label: m.name,
      value: Math.max(0, computeMethodBalance(m.id, db)),
      color: palette[idx % palette.length],
    }));
  }, [db]);

  const productStats = useMemo(
    () => computeProductStats(db.products, db.invoices, db.invLines),
    [db.products, db.invoices, db.invLines]
  );

  const stockHealthSlices = useMemo(() => {
    const healthy = productStats.filter((p) => p.status === 'healthy').length;
    const low = productStats.filter((p) => p.status === 'low').length;
    const out = productStats.filter((p) => p.status === 'out').length;
    return [
      { label: tr('healthy'), value: healthy, color: '#16a34a' },
      { label: tr('lowStock'), value: low, color: '#d97706' },
      { label: tr('outOfStock'), value: out, color: '#dc2626' },
    ];
  }, [productStats, db.settings.language]);

  const recPaySlices = useMemo(
    () => [
      { label: tr('totalReceivable'), value: totalReceivable, color: '#059669' },
      { label: tr('totalPayable'), value: totalPayable, color: '#dc2626' },
    ],
    [totalReceivable, totalPayable, db.settings.language]
  );

  // Lists
  const top5Products = useMemo(
    () =>
      [...productStats]
        .sort((a, b) => b.salesRevenue - a.salesRevenue)
        .slice(0, 5),
    [productStats]
  );

  const lowStockItems = useMemo(
    () => productStats.filter((p) => p.status === 'low' || p.status === 'out'),
    [productStats]
  );

  const duesList = useMemo(
    () =>
      partyBalances
        .filter((x) => Math.abs(x.balance) > 0.5)
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 6),
    [partyBalances]
  );

  // Loan & Investment Summary
  const loanInvestSummary = useMemo(() => {
    const givenTotal = db.loans
      .filter((l) => l.direction === 'given')
      .reduce((s, l) => s + l.principal, 0);
    const givenRepaid = db.payments
      .filter((p) => p.category === 'loan_given')
      .reduce((s, p) => s + p.amount, 0);
    const takenTotal = db.loans
      .filter((l) => l.direction === 'taken')
      .reduce((s, l) => s + l.principal, 0);
    const takenRepaid = db.payments
      .filter((p) => p.category === 'loan_taken')
      .reduce((s, p) => s + p.amount, 0);
    const totalCapital = db.investments.reduce((s, i) => s + i.capitalAmount, 0);
    const returnsPaid = db.payments
      .filter((p) => p.category === 'investment')
      .reduce((s, p) => s + p.amount, 0);

    return {
      givenRemaining: Math.max(0, givenTotal - givenRepaid),
      takenRemaining: Math.max(0, takenTotal - takenRepaid),
      totalCapital,
      returnsPaid,
    };
  }, [db.loans, db.payments, db.investments]);

  // Cashbook computation
  const cashbookData = useMemo(() => {
    const all = computeCashbookEntries(db);
    const filterKey = cashbookMode === 'daily' ? cashbookDate : cashbookMonth;
    const before = all.filter((r) =>
      cashbookMode === 'daily' ? r.date < filterKey : r.date.slice(0, 7) < filterKey
    );
    const current = all.filter((r) =>
      cashbookMode === 'daily'
        ? r.date === filterKey
        : r.date.slice(0, 7) === filterKey
    );

    const methodsOpening = db.methods.reduce((s, m) => s + m.openingBalance, 0);
    const opening =
      methodsOpening +
      before.reduce((s, r) => s + r.cashIn - r.cashOut, 0);
    const totalIn = current.reduce((s, r) => s + r.cashIn, 0);
    const totalOut = current.reduce((s, r) => s + r.cashOut, 0);
    const closing = opening + totalIn - totalOut;

    return { opening, totalIn, totalOut, closing, rows: current };
  }, [db, cashbookMode, cashbookDate, cashbookMonth]);

  const quickActions = [
    { label: tr('newSale'), icon: ShoppingCart, show: hasPermission('pos'), onClick: () => setActiveModule('pos') },
    { label: tr('newPurchase'), icon: ShoppingBag, show: hasPermission('pos'), onClick: () => setActiveModule('pos') },
    { label: tr('recordPayment'), icon: CreditCard, show: hasPermission('parties'), onClick: () => setActiveModule('parties') },
    { label: tr('addExpense'), icon: Receipt, show: hasPermission('expense'), onClick: () => setActiveModule('expense') },
    { label: tr('addInvestment'), icon: TrendingUp, show: hasPermission('investment'), onClick: () => setActiveModule('investment') },
    { label: tr('addLoan'), icon: Landmark, show: hasPermission('loan'), onClick: () => setActiveModule('loan') },
    { label: tr('openInventory'), icon: Package, show: hasPermission('inventory'), onClick: () => setActiveModule('inventory') },
    { label: tr('openCashbook'), icon: BookOpen, show: true, onClick: () => setCashbookOpen(true) },
  ].filter((a) => a.show);

  return (
    <div className="space-y-6">
      {/* Top Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="sm:col-span-2 lg:col-span-1 rounded-xl border border-emerald-200 bg-emerald-900 p-4 text-white">
          <div className="text-xs font-medium text-emerald-200">
            {tr('combinedBalance')}
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums">
            {fmt(combinedBalance)}
          </div>
          <div className="mt-2 text-[11px] text-emerald-200/90">
            {db.methods.length} {tr('methods')}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">
            {tr('todaySales')}
          </div>
          <div className="mt-2 text-xl font-bold font-mono text-slate-900 tabular-nums">
            {fmt(todaySales)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">
            {tr('todayExpense')}
          </div>
          <div className="mt-2 text-xl font-bold font-mono text-amber-700 tabular-nums">
            {fmt(todayExpense)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">
            {tr('totalReceivable')}
          </div>
          <div className="mt-2 text-xl font-bold font-mono text-emerald-700 tabular-nums">
            {fmt(totalReceivable)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">
            {tr('totalPayable')}
          </div>
          <div className="mt-2 text-xl font-bold font-mono text-rose-700 tabular-nums">
            {fmt(totalPayable)}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-xs font-semibold text-slate-500 mb-3">
          {tr('quickActions')}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {quickActions.map((act) => {
            const Icon = act.icon;
            return (
              <button
                key={act.label}
                type="button"
                onClick={act.onClick}
                className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-3 text-xs font-medium text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-900 transition-colors"
              >
                <Icon className="h-4 w-4 text-emerald-700" />
                <span className="truncate max-w-full">{act.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Period Filter & Analytics KPIs */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
            {(
              [
                ['day', tr('day')],
                ['month', tr('month')],
                ['year', tr('year')],
                ['all', tr('allTime')],
                ['custom', tr('customRange')],
              ] as [PeriodFilter, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setPeriod(id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  period === id
                    ? 'bg-emerald-700 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {period === 'custom' && (
            <div className="flex items-center gap-2 text-xs">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
              />
              <span className="text-slate-400">→</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">{tr('totalSales')}</div>
            <div className="mt-1.5 text-lg font-bold font-mono text-slate-900 tabular-nums">
              {fmt(periodMetrics.totalSales)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">{tr('totalPurchase')}</div>
            <div className="mt-1.5 text-lg font-bold font-mono text-slate-900 tabular-nums">
              {fmt(periodMetrics.totalPurchase)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">{tr('netProfit')}</div>
            <div
              className={`mt-1.5 text-lg font-bold font-mono tabular-nums ${
                periodMetrics.netProfit >= 0
                  ? 'text-emerald-700'
                  : 'text-rose-700'
              }`}
            >
              {fmt(periodMetrics.netProfit)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">{tr('totalExpense')}</div>
            <div className="mt-1.5 text-lg font-bold font-mono text-amber-700 tabular-nums">
              {fmt(periodMetrics.totalExpense)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">{tr('netCashFlow')}</div>
            <div className="mt-1.5 flex items-baseline justify-between gap-2 font-mono text-xs tabular-nums">
              <span className="text-emerald-700">
                +{fmt(periodMetrics.cashIn)}
              </span>
              <span className="text-rose-700">
                -{fmt(periodMetrics.cashOut)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            {tr('sixMonthPerformance')}
          </h3>
          <SixMonthBarChart
            data={sixMonthData}
            formatVal={fmt}
            labels={{
              sales: tr('totalSales'),
              purchase: tr('totalPurchase'),
              profit: tr('profit'),
            }}
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            {tr('fourteenDayTrend')}
          </h3>
          <FourteenDayTrendChart
            data={fourteenDayData}
            formatVal={fmt}
            labels={{
              sales: tr('totalSales'),
              expense: tr('expense'),
            }}
          />
        </div>
      </div>

      {/* 4 Donut Charts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <DonutChart
          title={tr('expenseByCategory')}
          slices={expenseSlices}
          formatVal={fmt}
        />
        <DonutChart
          title={tr('balanceByMethod')}
          slices={methodSlices}
          formatVal={fmt}
        />
        <DonutChart
          title={tr('stockHealth')}
          slices={stockHealthSlices}
          centerLabel={`${db.products.length} SKU`}
          formatVal={(v) => String(v)}
        />
        <DonutChart
          title={tr('receivableVsPayable')}
          slices={recPaySlices}
          formatVal={fmt}
        />
      </div>

      {/* Bottom Alerts & Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Selling Products */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            {tr('topSellingProducts')}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 text-left font-medium">{tr('productName')}</th>
                  <th className="py-2 text-right font-medium">{tr('sold')}</th>
                  <th className="py-2 text-right font-medium">{tr('totalSales')}</th>
                  <th className="py-2 text-right font-medium">{tr('profit')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {top5Products.map((item) => (
                  <tr key={item.product.id}>
                    <td className="py-2.5 font-medium text-slate-800">
                      {item.product.name}
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums">
                      {item.soldQty}
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums">
                      {fmt(item.salesRevenue)}
                    </td>
                    <td className="py-2.5 text-right font-mono text-emerald-700 font-semibold tabular-nums">
                      {fmt(item.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Customer & Supplier Dues */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            {tr('partyDuesList')}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 text-left font-medium">{tr('partyName')}</th>
                  <th className="py-2 text-left font-medium">{tr('status')}</th>
                  <th className="py-2 text-right font-medium">{tr('amount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {duesList.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-slate-400">
                      {tr('noData')}
                    </td>
                  </tr>
                ) : (
                  duesList.map(({ party, balance }) => (
                    <tr key={party.id}>
                      <td className="py-2.5 font-medium text-slate-800">
                        {party.name}
                      </td>
                      <td className="py-2.5 text-slate-500">
                        {party.type === 'customer'
                          ? `${tr('customers')} · ${balance > 0 ? tr('due') : tr('advance')}`
                          : `${tr('suppliers')} · ${balance > 0 ? tr('due') : tr('advance')}`}
                      </td>
                      <td
                        className={`py-2.5 text-right font-mono font-semibold tabular-nums ${
                          party.type === 'customer'
                            ? 'text-emerald-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {fmt(Math.abs(balance))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            {tr('lowStockAlerts')}
          </h3>
          {lowStockItems.length === 0 ? (
            <p className="text-xs text-slate-400 py-4">{tr('healthy')}</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {lowStockItems.map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-center justify-between py-2.5 text-xs"
                >
                  <div>
                    <div className="font-medium text-slate-800">
                      {item.product.name}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {item.product.sku} · {tr('reorderLevel')}:{' '}
                      {item.product.reorderLevel}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 font-mono tabular-nums">
                    <AlertTriangle
                      className={`h-3.5 w-3.5 ${
                        item.status === 'out'
                          ? 'text-rose-600'
                          : 'text-amber-600'
                      }`}
                    />
                    <span
                      className={`font-semibold ${
                        item.status === 'out'
                          ? 'text-rose-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {item.currentStock} ({item.status === 'out' ? tr('outOfStock') : tr('lowStock')})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Loan & Investment Summary */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            {tr('loanInvestSummary')}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] text-slate-500">
                {tr('loansGiven')}
              </div>
              <div className="mt-1 text-sm font-bold font-mono text-emerald-700 tabular-nums">
                {fmt(loanInvestSummary.givenRemaining)}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] text-slate-500">
                {tr('loansTaken')}
              </div>
              <div className="mt-1 text-sm font-bold font-mono text-rose-700 tabular-nums">
                {fmt(loanInvestSummary.takenRemaining)}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] text-slate-500">
                {tr('capitalReceived')}
              </div>
              <div className="mt-1 text-sm font-bold font-mono text-slate-900 tabular-nums">
                {fmt(loanInvestSummary.totalCapital)}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] text-slate-500">
                {tr('returnsPaid')}
              </div>
              <div className="mt-1 text-sm font-bold font-mono text-amber-700 tabular-nums">
                {fmt(loanInvestSummary.returnsPaid)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cashbook Modal */}
      {cashbookOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {tr('cashbook')}
                </h3>
                <p className="text-xs text-slate-500">
                  {cashbookMode === 'daily'
                    ? `${tr('dailyCashbook')} · ${cashbookDate}`
                    : `${tr('monthlyCashbook')} · ${cashbookMonth}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPrintPayload({
                      kind: 'report',
                      title:
                        cashbookMode === 'daily'
                          ? tr('dailyCashbook')
                          : tr('monthlyCashbook'),
                      subtitle:
                        cashbookMode === 'daily' ? cashbookDate : cashbookMonth,
                      summary: [
                        { label: tr('openingBalance'), value: fmt(cashbookData.opening) },
                        { label: tr('cashIn'), value: fmt(cashbookData.totalIn) },
                        { label: tr('cashOut'), value: fmt(cashbookData.totalOut) },
                        { label: tr('closingBalance'), value: fmt(cashbookData.closing) },
                      ],
                      columns: [
                        { label: tr('date') },
                        { label: tr('status') },
                        { label: tr('description') },
                        { label: tr('paymentMethod') },
                        { label: tr('cashIn'), align: 'right' },
                        { label: tr('cashOut'), align: 'right' },
                      ],
                      rows: cashbookData.rows.map((r) => [
                        r.date,
                        r.type,
                        r.particulars,
                        r.methodName,
                        r.cashIn > 0 ? fmt(r.cashIn) : '—',
                        r.cashOut > 0 ? fmt(r.cashOut) : '—',
                      ]),
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  <Printer className="h-3.5 w-3.5" />
                  {tr('print')}
                </button>
                <button
                  type="button"
                  onClick={() => setCashbookOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="border-b border-slate-200 bg-slate-50 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setCashbookMode('daily')}
                  className={`rounded-md px-3 py-1 font-medium ${
                    cashbookMode === 'daily'
                      ? 'bg-emerald-700 text-white'
                      : 'text-slate-600'
                  }`}
                >
                  {tr('dailyCashbook')}
                </button>
                <button
                  type="button"
                  onClick={() => setCashbookMode('monthly')}
                  className={`rounded-md px-3 py-1 font-medium ${
                    cashbookMode === 'monthly'
                      ? 'bg-emerald-700 text-white'
                      : 'text-slate-600'
                  }`}
                >
                  {tr('monthlyCashbook')}
                </button>
              </div>

              {cashbookMode === 'daily' ? (
                <input
                  type="date"
                  value={cashbookDate}
                  onChange={(e) => setCashbookDate(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono"
                />
              ) : (
                <input
                  type="month"
                  value={cashbookMonth}
                  onChange={(e) => setCashbookMonth(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono"
                />
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-4 border-b border-slate-200">
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-[11px] text-slate-500">{tr('openingBalance')}</div>
                <div className="mt-1 font-mono text-sm font-bold text-slate-900 tabular-nums">
                  {fmt(cashbookData.opening)}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-[11px] text-slate-500">{tr('cashIn')}</div>
                <div className="mt-1 font-mono text-sm font-bold text-emerald-700 tabular-nums">
                  +{fmt(cashbookData.totalIn)}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-[11px] text-slate-500">{tr('cashOut')}</div>
                <div className="mt-1 font-mono text-sm font-bold text-rose-700 tabular-nums">
                  -{fmt(cashbookData.totalOut)}
                </div>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <div className="text-[11px] text-emerald-800">{tr('closingBalance')}</div>
                <div className="mt-1 font-mono text-sm font-bold text-emerald-900 tabular-nums">
                  {fmt(cashbookData.closing)}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 text-left font-medium">{tr('date')}</th>
                    <th className="py-2 text-left font-medium">{tr('status')}</th>
                    <th className="py-2 text-left font-medium">{tr('description')}</th>
                    <th className="py-2 text-left font-medium">{tr('paymentMethod')}</th>
                    <th className="py-2 text-right font-medium">{tr('cashIn')}</th>
                    <th className="py-2 text-right font-medium">{tr('cashOut')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cashbookData.rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        {tr('noData')}
                      </td>
                    </tr>
                  ) : (
                    cashbookData.rows.map((r) => (
                      <tr key={r.id}>
                        <td className="py-2.5 font-mono text-slate-600">{r.date}</td>
                        <td className="py-2.5 font-medium text-slate-800">{r.type}</td>
                        <td className="py-2.5 text-slate-700">{r.particulars}</td>
                        <td className="py-2.5 text-slate-500">{r.methodName}</td>
                        <td className="py-2.5 text-right font-mono text-emerald-700 tabular-nums">
                          {r.cashIn > 0 ? fmt(r.cashIn) : '—'}
                        </td>
                        <td className="py-2.5 text-right font-mono text-rose-700 tabular-nums">
                          {r.cashOut > 0 ? fmt(r.cashOut) : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
