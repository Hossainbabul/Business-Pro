import React, { useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  CreditCard,
  FileText,
  Printer,
  ChevronDown,
  ChevronRight,
  MessageCircle,
  X,
} from 'lucide-react';
import { useBusiness } from '../../context/BusinessContext';
import { Party, PartyType } from '../../types/business';
import {
  buildWhatsAppLink,
  computeMethodBalance,
  computePartyBalance,
  daysAgoISO,
  todayISO,
} from '../../utils/calculations';

export const PartiesView: React.FC = () => {
  const {
    db,
    currentUser,
    tr,
    fmt,
    upsertParty,
    deleteParty,
    addPayment,
    deletePayment,
    checkMethodBalance,
    requestAdminAuth,
    requestFinancialConfirm,
    notify,
    setPrintPayload,
  } = useBusiness();

  const [tab, setTab] = useState<PartyType>('customer');
  const [search, setSearch] = useState('');

  // Party Add/Edit modal
  const [partyModal, setPartyModal] = useState(false);
  const [editingPartyId, setEditingPartyId] = useState<string | null>(null);
  const [partyForm, setPartyForm] = useState({
    name: '',
    phone: '',
    address: '',
    openingBalance: 0,
    isWalking: false,
  });

  // Payment Modal
  const [payParty, setPayParty] = useState<Party | null>(null);
  const [payForm, setPayForm] = useState({
    date: todayISO(),
    amount: 0,
    discount: 0,
    methodId: db.methods[0]?.id || '',
    note: '',
  });

  // Detail Ledger Modal
  const [ledgerParty, setLedgerParty] = useState<Party | null>(null);
  const [ledgerFrom, setLedgerFrom] = useState(daysAgoISO(180));
  const [ledgerTo, setLedgerTo] = useState(todayISO());
  const [expandedInvs, setExpandedInvs] = useState<Record<string, boolean>>({});

  const partiesWithBal = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.parties
      .filter((p) => p.type === tab)
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.phone.toLowerCase().includes(q)
      )
      .map((p) => ({
        party: p,
        balance: computePartyBalance(p, db),
      }));
  }, [db, tab, search]);

  const openAddParty = () => {
    setEditingPartyId(null);
    setPartyForm({
      name: '',
      phone: '',
      address: '',
      openingBalance: 0,
      isWalking: false,
    });
    setPartyModal(true);
  };

  const openEditParty = (p: Party) => {
    requestAdminAuth(() => {
      setEditingPartyId(p.id);
      setPartyForm({
        name: p.name,
        phone: p.phone,
        address: p.address,
        openingBalance: p.openingBalance,
        isWalking: p.isWalking,
      });
      setPartyModal(true);
    });
  };

  const handleSaveParty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyForm.name.trim()) return;
    const existing = db.parties.find((p) => p.id === editingPartyId);
    upsertParty({
      id: editingPartyId || `pty-${Date.now()}`,
      type: tab,
      name: partyForm.name.trim(),
      phone: partyForm.phone.trim(),
      address: partyForm.address.trim(),
      openingBalance: Number(partyForm.openingBalance) || 0,
      isWalking: partyForm.isWalking,
      createdAt: existing?.createdAt || todayISO(),
    });
    setPartyModal(false);
  };

  const openPayment = (p: Party, bal: number) => {
    setPayParty(p);
    setPayForm({
      date: todayISO(),
      amount: bal > 0 ? bal : 0,
      discount: 0,
      methodId: db.methods[0]?.id || '',
      note: '',
    });
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payParty) return;
    const amt = Number(payForm.amount) || 0;
    const disc = Number(payForm.discount) || 0;
    if (amt <= 0 && disc <= 0) return;

    const direction = payParty.type === 'customer' ? 'in' : 'out';
    if (direction === 'out' && !checkMethodBalance(payForm.methodId, amt)) {
      notify('error', tr('insufficientBalance'));
      return;
    }

    requestFinancialConfirm(
      {
        title: tr('confirmCommitTitle'),
        details: `${
          direction === 'in' ? tr('receivePayment') : tr('makePayment')
        } — ${payParty.name}`,
        amountLabel: fmt(amt),
      },
      () => {
        const id = `pay-${Date.now()}`;
        const receiptNo = `MR-${new Date().getFullYear()}-${String(
          db.payments.length + 1
        ).padStart(3, '0')}`;
        addPayment({
          id,
          receiptNo,
          date: payForm.date,
          category: 'party',
          refId: payParty.id,
          refName: payParty.name,
          direction,
          amount: amt,
          discount: disc,
          methodId: payForm.methodId,
          note: payForm.note.trim(),
          createdBy: currentUser?.fullName || 'User',
          createdAt: todayISO(),
        });
        setPayParty(null);
        setPrintPayload({ kind: 'receipt', paymentId: id });
      }
    );
  };

  // Detail Ledger calculation
  const ledgerRows = useMemo(() => {
    if (!ledgerParty) return null;
    const invs = db.invoices
      .filter((i) => i.partyId === ledgerParty.id)
      .map((i) => {
        const net = i.subtotal - i.discountAmount + i.taxAmount;
        return {
          id: `inv-${i.id}`,
          kind: 'invoice' as const,
          date: i.date,
          ref: i.invoiceNo,
          desc: `${i.type === 'sale' ? 'Sale' : 'Purchase'} (Paid ${fmt(i.paidAmount)})`,
          debit: net,
          credit: i.paidAmount,
          invoiceId: i.id,
          lines: db.invLines.filter((l) => l.invoiceId === i.id),
        };
      });

    const pays = db.payments
      .filter((p) => p.category === 'party' && p.refId === ledgerParty.id)
      .map((p) => ({
        id: `pay-${p.id}`,
        kind: 'payment' as const,
        paymentId: p.id,
        date: p.date,
        ref: p.receiptNo,
        desc: `${tr('moneyReceipt')}${p.discount > 0 ? ` (${tr('discount')}: ${fmt(p.discount)})` : ''}${p.note ? ` · ${p.note}` : ''}`,
        debit: 0,
        credit: p.amount + p.discount,
      }));

    const all = [...invs, ...pays].sort((a, b) => a.date.localeCompare(b.date));

    let running = ledgerParty.openingBalance;
    const computed = all.map((row) => {
      running += row.debit - row.credit;
      return { ...row, balance: running };
    });

    const filteredRows = computed.filter(
      (r) => r.date >= ledgerFrom && r.date <= ledgerTo
    );

    return {
      opening: ledgerParty.openingBalance,
      finalBalance: running,
      rows: filteredRows,
    };
  }, [ledgerParty, db.invoices, db.invLines, db.payments, ledgerFrom, ledgerTo]);

  return (
    <div className="space-y-5">
      {/* Header Tabs & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setTab('customer')}
            className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ${
              tab === 'customer'
                ? 'bg-emerald-700 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tr('customers')}
          </button>
          <button
            type="button"
            onClick={() => setTab('supplier')}
            className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ${
              tab === 'supplier'
                ? 'bg-emerald-700 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tr('suppliers')}
          </button>
        </div>

        <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
          <div className="relative flex-1 sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tr('search')}
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-3 text-xs focus:border-emerald-600 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={openAddParty}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            {tr('addParty')}
          </button>
        </div>
      </div>

      {/* Parties Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="py-3 px-4 text-left font-semibold">{tr('partyName')}</th>
                <th className="py-3 px-3 text-left font-semibold">{tr('phone')}</th>
                <th className="py-3 px-3 text-left font-semibold">{tr('address')}</th>
                <th className="py-3 px-3 text-right font-semibold">{tr('openingBalance')}</th>
                <th className="py-3 px-3 text-right font-semibold">{tr('currentBalance')}</th>
                <th className="py-3 px-4 text-right font-semibold">{tr('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {partiesWithBal.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    {tr('noData')}
                  </td>
                </tr>
              ) : (
                partiesWithBal.map(({ party, balance }) => {
                  const statusText =
                    balance > 0
                      ? tr('due')
                      : balance < 0
                        ? tr('advance')
                        : tr('settled');
                  const waMsg = `${db.settings.companyName}\nDear ${party.name}, your current account balance (${statusText}) is ${fmt(Math.abs(balance))}.`;

                  return (
                    <tr key={party.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-slate-900">
                          {party.name}
                        </div>
                        {party.isWalking && (
                          <div className="text-[11px] text-amber-700">
                            {tr('walkingMode')}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {party.phone || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {party.address || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-500">
                        {fmt(party.openingBalance)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        <span
                          className={`font-bold ${
                            balance > 0
                              ? tab === 'customer'
                                ? 'text-emerald-700'
                                : 'text-rose-700'
                              : 'text-slate-800'
                          }`}
                        >
                          {fmt(Math.abs(balance))}
                        </span>
                        <span className="ml-1.5 text-[11px] font-sans text-slate-500">
                          ({statusText})
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {!party.isWalking && (
                            <button
                              type="button"
                              onClick={() => openPayment(party, balance)}
                              title={
                                tab === 'customer'
                                  ? tr('receivePayment')
                                  : tr('makePayment')
                              }
                              className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
                            >
                              <CreditCard className="h-3 w-3" />
                              {tr('recordPayment')}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setLedgerParty(party)}
                            title={tr('partyLedger')}
                            className="rounded-md p-1.5 text-slate-600 hover:bg-slate-200"
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </button>
                          {party.phone && (
                            <a
                              href={buildWhatsAppLink(party.phone, waMsg)}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={tr('whatsappShare')}
                              className="rounded-md p-1.5 text-emerald-700 hover:bg-emerald-50"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {!party.isWalking && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditParty(party)}
                                title={tr('edit')}
                                className="rounded-md p-1.5 text-slate-600 hover:bg-slate-200"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  requestAdminAuth(() => deleteParty(party.id))
                                }
                                title={tr('delete')}
                                className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
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

      {/* Add/Edit Party Modal */}
      {partyModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-base font-bold text-slate-900">
                {editingPartyId ? tr('editParty') : tr('addParty')}
              </h3>
              <button
                type="button"
                onClick={() => setPartyModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSaveParty} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  {tr('partyName')} *
                </label>
                <input
                  type="text"
                  required
                  value={partyForm.name}
                  onChange={(e) =>
                    setPartyForm({ ...partyForm, name: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  {tr('phone')}
                </label>
                <input
                  type="text"
                  value={partyForm.phone}
                  onChange={(e) =>
                    setPartyForm({ ...partyForm, phone: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  {tr('address')}
                </label>
                <input
                  type="text"
                  value={partyForm.address}
                  onChange={(e) =>
                    setPartyForm({ ...partyForm, address: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  {tr('openingBalance')}
                </label>
                <input
                  type="number"
                  step="any"
                  value={partyForm.openingBalance}
                  onChange={(e) =>
                    setPartyForm({
                      ...partyForm,
                      openingBalance: Number(e.target.value),
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                />
              </div>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={partyForm.isWalking}
                  onChange={(e) =>
                    setPartyForm({ ...partyForm, isWalking: e.target.checked })
                  }
                  className="rounded border-slate-300 text-emerald-700"
                />
                <span>{tr('walkingMode')}</span>
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setPartyModal(false)}
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

      {/* Payment Modal */}
      {payParty && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {payParty.type === 'customer'
                    ? tr('receivePayment')
                    : tr('makePayment')}
                </h3>
                <p className="text-xs text-slate-500">{payParty.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setPayParty(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handlePaymentSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {tr('date')}
                  </label>
                  <input
                    type="date"
                    required
                    value={payForm.date}
                    onChange={(e) =>
                      setPayForm({ ...payForm, date: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {tr('paymentMethod')}
                  </label>
                  <select
                    value={payForm.methodId}
                    onChange={(e) =>
                      setPayForm({ ...payForm, methodId: e.target.value })
                    }
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {tr('amount')} *
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    required
                    value={payForm.amount}
                    onChange={(e) =>
                      setPayForm({ ...payForm, amount: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {tr('discountAdjustment')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={payForm.discount}
                    onChange={(e) =>
                      setPayForm({
                        ...payForm,
                        discount: Number(e.target.value),
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  {tr('note')}
                </label>
                <input
                  type="text"
                  value={payForm.note}
                  onChange={(e) =>
                    setPayForm({ ...payForm, note: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setPayParty(null)}
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

      {/* Party Detail Ledger Modal */}
      {ledgerParty && ledgerRows && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {tr('partyLedger')}: {ledgerParty.name}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {ledgerParty.phone || '—'} · {tr('currentBalance')}:{' '}
                  {fmt(ledgerRows.finalBalance)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPrintPayload({
                      kind: 'report',
                      title: `${tr('partyLedger')} — ${ledgerParty.name}`,
                      subtitle: `${ledgerFrom} to ${ledgerTo}`,
                      summary: [
                        { label: tr('openingBalance'), value: fmt(ledgerRows.opening) },
                        { label: tr('currentBalance'), value: fmt(ledgerRows.finalBalance) },
                      ],
                      columns: [
                        { label: tr('date') },
                        { label: tr('invoiceNo') },
                        { label: tr('description') },
                        { label: 'Dr / Bill', align: 'right' },
                        { label: 'Cr / Paid', align: 'right' },
                        { label: tr('currentBalance'), align: 'right' },
                      ],
                      rows: ledgerRows.rows.map((r) => [
                        r.date,
                        r.ref,
                        r.desc,
                        r.debit > 0 ? fmt(r.debit) : '—',
                        r.credit > 0 ? fmt(r.credit) : '—',
                        fmt(r.balance),
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
                  onClick={() => setLedgerParty(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="border-b border-slate-200 bg-slate-50 px-6 py-3 flex flex-wrap items-center gap-3 text-xs">
              <span className="font-medium text-slate-600">{tr('filter')}:</span>
              <input
                type="date"
                value={ledgerFrom}
                onChange={(e) => setLedgerFrom(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono"
              />
              <span className="text-slate-400">→</span>
              <input
                type="date"
                value={ledgerTo}
                onChange={(e) => setLedgerTo(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 text-left font-medium">{tr('date')}</th>
                    <th className="py-2 text-left font-medium">Ref</th>
                    <th className="py-2 text-left font-medium">{tr('description')}</th>
                    <th className="py-2 text-right font-medium">Bill</th>
                    <th className="py-2 text-right font-medium">Paid</th>
                    <th className="py-2 text-right font-medium">{tr('currentBalance')}</th>
                    <th className="py-2 text-right font-medium">{tr('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="bg-slate-50/70">
                    <td className="py-2 font-mono text-slate-500">
                      {ledgerParty.createdAt}
                    </td>
                    <td className="py-2">—</td>
                    <td className="py-2 font-medium text-slate-700">
                      {tr('openingBalance')}
                    </td>
                    <td className="py-2 text-right font-mono">—</td>
                    <td className="py-2 text-right font-mono">—</td>
                    <td className="py-2 text-right font-mono font-bold">
                      {fmt(ledgerRows.opening)}
                    </td>
                    <td />
                  </tr>
                  {ledgerRows.rows.map((r) => {
                    const isExpanded = expandedInvs[r.id];
                    return (
                      <React.Fragment key={r.id}>
                        <tr className="hover:bg-slate-50">
                          <td className="py-2.5 font-mono text-slate-600">
                            {r.date}
                          </td>
                          <td className="py-2.5 font-mono font-semibold text-emerald-700">
                            {r.kind === 'invoice' ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setPrintPayload({
                                    kind: 'invoice',
                                    invoiceId: r.invoiceId,
                                  })
                                }
                                className="hover:underline"
                              >
                                {r.ref}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setPrintPayload({
                                    kind: 'receipt',
                                    paymentId: r.paymentId,
                                  })
                                }
                                className="hover:underline"
                              >
                                {r.ref}
                              </button>
                            )}
                          </td>
                          <td className="py-2.5 text-slate-800">
                            <div className="flex items-center gap-1.5">
                              {r.kind === 'invoice' && r.lines.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedInvs((prev) => ({
                                      ...prev,
                                      [r.id]: !prev[r.id],
                                    }))
                                  }
                                  className="rounded p-0.5 text-slate-500 hover:bg-slate-200"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              )}
                              <span>{r.desc}</span>
                            </div>
                          </td>
                          <td className="py-2.5 text-right font-mono">
                            {r.debit > 0 ? fmt(r.debit) : '—'}
                          </td>
                          <td className="py-2.5 text-right font-mono text-emerald-700">
                            {r.credit > 0 ? fmt(r.credit) : '—'}
                          </td>
                          <td className="py-2.5 text-right font-mono font-bold text-slate-900">
                            {fmt(r.balance)}
                          </td>
                          <td className="py-2.5 text-right">
                            {r.kind === 'payment' && (
                              <button
                                type="button"
                                onClick={() =>
                                  requestAdminAuth(() =>
                                    deletePayment(r.paymentId)
                                  )
                                }
                                className="rounded p-1 text-rose-600 hover:bg-rose-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                        {r.kind === 'invoice' && isExpanded && (
                          <tr className="bg-slate-50/70">
                            <td colSpan={7} className="px-8 py-2.5">
                              <div className="space-y-1 text-[11px] text-slate-600">
                                {r.lines.map((ln) => (
                                  <div
                                    key={ln.id}
                                    className="flex justify-between font-mono"
                                  >
                                    <span className="font-sans text-slate-800">
                                      {ln.productName} × {ln.qty} @ {fmt(ln.rate)}
                                    </span>
                                    <span>{fmt(ln.total)}</span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
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
