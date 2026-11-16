import React, { useMemo, useState } from 'react';
import { Plus, CreditCard, Printer, Trash2, X } from 'lucide-react';
import { useBusiness } from '../../context/BusinessContext';
import { InvestmentRecord } from '../../types/business';
import { computeMethodBalance, todayISO } from '../../utils/calculations';

export const InvestmentsView: React.FC = () => {
  const {
    db,
    currentUser,
    tr,
    fmt,
    upsertInvestment,
    deleteInvestment,
    addPayment,
    checkMethodBalance,
    requestAdminAuth,
    requestFinancialConfirm,
    notify,
    setPrintPayload,
  } = useBusiness();

  const [invModal, setInvModal] = useState(false);
  const [returnInv, setReturnInv] = useState<InvestmentRecord | null>(null);

  const [form, setForm] = useState({
    date: todayISO(),
    investorName: '',
    phone: '',
    capitalAmount: 0,
    sharePercent: 10,
    methodId: db.methods[0]?.id || '',
    note: '',
  });

  const [returnForm, setReturnForm] = useState({
    date: todayISO(),
    amount: 0,
    methodId: db.methods[0]?.id || '',
    note: '',
  });

  const rows = useMemo(() => {
    return db.investments.map((inv) => {
      const returnsPaid = db.payments
        .filter((p) => p.category === 'investment' && p.refId === inv.id)
        .reduce((s, p) => s + p.amount, 0);
      return {
        inv,
        returnsPaid,
        netOwed: Math.max(0, inv.capitalAmount - returnsPaid),
      };
    });
  }, [db.investments, db.payments]);

  const totals = useMemo(
    () => ({
      capital: rows.reduce((s, r) => s + r.inv.capitalAmount, 0),
      returns: rows.reduce((s, r) => s + r.returnsPaid, 0),
    }),
    [rows]
  );

  const handleSaveInvestment = (e: React.FormEvent) => {
    e.preventDefault();
    const cap = Number(form.capitalAmount) || 0;
    if (!form.investorName.trim() || cap <= 0) return;

    requestFinancialConfirm(
      {
        title: tr('confirmCommitTitle'),
        details: `${tr('newInvestment')} · ${form.investorName}`,
        amountLabel: fmt(cap),
      },
      () => {
        upsertInvestment({
          id: `invst-${Date.now()}`,
          date: form.date,
          investorName: form.investorName.trim(),
          phone: form.phone.trim(),
          capitalAmount: cap,
          sharePercent: Number(form.sharePercent) || 0,
          methodId: form.methodId,
          note: form.note.trim(),
          createdBy: currentUser?.fullName || 'User',
          createdAt: todayISO(),
        });
        setInvModal(false);
      }
    );
  };

  const handleReturnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnInv) return;
    const amt = Number(returnForm.amount) || 0;
    if (amt <= 0) return;

    if (!checkMethodBalance(returnForm.methodId, amt)) {
      notify('error', tr('insufficientBalance'));
      return;
    }

    requestFinancialConfirm(
      {
        title: tr('confirmCommitTitle'),
        details: `${tr('payReturn')} · ${returnInv.investorName}`,
        amountLabel: fmt(amt),
      },
      () => {
        const payId = `pay-${Date.now()}`;
        addPayment({
          id: payId,
          receiptNo: `INV-RET-${String(db.payments.length + 1).padStart(3, '0')}`,
          date: returnForm.date,
          category: 'investment',
          refId: returnInv.id,
          refName: returnInv.investorName,
          direction: 'out',
          amount: amt,
          discount: 0,
          methodId: returnForm.methodId,
          note: returnForm.note.trim(),
          createdBy: currentUser?.fullName || 'User',
          createdAt: todayISO(),
        });
        setReturnInv(null);
        setPrintPayload({ kind: 'receipt', paymentId: payId });
      }
    );
  };

  const handlePrint = () => {
    setPrintPayload({
      kind: 'report',
      title: tr('investment'),
      subtitle: todayISO(),
      summary: [
        { label: tr('capitalReceived'), value: fmt(totals.capital) },
        { label: tr('returnsPaid'), value: fmt(totals.returns) },
      ],
      columns: [
        { label: tr('date') },
        { label: tr('investorName') },
        { label: 'Share %', align: 'right' },
        { label: tr('capitalReceived'), align: 'right' },
        { label: tr('returnsPaid'), align: 'right' },
      ],
      rows: rows.map(({ inv, returnsPaid }) => [
        inv.date,
        inv.investorName,
        `${inv.sharePercent}%`,
        fmt(inv.capitalAmount),
        fmt(returnsPaid),
      ]),
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-[11px] text-slate-500">{tr('capitalReceived')}</div>
            <div className="text-base font-bold font-mono text-slate-900 tabular-nums">
              {fmt(totals.capital)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-[11px] text-slate-500">{tr('returnsPaid')}</div>
            <div className="text-base font-bold font-mono text-amber-700 tabular-nums">
              {fmt(totals.returns)}
            </div>
          </div>
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
            onClick={() => {
              setForm({
                date: todayISO(),
                investorName: '',
                phone: '',
                capitalAmount: 0,
                sharePercent: 10,
                methodId: db.methods[0]?.id || '',
                note: '',
              });
              setInvModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
          >
            <Plus className="h-4 w-4" />
            {tr('newInvestment')}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="py-3 px-4 text-left font-semibold">{tr('date')}</th>
                <th className="py-3 px-3 text-left font-semibold">{tr('investorName')}</th>
                <th className="py-3 px-3 text-left font-semibold">{tr('phone')}</th>
                <th className="py-3 px-3 text-right font-semibold">Share %</th>
                <th className="py-3 px-3 text-right font-semibold">{tr('capitalReceived')}</th>
                <th className="py-3 px-3 text-right font-semibold">{tr('returnsPaid')}</th>
                <th className="py-3 px-4 text-right font-semibold">{tr('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(({ inv, returnsPaid }) => (
                <tr key={inv.id} className="hover:bg-slate-50/80">
                  <td className="py-2.5 px-4 font-mono text-slate-600">{inv.date}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">
                    {inv.investorName}
                    {inv.note && (
                      <div className="text-[11px] font-normal text-slate-400">
                        {inv.note}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-600">
                    {inv.phone || '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">{inv.sharePercent}%</td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-700 tabular-nums">
                    {fmt(inv.capitalAmount)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-amber-700 tabular-nums">
                    {fmt(returnsPaid)}
                  </td>
                  <td className="py-2.5 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setReturnInv(inv);
                          setReturnForm({
                            date: todayISO(),
                            amount: 0,
                            methodId: db.methods[0]?.id || '',
                            note: '',
                          });
                        }}
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
                      >
                        <CreditCard className="h-3 w-3" />
                        {tr('payReturn')}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          requestAdminAuth(() => deleteInvestment(inv.id))
                        }
                        className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {invModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-base font-bold text-slate-900">{tr('newInvestment')}</h3>
              <button
                type="button"
                onClick={() => setInvModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSaveInvestment} className="p-6 space-y-4 text-xs">
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
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">{tr('investorName')} *</label>
                <input
                  type="text"
                  required
                  value={form.investorName}
                  onChange={(e) => setForm({ ...form, investorName: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">{tr('capitalReceived')} *</label>
                  <input
                    type="number"
                    min={1}
                    step="any"
                    required
                    value={form.capitalAmount}
                    onChange={(e) => setForm({ ...form, capitalAmount: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Share %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    value={form.sharePercent}
                    onChange={(e) => setForm({ ...form, sharePercent: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">{tr('phone')}</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
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
                  onClick={() => setInvModal(false)}
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

      {returnInv && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">{tr('payReturn')}</h3>
                <p className="text-xs text-slate-500">{returnInv.investorName}</p>
              </div>
              <button
                type="button"
                onClick={() => setReturnInv(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleReturnSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">{tr('date')}</label>
                  <input
                    type="date"
                    required
                    value={returnForm.date}
                    onChange={(e) => setReturnForm({ ...returnForm, date: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">{tr('paymentMethod')}</label>
                  <select
                    value={returnForm.methodId}
                    onChange={(e) => setReturnForm({ ...returnForm, methodId: e.target.value })}
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
                <label className="block font-medium text-slate-700 mb-1">{tr('amount')} *</label>
                <input
                  type="number"
                  min={1}
                  step="any"
                  required
                  value={returnForm.amount}
                  onChange={(e) => setReturnForm({ ...returnForm, amount: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">{tr('note')}</label>
                <input
                  type="text"
                  value={returnForm.note}
                  onChange={(e) => setReturnForm({ ...returnForm, note: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setReturnInv(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-700"
                >
                  {tr('cancel')}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-700 px-5 py-2 font-semibold text-white hover:bg-emerald-800"
                >
                  {tr('submit')} & {tr('moneyReceipt')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
