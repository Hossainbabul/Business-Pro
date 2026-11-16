import React, { useMemo, useState } from 'react';
import { Plus, ArrowRightLeft, FileText, Trash2, Printer, X } from 'lucide-react';
import { useBusiness } from '../../context/BusinessContext';
import { PaymentMethod } from '../../types/business';
import {
  computeCombinedBalance,
  computeMethodBalance,
  computeMethodLedger,
  todayISO,
} from '../../utils/calculations';

export const MethodsView: React.FC = () => {
  const {
    db,
    currentUser,
    tr,
    fmt,
    upsertMethod,
    deleteMethod,
    addTransfer,
    deleteTransfer,
    checkMethodBalance,
    requestAdminAuth,
    requestFinancialConfirm,
    notify,
    setPrintPayload,
  } = useBusiness();

  const [methodModal, setMethodModal] = useState(false);
  const [transferModal, setTransferModal] = useState(false);
  const [ledgerMethod, setLedgerMethod] = useState<PaymentMethod | null>(null);

  const [mForm, setMForm] = useState({
    name: '',
    accountNo: '',
    openingBalance: 0,
  });

  const [tForm, setTForm] = useState({
    date: todayISO(),
    fromMethodId: db.methods[0]?.id || '',
    toMethodId: db.methods[1]?.id || db.methods[0]?.id || '',
    amount: 0,
    note: '',
  });

  const combined = useMemo(() => computeCombinedBalance(db), [db]);

  const methodRows = useMemo(
    () =>
      db.methods.map((m) => ({
        method: m,
        balance: computeMethodBalance(m.id, db),
      })),
    [db]
  );

  const ledgerData = useMemo(() => {
    if (!ledgerMethod) return null;
    return computeMethodLedger(ledgerMethod.id, db);
  }, [ledgerMethod, db]);

  const handleAddMethod = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mForm.name.trim()) return;
    upsertMethod({
      id: `mth-${Date.now()}`,
      name: mForm.name.trim(),
      accountNo: mForm.accountNo.trim(),
      openingBalance: Number(mForm.openingBalance) || 0,
    });
    setMethodModal(false);
  };

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(tForm.amount) || 0;
    if (amt <= 0 || tForm.fromMethodId === tForm.toMethodId) return;

    if (!checkMethodBalance(tForm.fromMethodId, amt)) {
      notify('error', tr('insufficientBalance'));
      return;
    }

    const fromName =
      db.methods.find((m) => m.id === tForm.fromMethodId)?.name || '';
    const toName =
      db.methods.find((m) => m.id === tForm.toMethodId)?.name || '';

    requestFinancialConfirm(
      {
        title: tr('fundTransfer'),
        details: `${fromName} → ${toName}`,
        amountLabel: fmt(amt),
      },
      () => {
        addTransfer({
          id: `tr-${Date.now()}`,
          date: tForm.date,
          fromMethodId: tForm.fromMethodId,
          toMethodId: tForm.toMethodId,
          amount: amt,
          note: tForm.note.trim(),
          createdBy: currentUser?.fullName || 'User',
          createdAt: todayISO(),
        });
        setTransferModal(false);
      }
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-900 px-5 py-3.5 text-white">
          <div className="text-[11px] text-emerald-200">
            {tr('combinedBalance')}
          </div>
          <div className="text-xl font-bold font-mono tabular-nums mt-0.5">
            {fmt(combined)}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setTForm({
                date: todayISO(),
                fromMethodId: db.methods[0]?.id || '',
                toMethodId: db.methods[1]?.id || db.methods[0]?.id || '',
                amount: 0,
                note: '',
              });
              setTransferModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            <ArrowRightLeft className="h-3.5 w-3.5 text-emerald-700" />
            {tr('fundTransfer')}
          </button>
          <button
            type="button"
            onClick={() => {
              setMForm({ name: '', accountNo: '', openingBalance: 0 });
              setMethodModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
          >
            <Plus className="h-4 w-4" />
            {tr('addMethod')}
          </button>
        </div>
      </div>

      {/* Method Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {methodRows.map(({ method, balance }) => (
          <div
            key={method.id}
            className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {method.name}
                  </h3>
                  <div className="text-xs font-mono text-slate-500 mt-0.5">
                    {method.accountNo || '—'}
                  </div>
                </div>
                {!method.isDefault && (
                  <button
                    type="button"
                    onClick={() =>
                      requestAdminAuth(() => deleteMethod(method.id))
                    }
                    className="rounded p-1 text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="mt-4 text-2xl font-bold font-mono text-emerald-800 tabular-nums">
                {fmt(balance)}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-mono">
                {tr('openingBalance')}: {fmt(method.openingBalance)}
              </span>
              <button
                type="button"
                onClick={() => setLedgerMethod(method)}
                className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline"
              >
                <FileText className="h-3.5 w-3.5" />
                {tr('methodLedger')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Fund Transfers Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-3.5 text-sm font-semibold text-slate-900">
          {tr('fundTransfer')}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="py-2.5 px-4 text-left font-semibold">{tr('date')}</th>
                <th className="py-2.5 px-3 text-left font-semibold">{tr('fromMethod')}</th>
                <th className="py-2.5 px-3 text-left font-semibold">{tr('toMethod')}</th>
                <th className="py-2.5 px-3 text-left font-semibold">{tr('note')}</th>
                <th className="py-2.5 px-3 text-right font-semibold">{tr('amount')}</th>
                <th className="py-2.5 px-4 text-right font-semibold">{tr('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {db.transfers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    {tr('noData')}
                  </td>
                </tr>
              ) : (
                db.transfers.map((trItem) => (
                  <tr key={trItem.id}>
                    <td className="py-2.5 px-4 font-mono text-slate-600">
                      {trItem.date}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-800">
                      {db.methods.find((m) => m.id === trItem.fromMethodId)?.name || '—'}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-emerald-700">
                      {db.methods.find((m) => m.id === trItem.toMethodId)?.name || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {trItem.note || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums">
                      {fmt(trItem.amount)}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          requestAdminAuth(() => deleteTransfer(trItem.id))
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

      {/* Add Method Modal */}
      {methodModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-base font-bold text-slate-900">{tr('addMethod')}</h3>
              <button
                type="button"
                onClick={() => setMethodModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleAddMethod} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">{tr('methodName')} *</label>
                <input
                  type="text"
                  required
                  value={mForm.name}
                  onChange={(e) => setMForm({ ...mForm, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">{tr('accountNo')}</label>
                <input
                  type="text"
                  value={mForm.accountNo}
                  onChange={(e) => setMForm({ ...mForm, accountNo: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">{tr('openingBalance')}</label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={mForm.openingBalance}
                  onChange={(e) => setMForm({ ...mForm, openingBalance: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setMethodModal(false)}
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

      {/* Fund Transfer Modal */}
      {transferModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-base font-bold text-slate-900">{tr('fundTransfer')}</h3>
              <button
                type="button"
                onClick={() => setTransferModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleTransfer} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">{tr('date')}</label>
                <input
                  type="date"
                  required
                  value={tForm.date}
                  onChange={(e) => setTForm({ ...tForm, date: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">{tr('fromMethod')}</label>
                <select
                  value={tForm.fromMethodId}
                  onChange={(e) => setTForm({ ...tForm, fromMethodId: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2"
                >
                  {db.methods.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({fmt(computeMethodBalance(m.id, db))})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">{tr('toMethod')}</label>
                <select
                  value={tForm.toMethodId}
                  onChange={(e) => setTForm({ ...tForm, toMethodId: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2"
                >
                  {db.methods.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({fmt(computeMethodBalance(m.id, db))})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">{tr('amount')} *</label>
                <input
                  type="number"
                  min={1}
                  step="any"
                  required
                  value={tForm.amount}
                  onChange={(e) => setTForm({ ...tForm, amount: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">{tr('note')}</label>
                <input
                  type="text"
                  value={tForm.note}
                  onChange={(e) => setTForm({ ...tForm, note: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setTransferModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-700"
                >
                  {tr('cancel')}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-700 px-5 py-2 font-semibold text-white hover:bg-emerald-800"
                >
                  {tr('confirm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Per-Method Ledger Modal */}
      {ledgerMethod && ledgerData && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {tr('methodLedger')}: {ledgerMethod.name}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {tr('currentBalance')}: {fmt(ledgerData.balance)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPrintPayload({
                      kind: 'report',
                      title: `${tr('methodLedger')} — ${ledgerMethod.name}`,
                      subtitle: todayISO(),
                      summary: [
                        { label: tr('openingBalance'), value: fmt(ledgerMethod.openingBalance) },
                        { label: tr('currentBalance'), value: fmt(ledgerData.balance) },
                      ],
                      columns: [
                        { label: tr('date') },
                        { label: tr('status') },
                        { label: tr('description') },
                        { label: tr('cashIn'), align: 'right' },
                        { label: tr('cashOut'), align: 'right' },
                        { label: tr('currentBalance'), align: 'right' },
                      ],
                      rows: ledgerData.entries.map((e) => [
                        e.date,
                        e.source,
                        e.description,
                        e.inAmount > 0 ? fmt(e.inAmount) : '—',
                        e.outAmount > 0 ? fmt(e.outAmount) : '—',
                        fmt(e.runningBalance),
                      ]),
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  <Printer className="h-3.5 w-3.5" />
                  {tr('print')}
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerMethod(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 text-left">{tr('date')}</th>
                    <th className="py-2 text-left">{tr('status')}</th>
                    <th className="py-2 text-left">{tr('description')}</th>
                    <th className="py-2 text-right">{tr('cashIn')}</th>
                    <th className="py-2 text-right">{tr('cashOut')}</th>
                    <th className="py-2 text-right">{tr('currentBalance')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="bg-slate-50/70">
                    <td className="py-2 font-mono">—</td>
                    <td className="py-2 font-medium">{tr('openingBalance')}</td>
                    <td className="py-2">—</td>
                    <td className="py-2 text-right">—</td>
                    <td className="py-2 text-right">—</td>
                    <td className="py-2 text-right font-mono font-bold">
                      {fmt(ledgerMethod.openingBalance)}
                    </td>
                  </tr>
                  {ledgerData.entries.map((e) => (
                    <tr key={e.id}>
                      <td className="py-2.5 font-mono text-slate-600">{e.date}</td>
                      <td className="py-2.5 font-medium text-slate-800">{e.source}</td>
                      <td className="py-2.5 text-slate-600">{e.description}</td>
                      <td className="py-2.5 text-right font-mono text-emerald-700">
                        {e.inAmount > 0 ? fmt(e.inAmount) : '—'}
                      </td>
                      <td className="py-2.5 text-right font-mono text-rose-700">
                        {e.outAmount > 0 ? fmt(e.outAmount) : '—'}
                      </td>
                      <td className="py-2.5 text-right font-mono font-bold text-slate-900">
                        {fmt(e.runningBalance)}
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
