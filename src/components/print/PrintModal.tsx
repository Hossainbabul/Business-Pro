import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, X, MessageCircle, FileText } from 'lucide-react';
import { useBusiness } from '../../context/BusinessContext';
import { PrintConfig } from '../../types/business';
import { buildWhatsAppLink } from '../../utils/calculations';

export const PrintModal: React.FC = () => {
  const { db, printPayload, setPrintPayload, fmt, tr } = useBusiness();

  const [cfg, setCfg] = useState<PrintConfig>({
    showDesc: true,
    showSubtotal: true,
    showTax: true,
    showDiscount: true,
    showPrevDue: true,
    showTotal: true,
    showPayment: true,
    showCurrentDue: true,
    challanMode: false,
  });

  if (!printPayload) return null;

  const triggerPrint = () => {
    window.print();
  };

  const renderInvoicePrint = (invoiceId: string) => {
    const inv = db.invoices.find((i) => i.id === invoiceId);
    if (!inv) return null;
    const lines = db.invLines.filter((l) => l.invoiceId === inv.id);
    const party = db.parties.find((p) => p.id === inv.partyId);
    const methodName =
      db.methods.find((m) => m.id === inv.methodId)?.name || 'Cash';

    const qrValue = JSON.stringify({
      inv: inv.invoiceNo,
      date: inv.date,
      party: inv.partyName,
      total: inv.grandTotal,
      paid: inv.paidAmount,
      due: inv.dueAmount,
    });

    const waText = `${db.settings.companyName}\n${
      inv.type === 'sale' ? 'Sales Invoice' : 'Purchase Bill'
    }: ${inv.invoiceNo}\nDate: ${inv.date}\nParty: ${inv.partyName}\nTotal: ${fmt(
      inv.grandTotal
    )}\nPaid: ${fmt(inv.paidAmount)}\nDue: ${fmt(inv.dueAmount)}`;

    return (
      <div className="space-y-4">
        {/* Controls Toolbar (hidden on print) */}
        <div className="no-print rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setCfg((c) => ({ ...c, challanMode: !c.challanMode }))
                }
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
                  cfg.challanMode
                    ? 'bg-emerald-700 text-white border-emerald-700'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                {tr('challanMode')}
              </button>
              <a
                href={buildWhatsAppLink(party?.phone || '', waText)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                {tr('whatsappShare')}
              </a>
            </div>
            <button
              type="button"
              onClick={triggerPrint}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <Printer className="h-3.5 w-3.5" />
              {tr('print')}
            </button>
          </div>

          {!cfg.challanMode && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 border-t border-slate-200 text-xs text-slate-700">
              <span className="font-semibold text-slate-500">
                {tr('printOptions')}:
              </span>
              {(
                [
                  ['showDesc', tr('description')],
                  ['showSubtotal', tr('subtotal')],
                  ['showDiscount', tr('discount')],
                  ['showTax', tr('tax')],
                  ['showPrevDue', tr('prevDue')],
                  ['showTotal', tr('grandTotal')],
                  ['showPayment', tr('paidAmount')],
                  ['showCurrentDue', tr('currentDue')],
                ] as [keyof PrintConfig, string][]
              ).map(([key, label]) => (
                <label key={key} className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(cfg[key])}
                    onChange={(e) =>
                      setCfg((prev) => ({ ...prev, [key]: e.target.checked }))
                    }
                    className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* A4 Printable Sheet */}
        <div className="print-only-root mx-auto max-w-[794px] rounded-xl border border-slate-200 bg-white p-8 text-slate-900 shadow-xs">
          {/* Header */}
          <div className="flex items-start justify-between gap-6 border-b border-slate-200 pb-6">
            <div className="flex items-start gap-4">
              {db.settings.logoBase64 ? (
                <img
                  src={db.settings.logoBase64}
                  alt={db.settings.companyName}
                  className="h-14 w-14 rounded-lg object-contain border border-slate-200"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-emerald-700 text-lg font-bold text-white">
                  BP
                </div>
              )}
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {db.settings.companyName}
                </h2>
                <p className="text-xs text-slate-600 mt-0.5 max-w-sm">
                  {db.settings.address}
                </p>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">
                  {db.settings.mobile} · {db.settings.email}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 text-right">
              <div>
                <div className="text-lg font-bold uppercase tracking-wide text-emerald-800">
                  {cfg.challanMode
                    ? 'DELIVERY CHALLAN'
                    : inv.type === 'sale'
                      ? 'INVOICE'
                      : 'PURCHASE BILL'}
                </div>
                <div className="mt-1 font-mono text-xs font-semibold text-slate-800">
                  #{inv.invoiceNo}
                </div>
                <div className="text-xs text-slate-500 font-mono">
                  {inv.date}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 p-1.5 bg-white">
                <QRCodeSVG value={qrValue} size={60} level="M" />
              </div>
            </div>
          </div>

          {/* Bill To */}
          <div className="mt-5 grid grid-cols-2 gap-4 text-xs">
            <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-100">
              <div className="font-semibold text-slate-500 mb-1">
                {inv.type === 'sale' ? 'Bill To' : 'Supplier'}
              </div>
              <div className="text-sm font-bold text-slate-900">
                {inv.partyName}
              </div>
              {party?.phone && (
                <div className="text-slate-600 font-mono mt-0.5">
                  {party.phone}
                </div>
              )}
              {party?.address && (
                <div className="text-slate-500 mt-0.5">{party.address}</div>
              )}
            </div>
            <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-100 text-right">
              <div className="font-semibold text-slate-500 mb-1">
                Transaction Info
              </div>
              <div className="text-slate-700">
                Prepared By: <span className="font-medium">{inv.createdBy}</span>
              </div>
              {!cfg.challanMode && (
                <div className="text-slate-700 mt-0.5">
                  Method: <span className="font-medium">{methodName}</span>
                </div>
              )}
              {inv.note && (
                <div className="text-slate-500 mt-0.5">{inv.note}</div>
              )}
            </div>
          </div>

          {/* Items Table */}
          <table className="mt-6 w-full border-collapse text-xs">
            <thead>
              <tr className="border-y border-slate-300 bg-slate-100/80 text-slate-700">
                <th className="py-2.5 px-3 text-left font-semibold">#</th>
                <th className="py-2.5 px-3 text-left font-semibold">
                  {tr('productName')}
                </th>
                {cfg.showDesc && (
                  <th className="py-2.5 px-3 text-left font-semibold">
                    {tr('description')}
                  </th>
                )}
                <th className="py-2.5 px-3 text-right font-semibold">
                  {tr('qty')}
                </th>
                {!cfg.challanMode && (
                  <>
                    <th className="py-2.5 px-3 text-right font-semibold">
                      {tr('rate')}
                    </th>
                    <th className="py-2.5 px-3 text-right font-semibold">
                      {tr('amount')}
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {lines.map((ln, idx) => (
                <tr key={ln.id}>
                  <td className="py-2.5 px-3 font-mono text-slate-500">
                    {idx + 1}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-slate-900">
                    {ln.productName}
                  </td>
                  {cfg.showDesc && (
                    <td className="py-2.5 px-3 text-slate-500">
                      {ln.description || '—'}
                    </td>
                  )}
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                    {ln.qty}
                  </td>
                  {!cfg.challanMode && (
                    <>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {fmt(ln.rate)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold tabular-nums">
                        {fmt(ln.total)}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          {!cfg.challanMode && (
            <div className="mt-6 flex justify-end">
              <div className="w-64 space-y-1.5 text-xs">
                {cfg.showSubtotal && (
                  <div className="flex justify-between text-slate-600">
                    <span>{tr('subtotal')}</span>
                    <span className="font-mono tabular-nums">{fmt(inv.subtotal)}</span>
                  </div>
                )}
                {cfg.showDiscount && inv.discountAmount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>{tr('discount')}</span>
                    <span className="font-mono tabular-nums">-{fmt(inv.discountAmount)}</span>
                  </div>
                )}
                {cfg.showTax && inv.taxAmount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>
                      {tr('tax')} ({inv.taxPercent}%)
                    </span>
                    <span className="font-mono tabular-nums">+{fmt(inv.taxAmount)}</span>
                  </div>
                )}
                {cfg.showPrevDue && inv.prevDue !== 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>{tr('prevDue')}</span>
                    <span className="font-mono tabular-nums">{fmt(inv.prevDue)}</span>
                  </div>
                )}
                {cfg.showTotal && (
                  <div className="flex justify-between border-t border-slate-300 pt-2 text-sm font-bold text-slate-900">
                    <span>{tr('grandTotal')}</span>
                    <span className="font-mono tabular-nums">{fmt(inv.grandTotal)}</span>
                  </div>
                )}
                {cfg.showPayment && (
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>{tr('paidAmount')}</span>
                    <span className="font-mono tabular-nums">{fmt(inv.paidAmount)}</span>
                  </div>
                )}
                {cfg.showCurrentDue && (
                  <div className="flex justify-between border-t border-slate-200 pt-1.5 font-semibold text-slate-900">
                    <span>{tr('currentDue')}</span>
                    <span className="font-mono tabular-nums">{fmt(inv.dueAmount)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Terms & Signatures */}
          <div className="mt-10 grid grid-cols-2 gap-8 border-t border-slate-200 pt-6 text-xs">
            <div className="text-slate-500 whitespace-pre-line">
              <div className="font-semibold text-slate-700 mb-1">
                {tr('termsConditions')}
              </div>
              {db.settings.terms}
            </div>
            <div className="flex items-end justify-end gap-8 pt-6">
              <div className="text-center">
                <div className="w-32 border-t border-slate-400 pt-1 text-slate-600">
                  Receiver Signature
                </div>
              </div>
              <div className="text-center">
                <div className="w-32 border-t border-slate-400 pt-1 text-slate-600">
                  Authorized Signature
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderReceiptPrint = (paymentId: string) => {
    const pay = db.payments.find((p) => p.id === paymentId);
    if (!pay) return null;
    const methodName =
      db.methods.find((m) => m.id === pay.methodId)?.name || 'Cash';
    const party = db.parties.find((p) => p.id === pay.refId);

    const waText = `${db.settings.companyName}\nMoney Receipt: ${pay.receiptNo}\nDate: ${pay.date}\nName: ${pay.refName}\nAmount: ${fmt(pay.amount)}${pay.discount > 0 ? `\nDiscount: ${fmt(pay.discount)}` : ''}\nMethod: ${methodName}`;

    const ReceiptCard = ({ copyLabel }: { copyLabel: string }) => (
      <div className="rounded-xl border border-slate-300 bg-white p-6 text-slate-900 print-page-break">
        <div className="flex items-start justify-between border-b border-slate-200 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {db.settings.companyName}
            </h3>
            <p className="text-[11px] text-slate-500">
              {db.settings.address} · {db.settings.mobile}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              {tr('moneyReceipt')} — {copyLabel}
            </div>
            <div className="font-mono text-xs font-semibold text-slate-700 mt-0.5">
              {pay.receiptNo} · {pay.date}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-slate-500">
              {pay.direction === 'in' ? 'Received From:' : 'Paid To:'}
            </span>
            <div className="font-semibold text-sm text-slate-900 mt-0.5">
              {pay.refName}
            </div>
          </div>
          <div className="text-right">
            <span className="text-slate-500">{tr('paymentMethod')}:</span>
            <div className="font-semibold text-slate-900 mt-0.5">
              {methodName}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-xs">
          <div>
            <span className="text-slate-500">{tr('note')}:</span>{' '}
            <span className="text-slate-800">{pay.note || 'Payment settled'}</span>
          </div>
          <div className="text-right font-mono tabular-nums">
            <div className="text-base font-bold text-emerald-800">
              {fmt(pay.amount)}
            </div>
            {pay.discount > 0 && (
              <div className="text-[11px] text-slate-500">
                {tr('discount')}: {fmt(pay.discount)}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between text-[11px] text-slate-500 pt-4">
          <span>Prepared by: {pay.createdBy}</span>
          <span className="border-t border-slate-400 px-6 pt-1">
            Authorized Signature
          </span>
        </div>
      </div>
    );

    return (
      <div className="space-y-4">
        <div className="no-print flex items-center justify-end gap-2">
          <a
            href={buildWhatsAppLink(party?.phone || '', waText)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {tr('whatsappShare')}
          </a>
          <button
            type="button"
            onClick={triggerPrint}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <Printer className="h-3.5 w-3.5" />
            {tr('print')}
          </button>
        </div>

        <div className="print-only-root mx-auto max-w-[794px] space-y-6">
          <ReceiptCard copyLabel={tr('partyCopy')} />
          <div className="border-t-2 border-dashed border-slate-300" />
          <ReceiptCard copyLabel={tr('officeCopy')} />
        </div>
      </div>
    );
  };

  const renderReportPrint = (
    payload: Extract<typeof printPayload, { kind: 'report' }>
  ) => (
    <div className="space-y-4">
      <div className="no-print flex justify-end">
        <button
          type="button"
          onClick={triggerPrint}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          <Printer className="h-3.5 w-3.5" />
          {tr('print')}
        </button>
      </div>

      <div className="print-only-root mx-auto max-w-[794px] rounded-xl border border-slate-200 bg-white p-8 text-slate-900">
        <div className="flex items-start justify-between border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {db.settings.companyName}
            </h2>
            <p className="text-xs text-slate-500">
              {db.settings.address} · {db.settings.mobile}
            </p>
          </div>
          <div className="text-right">
            <h3 className="text-base font-bold text-emerald-800">
              {payload.title}
            </h3>
            {payload.subtitle && (
              <p className="text-xs text-slate-500 mt-0.5">{payload.subtitle}</p>
            )}
          </div>
        </div>

        {payload.summary && payload.summary.length > 0 && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {payload.summary.map((s) => (
              <div
                key={s.label}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <div className="text-[11px] text-slate-500">{s.label}</div>
                <div className="text-sm font-bold font-mono text-slate-900 tabular-nums mt-0.5">
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        )}

        <table className="mt-5 w-full border-collapse text-xs">
          <thead>
            <tr className="border-y border-slate-300 bg-slate-100 text-slate-700">
              {payload.columns.map((col, idx) => (
                <th
                  key={idx}
                  className={`py-2 px-2.5 font-semibold ${
                    col.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {payload.rows.map((row, rIdx) => (
              <tr key={rIdx}>
                {row.map((cell, cIdx) => (
                  <td
                    key={cIdx}
                    className={`py-2 px-2.5 tabular-nums ${
                      payload.columns[cIdx]?.align === 'right'
                        ? 'text-right font-mono'
                        : 'text-left'
                    }`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/65 p-4 backdrop-blur-xs">
      <div className="mx-auto max-w-4xl">
        <div className="no-print mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-white">
            {tr('testPrint')} (A4)
          </span>
          <button
            type="button"
            onClick={() => setPrintPayload(null)}
            className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/25"
          >
            <X className="h-4 w-4" />
            {tr('close')}
          </button>
        </div>

        {printPayload.kind === 'invoice' &&
          renderInvoicePrint(printPayload.invoiceId)}
        {printPayload.kind === 'receipt' &&
          renderReceiptPrint(printPayload.paymentId)}
        {printPayload.kind === 'report' && renderReportPrint(printPayload)}
      </div>
    </div>
  );
};
