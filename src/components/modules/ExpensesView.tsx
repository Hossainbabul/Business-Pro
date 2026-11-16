import React, { useMemo, useState } from 'react';
import { Plus, Printer, Edit2, Trash2, X } from 'lucide-react';
import { useBusiness } from '../../context/BusinessContext';
import { ExpenseRecord } from '../../types/business';
import { computeMethodBalance, daysAgoISO, todayISO } from '../../utils/calculations';

export const ExpensesView: React.FC = () => {
  const {
    db,
    currentUser,
    tr,
    fmt,
    addAttr,
    upsertExpense,
    deleteExpense,
    checkMethodBalance,
    requestAdminAuth,
    requestFinancialConfirm,
    notify,
    setPrintPayload,
  } = useBusiness();

  const [catFilter, setCatFilter] = useState('');
  const [fromDate, setFromDate] = useState(daysAgoISO(90));
  const [toDate, setToDate] = useState(todayISO());

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCatInput, setNewCatInput] = useState('');
  const [showNewCat, setShowNewCat] = useState(false);

  const expenseCategories = useMemo(
    () => db.attrs.filter((a) => a.type === 'expense_cat').map((a) => a.name),
    [db.attrs]
  );

  const [form, setForm] = useState({
    date: todayISO(),
    category: expenseCategories[0] || 'Office Rent',
    title: '',
    amount: 0,
    methodId: db.methods[0]?.id || '',
    note: '',
  });

  const filtered = useMemo(
    () =>
      db.expenses
        .filter((e) => (!catFilter ? true : e.category === catFilter))
        .filter((e) => e.date >= fromDate && e.date <= toDate)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [db.expenses, catFilter, fromDate, toDate]
  );

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((e) => {
      map.set(e.category, (map.get(e.category) || 0) + e.amount);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const totalFiltered = filtered.reduce((s, e) => s + e.amount, 0);

  const openAdd = () => {
    setEditingId(null);
    setForm({
      date: todayISO(),
      category: expenseCategories[0] || 'Office Rent',
      title: '',
      amount: 0,
      methodId: db.methods[0]?.id || '',
      note: '',
    });
    setModalOpen(true);
  };

  const openEdit = (exp: ExpenseRecord) => {
    requestAdminAuth(() => {
      setEditingId(exp.id);
      setForm({
        date: exp.date,
        category: exp.category,
        title: exp.title,
        amount: exp.amount,
        methodId: exp.methodId,
        note: exp.note,
      });
      setModalOpen(true);
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(form.amount) || 0;
    if (!form.title.trim() || amt <= 0) return;

    const existing = db.expenses.find((ex) => ex.id === editingId);
    const deltaOut =
      existing && existing.methodId === form.methodId
        ? Math.max(0, amt - existing.amount)
        : amt;

    if (!checkMethodBalance(form.methodId, deltaOut)) {
      notify('error', tr('insufficientBalance'));
      return;
    }

    requestFinancialConfirm(
      {
        title: tr('confirmCommitTitle'),
        details: `${form.category} · ${form.title}`,
        amountLabel: fmt(amt),
      },
      () => {
        upsertExpense({
          id: editingId || `exp-${Date.now()}`,
          date: form.date,
          category: form.category,
          title: form.title.trim(),
          amount: amt,
          methodId: form.methodId,
          note: form.note.trim(),
          createdBy: existing?.createdBy || currentUser?.fullName || 'User',
          createdAt: existing?.createdAt || todayISO(),
        });
        setModalOpen(false);
      }
    );
  };

  const handlePrint = () => {
    setPrintPayload({
      kind: 'report',
      title: tr('expense'),
      subtitle: `${fromDate} to ${toDate}`,
      summary: [{ label: tr('totalExpense'), value: fmt(totalFiltered) }],
      columns: [
        { label: tr('date') },
        { label: tr('expenseCategory') },
        { label: tr('expenseTitle') },
        { label: tr('paymentMethod') },
        { label: tr('amount'), align: 'right' },
      ],
      rows: filtered.map((e) => [
        e.date,
        e.category,
        e.title,
        db.methods.find((m) => m.id === e.methodId)?.name || '—',
        fmt(e.amount),
      ]),
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2"
          >
            <option value="">{tr('expenseCategory')}: {tr('all')}</option>
            {expenseCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono"
          />
          <span className="text-slate-400">→</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Printer className="h-3.5 w-3.5" />
            {tr('print')}
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
          >
            <Plus className="h-4 w-4" />
            {tr('addExpense')}
          </button>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5">
          <div className="text-[11px] font-medium text-amber-800">{tr('totalExpense')}</div>
          <div className="mt-1 text-base font-bold font-mono text-amber-900 tabular-nums">
            {fmt(totalFiltered)}
          </div>
        </div>
        {categoryBreakdown.map(([cat, amt]) => (
          <div key={cat} className="rounded-xl border border-slate-200 bg-white p-3.5">
            <div className="text-[11px] text-slate-500 truncate">{cat}</div>
            <div className="mt-1 text-sm font-bold font-mono text-slate-900 tabular-nums">
              {fmt(amt)}
            </div>
          </div>
        ))}
      </div>

      {/* Expense Ledger Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="py-3 px-4 text-left font-semibold">{tr('date')}</th>
                <th className="py-3 px-3 text-left font-semibold">{tr('expenseCategory')}</th>
                <th className="py-3 px-3 text-left font-semibold">{tr('expenseTitle')}</th>
                <th className="py-3 px-3 text-left font-semibold">{tr('paymentMethod')}</th>
                <th className="py-3 px-3 text-right font-semibold">{tr('amount')}</th>
                <th className="py-3 px-4 text-right font-semibold">{tr('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    {tr('noData')}
                  </td>
                </tr>
              ) : (
                filtered.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 font-mono text-slate-600">{exp.date}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-700">{exp.category}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">{exp.title}</div>
                      {exp.note && (
                        <div className="text-[11px] text-slate-400">{exp.note}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {db.methods.find((m) => m.id === exp.methodId)?.name || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-800 tabular-nums">
                      {fmt(exp.amount)}
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(exp)}
                          className="rounded-md p-1.5 text-slate-600 hover:bg-slate-200"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            requestAdminAuth(() => deleteExpense(exp.id))
                          }
                          className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-base font-bold text-slate-900">
                {editingId ? tr('edit') : tr('addExpense')}
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">{tr('date')}</label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">{tr('paymentMethod')}</label>
                  <select
                    value={form.methodId}
                    onChange={(e) => setForm({ ...form, methodId: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2"
                  >
                    {db.methods.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({fmt(computeMethodBalance(m.id, db))})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">{tr('expenseCategory')}</label>
                <div className="flex gap-1.5">
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-2"
                  >
                    {expenseCategories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowNewCat((s) => !s)}
                    className="rounded-lg border border-slate-300 px-2.5 text-slate-700 hover:bg-slate-100"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                {showNewCat && (
                  <div className="mt-1.5 flex gap-1.5">
                    <input
                      type="text"
                      value={newCatInput}
                      onChange={(e) => setNewCatInput(e.target.value)}
                      placeholder={tr('expenseCategory')}
                      className="flex-1 rounded-lg border border-emerald-400 px-2.5 py-1.5"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newCatInput.trim()) return;
                        addAttr('expense_cat', newCatInput.trim());
                        setForm({ ...form, category: newCatInput.trim() });
                        setNewCatInput('');
                        setShowNewCat(false);
                      }}
                      className="rounded-lg bg-emerald-700 px-3 py-1.5 text-white font-medium"
                    >
                      {tr('save')}
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">{tr('expenseTitle')} *</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">{tr('amount')} *</label>
                <input
                  type="number"
                  min={1}
                  step="any"
                  required
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono font-semibold"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">{tr('note')}</label>
                <input
                  type="text"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-700"
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
    </div>
  );
};
