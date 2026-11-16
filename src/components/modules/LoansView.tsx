import React, { useMemo, useState } from 'react';
import { Plus, CreditCard, Printer, Trash2, FileText, X } from 'lucide-react';
import { useBusiness } from '../../context/BusinessContext';
import { LoanDirection, LoanRecord } from '../../types/business';
import { computeMethodBalance, todayISO } from '../../utils/calculations';

export const LoansView: React.FC = () => {
  const {
    db,
    currentUser,
    tr,
    fmt,
    upsertLoan,
    deleteLoan,
    addPayment,
    deletePayment,
    checkMethodBalance,
    requestAdminAuth,
    requestFinancialConfirm,
    notify,
    setPrintPayload,
  } = useBusiness();

  const [tab, setTab] = useState<LoanDirection>('given');
  const [loanModal, setLoanModal] = useState(false);
  const [repayLoan, setRepayLoan] = useState<LoanRecord | null>(null);
  const [ledgerLoan, setLedgerLoan] = useState<LoanRecord | null>(null);

  const [form, setForm] = useState({
    date: todayISO(),
    personName: '',
    phone: '',
    principal: 0,
    interestRate: 0,
    methodId: db.methods[0]?.id || '',
    note: '',
  });

  const [repayForm, setRepayForm] = useState({
    date: todayISO(),
    amount: 0,
    methodId: db.methods[0]?.id || '',
    note: '',
  });

  const loans = useMemo(() => {
    const category = tab === 'given' ? 'loan_given' : 'loan_taken';
    return db.loans
      .filter((l) => l.direction === tab)
      .map((l) => {
        const repaid = db.payments
          .filter((p) => p.category === category && p.refId === l.id)
          .reduce((s, p) => s + p.amount, 0);
        return {
          loan: l,
          repaid,
          remaining: Math.max(0, l.principal - repaid),
        };
      });
  }, [db.loans, db.payments, tab]);

  const handleSaveLoan = (e: React.FormEvent) => {
    e.preventDefault();
    const principal = Number(form.principal) || 0;
    if (!form.personName.trim() || principal <= 0) return;

    if (tab === 'given' && !checkMethodBalance(form.methodId, principal)) {
      notify('error', tr('insufficientBalance'));
      return;
    }

    requestFinancialConfirm(
      {
        title: tr('confirmCommitTitle'),
        details: `${tab === 'given' ? tr('loansGiven') : tr('loansTaken')} · ${form.personName}`,
        amountLabel: fmt(principal),
      },
      () => {
        upsertLoan({
          id: `ln-rec-${Date.now()}`,
          date: form.date,
          direction: tab,
          personName: form.personName.trim(),
          phone: form.phone.trim(),
          principal,
          interestRate: Number(form.interestRate) || 0,
          methodId: form.methodId,
          note: form.note.trim(),
          createdBy: currentUser?.fullName || 'User',
          createdAt: todayISO(),
        });
        setLoanModal(false);
      }
    );
  };

  const handleRepaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repayLoan) return;
    const amt = Number(repayForm.amount) || 0;
    if (amt <= 0) return;

    // Loan given repayment = cash IN; Loan taken repayment = cash OUT
    const direction = repayLoan.direction === 'given' ? 'in' : 'out';
    if (direction === 'out' && !checkMethodBalance(repayForm.methodId, amt)) {
      notify('error', tr('insufficientBalance'));
      return;
    }

    requestFinancialConfirm(
      {
        title: tr('confirmCommitTitle'),
        details: `${tr('recordRepayment')} · ${repayLoan.personName}`,
        amountLabel: fmt(amt),
      },
      () => {
        const payId = `pay-${Date.now()}`;
        addPayment({
          id: payId,
          receiptNo: `LR-${new Date().getFullYear()}-${String(
            db.payments.length + 1
          ).padStart(3, '0')}`,
          date: repayForm.date,
          category: repayLoan.direction === 'given' ? 'loan_given' : 'loan_taken',
          refId: repayLoan.id,
          refName: repayLoan.personName,
          direction,
          amount: amt,
          discount: 0,
          methodId: repayForm.methodId,
          note: repayForm.note.trim(),
          createdBy: currentUser?.fullName || 'User',
          createdAt: todayISO(),
        });
        setRepayLoan(null);
        setPrintPayload({ kind: 'receipt', paymentId: payId });
      }
    );
  };

  const handlePrintLoans = () => {
    setPrintPayload({
      kind: 'report',
      title: tab === 'given' ? tr('loansGiven') : tr('loansTaken'),
      subtitle: todayISO(),
      columns: [
        { label: tr('date') },
        { label: tab === 'given' ? tr('borrowerName') : tr('lenderName') },
        { label: tr('principal'), align: 'right' },
        { label: tr('repaid'), align: 'right' },
        { label: tr('remaining'), align: 'right' },
      ],
      rows: loans.map(({ loan, repaid, remaining }) => [
        loan.date,
        loan.personName,
        fmt(loan.principal),
        fmt(repaid),
        fmt(remaining),
      ]),
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setTab('given')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-semibold ${
              tab === 'given'
                ? 'bg-emerald-700 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tr('loansGiven')}
          </button>
          <button
            type="button"
            onClick={() => setTab('taken')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-semibold ${
              tab === 'taken'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tr('loansTaken')}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrintLoans}
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
                personName: '',
                phone: '',
                principal: 0,
                interestRate: 0,
                methodId: db.methods[0]?.id || '',
                note: '',
              });
              setLoanModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
          >
            <Plus className="h-4 w-4" />
            {tr('newLoan')}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="py-3 px-4 text-left font-semibold">{tr('date')}</th>
                <th className="py-3 px-3 text-left font-semibold">
                  {tab === 'given' ? tr('borrowerName') : tr('lenderName')}
                </th>
                <th className="py-3 px-3 text-left font-semibold">{tr('phone')}</th>
                <th className="py-3 px-3 text-right font-semibold">{tr('principal')}</th>
                <th className="py-3 px-3 text-right font-semibold">{tr('repaid')}</th>
                <th className="py-3 px-3 text-right font-semibold">{tr('remaining')}</th>
                <th className="py-3 px-4 text-right font-semibold">{tr('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    {tr('noData')}
                  </td>
                </tr>
              ) : (
                loans.map(({ loan, repaid, remaining }) => (
                  <tr key={loan.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 font-mono text-slate-600">{loan.date}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      {loan.personName}
                      {loan.note && (
                        <div className="text-[11px] font-normal text-slate-400">
                          {loan.note}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">
                      {loan.phone || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {fmt(loan.principal)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-700">
                      {fmt(repaid)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                      {fmt(remaining)}
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        {remaining > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setRepayLoan(loan);
                              setRepayForm({
                                date: todayISO(),
                                amount: remaining,
                                methodId: db.methods[0]?.id || '',
                                note: '',
                              });
                            }}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
                          >
                            <CreditCard className="h-3 w-3" />
                            {tr('recordRepayment')}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setLedgerLoan(loan)}
                          className="rounded-md p-1.5 text-slate-600 hover:bg-slate-200"
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            requestAdminAuth(() => deleteLoan(loan.id))
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

      {/* New Loan Modal */}
      {loanModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-base font-bold text-slate-900">
                {tr('newLoan')} ({tab === 'given' ? tr('loansGiven') : tr('loansTaken')})
              </h3>
              <button
                type="button"
                onClick={() => setLoanModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSaveLoan} className="p-6 space-y-4 text-xs">
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
                <label className="block font-medium text-slate-700 mb-1">
                  {tab === 'given' ? tr('borrowerName') : tr('lenderName')} *
                </label>
                <input
                  type="text"
                  required
                  value={form.personName}
                  onChange={(e) => setForm({ ...form, personName: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
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
                  <label className="block font-medium text-slate-700 mb-1">{tr('principal')} *</label>
                  <input
                    type="number"
                    min={1}
                    step="any"
                    required
                    value={form.principal}
                    onChange={(e) => setForm({ ...form, principal: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono font-semibold"
                  />
                </div>
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
                  onClick={() => setLoanModal(false)}
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

      {/* Repayment Modal */}
      {repayLoan && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {tr('recordRepayment')}
                </h3>
                <p className="text-xs text-slate-500">{repayLoan.personName}</p>
              </div>
              <button
                type="button"
                onClick={() => setRepayLoan(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleRepaySubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">{tr('date')}</label>
                  <input
                    type="date"
                    required
                    value={repayForm.date}
                    onChange={(e) => setRepayForm({ ...repayForm, date: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">{tr('paymentMethod')}</label>
                  <select
                    value={repayForm.methodId}
                    onChange={(e) => setRepayForm({ ...repayForm, methodId: e.target.value })}
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
                  value={repayForm.amount}
                  onChange={(e) => setRepayForm({ ...repayForm, amount: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">{tr('note')}</label>
                <input
                  type="text"
                  value={repayForm.note}
                  onChange={(e) => setRepayForm({ ...repayForm, note: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setRepayLoan(null)}
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

      {/* Loan Ledger Modal */}
      {ledgerLoan && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {ledgerLoan.personName}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {tr('principal')}: {fmt(ledgerLoan.principal)} · {ledgerLoan.date}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLedgerLoan(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 max-h-[65vh] overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 text-left">{tr('date')}</th>
                    <th className="py-2 text-left">Ref</th>
                    <th className="py-2 text-left">{tr('note')}</th>
                    <th className="py-2 text-right">{tr('amount')}</th>
                    <th className="py-2 text-right">{tr('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {db.payments
                    .filter((p) => p.refId === ledgerLoan.id)
                    .map((p) => (
                      <tr key={p.id}>
                        <td className="py-2.5 font-mono">{p.date}</td>
                        <td className="py-2.5 font-mono text-emerald-700">
                          <button
                            type="button"
                            onClick={() =>
                              setPrintPayload({ kind: 'receipt', paymentId: p.id })
                            }
                            className="hover:underline"
                          >
                            {p.receiptNo}
                          </button>
                        </td>
                        <td className="py-2.5 text-slate-600">{p.note || '—'}</td>
                        <td className="py-2.5 text-right font-mono font-semibold">
                          {fmt(p.amount)}
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              requestAdminAuth(() => deletePayment(p.id))
                            }
                            className="rounded p-1 text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
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
