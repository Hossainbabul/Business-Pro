import {
  BusinessDatabase,
  CurrencyCode,
  Invoice,
  InvoiceLine,
  Party,
  Product,
} from '../types/business';

export function formatMoney(
  amountBdt: number,
  currency: CurrencyCode,
  usdRate = 120
): string {
  const safeRate = usdRate > 0 ? usdRate : 120;
  const val = currency === 'USD' ? amountBdt / safeRate : amountBdt;
  const symbol = currency === 'USD' ? '$' : '৳';
  const absFormatted = Math.abs(val).toLocaleString('en-US', {
    minimumFractionDigits: currency === 'USD' ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return val < 0 ? `-${symbol}${absFormatted}` : `${symbol}${absFormatted}`;
}

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface ProductStats {
  product: Product;
  purchasedQty: number;
  soldQty: number;
  currentStock: number;
  stockValue: number;
  salesRevenue: number;
  profit: number;
  status: 'healthy' | 'low' | 'out';
}

export function computeProductStats(
  products: Product[],
  invoices: Invoice[],
  invLines: InvoiceLine[]
): ProductStats[] {
  const invMap = new Map<string, Invoice>();
  invoices.forEach((inv) => invMap.set(inv.id, inv));

  const agg = new Map<
    string,
    { purchased: number; sold: number; revenue: number; costOfSold: number }
  >();

  invLines.forEach((line) => {
    const inv = invMap.get(line.invoiceId);
    if (!inv) return;
    const cur = agg.get(line.productId) || {
      purchased: 0,
      sold: 0,
      revenue: 0,
      costOfSold: 0,
    };
    if (inv.type === 'purchase') {
      cur.purchased += line.qty;
    } else {
      cur.sold += line.qty;
      cur.revenue += line.total;
      cur.costOfSold += line.qty * line.costRate;
    }
    agg.set(line.productId, cur);
  });

  return products.map((product) => {
    const data = agg.get(product.id) || {
      purchased: 0,
      sold: 0,
      revenue: 0,
      costOfSold: 0,
    };
    const currentStock = product.openingStock + data.purchased - data.sold;
    const stockValue = Math.max(0, currentStock) * product.buyPrice;
    const profit = data.revenue - data.costOfSold;
    const status: 'healthy' | 'low' | 'out' =
      currentStock <= 0
        ? 'out'
        : currentStock <= product.reorderLevel
          ? 'low'
          : 'healthy';
    return {
      product,
      purchasedQty: data.purchased,
      soldQty: data.sold,
      currentStock,
      stockValue,
      salesRevenue: data.revenue,
      profit,
      status,
    };
  });
}

export function computePartyBalance(
  party: Party,
  db: BusinessDatabase
): number {
  // Positive balance = Receivable (for customer: customer owes us) or Payable (for supplier: we owe supplier)
  let balance = party.openingBalance;

  db.invoices.forEach((inv) => {
    if (inv.partyId !== party.id) return;
    const netInvoice = inv.subtotal - inv.discountAmount + inv.taxAmount;
    if (
      (party.type === 'customer' && inv.type === 'sale') ||
      (party.type === 'supplier' && inv.type === 'purchase')
    ) {
      balance += netInvoice - inv.paidAmount;
    }
  });

  db.payments.forEach((pay) => {
    if (pay.category !== 'party' || pay.refId !== party.id) return;
    balance -= pay.amount + pay.discount;
  });

  return Math.round(balance * 100) / 100;
}

export interface MethodLedgerEntry {
  id: string;
  date: string;
  source: string;
  description: string;
  inAmount: number;
  outAmount: number;
  runningBalance: number;
}

export function computeMethodLedger(
  methodId: string,
  db: BusinessDatabase
): { balance: number; entries: MethodLedgerEntry[] } {
  const method = db.methods.find((m) => m.id === methodId);
  const opening = method?.openingBalance ?? 0;

  const raw: Omit<MethodLedgerEntry, 'runningBalance'>[] = [];

  db.invoices.forEach((inv) => {
    if (inv.methodId !== methodId || inv.paidAmount <= 0) return;
    raw.push({
      id: `inv-${inv.id}`,
      date: inv.date,
      source: inv.type === 'sale' ? 'Sale Invoice' : 'Purchase Bill',
      description: `${inv.invoiceNo} · ${inv.partyName}`,
      inAmount: inv.type === 'sale' ? inv.paidAmount : 0,
      outAmount: inv.type === 'purchase' ? inv.paidAmount : 0,
    });
  });

  db.payments.forEach((pay) => {
    if (pay.methodId !== methodId || pay.amount <= 0) return;
    raw.push({
      id: `pay-${pay.id}`,
      date: pay.date,
      source: pay.category === 'party' ? 'Party Payment' : pay.category === 'investment' ? 'Investment' : 'Loan',
      description: `${pay.receiptNo} · ${pay.refName}`,
      inAmount: pay.direction === 'in' ? pay.amount : 0,
      outAmount: pay.direction === 'out' ? pay.amount : 0,
    });
  });

  db.expenses.forEach((exp) => {
    if (exp.methodId !== methodId || exp.amount <= 0) return;
    raw.push({
      id: `exp-${exp.id}`,
      date: exp.date,
      source: 'Expense',
      description: `${exp.category} · ${exp.title}`,
      inAmount: 0,
      outAmount: exp.amount,
    });
  });

  db.loans.forEach((loan) => {
    if (loan.methodId !== methodId || loan.principal <= 0) return;
    raw.push({
      id: `loan-${loan.id}`,
      date: loan.date,
      source: loan.direction === 'taken' ? 'Loan Taken' : 'Loan Given',
      description: loan.personName,
      inAmount: loan.direction === 'taken' ? loan.principal : 0,
      outAmount: loan.direction === 'given' ? loan.principal : 0,
    });
  });

  db.investments.forEach((inv) => {
    if (inv.methodId !== methodId || inv.capitalAmount <= 0) return;
    raw.push({
      id: `invest-${inv.id}`,
      date: inv.date,
      source: 'Investor Capital',
      description: inv.investorName,
      inAmount: inv.capitalAmount,
      outAmount: 0,
    });
  });

  db.transfers.forEach((tr) => {
    if (tr.fromMethodId === methodId) {
      const toName = db.methods.find((m) => m.id === tr.toMethodId)?.name || 'Account';
      raw.push({
        id: `tr-out-${tr.id}`,
        date: tr.date,
        source: 'Transfer Out',
        description: `To ${toName}${tr.note ? ` · ${tr.note}` : ''}`,
        inAmount: 0,
        outAmount: tr.amount,
      });
    }
    if (tr.toMethodId === methodId) {
      const fromName = db.methods.find((m) => m.id === tr.fromMethodId)?.name || 'Account';
      raw.push({
        id: `tr-in-${tr.id}`,
        date: tr.date,
        source: 'Transfer In',
        description: `From ${fromName}${tr.note ? ` · ${tr.note}` : ''}`,
        inAmount: tr.amount,
        outAmount: 0,
      });
    }
  });

  raw.sort((a, b) => a.date.localeCompare(b.date));

  let running = opening;
  const entries: MethodLedgerEntry[] = raw.map((item) => {
    running += item.inAmount - item.outAmount;
    return { ...item, runningBalance: Math.round(running * 100) / 100 };
  });

  return {
    balance: Math.round(running * 100) / 100,
    entries,
  };
}

export function computeMethodBalance(methodId: string, db: BusinessDatabase): number {
  return computeMethodLedger(methodId, db).balance;
}

export function computeCombinedBalance(db: BusinessDatabase): number {
  return db.methods.reduce((sum, m) => sum + computeMethodBalance(m.id, db), 0);
}

export interface CashbookEntry {
  id: string;
  date: string;
  type: string;
  particulars: string;
  methodName: string;
  cashIn: number;
  cashOut: number;
}

export function computeCashbookEntries(db: BusinessDatabase): CashbookEntry[] {
  const methodName = (id: string) =>
    db.methods.find((m) => m.id === id)?.name || 'Cash';
  const rows: CashbookEntry[] = [];

  db.invoices.forEach((inv) => {
    if (inv.paidAmount <= 0) return;
    rows.push({
      id: `cb-inv-${inv.id}`,
      date: inv.date,
      type: inv.type === 'sale' ? 'Sale' : 'Purchase',
      particulars: `${inv.invoiceNo} · ${inv.partyName}`,
      methodName: methodName(inv.methodId),
      cashIn: inv.type === 'sale' ? inv.paidAmount : 0,
      cashOut: inv.type === 'purchase' ? inv.paidAmount : 0,
    });
  });

  db.payments.forEach((pay) => {
    if (pay.amount <= 0) return;
    rows.push({
      id: `cb-pay-${pay.id}`,
      date: pay.date,
      type: pay.direction === 'in' ? 'Receipt' : 'Payout',
      particulars: `${pay.receiptNo} · ${pay.refName}`,
      methodName: methodName(pay.methodId),
      cashIn: pay.direction === 'in' ? pay.amount : 0,
      cashOut: pay.direction === 'out' ? pay.amount : 0,
    });
  });

  db.expenses.forEach((exp) => {
    rows.push({
      id: `cb-exp-${exp.id}`,
      date: exp.date,
      type: 'Expense',
      particulars: `${exp.category} · ${exp.title}`,
      methodName: methodName(exp.methodId),
      cashIn: 0,
      cashOut: exp.amount,
    });
  });

  db.loans.forEach((loan) => {
    rows.push({
      id: `cb-loan-${loan.id}`,
      date: loan.date,
      type: loan.direction === 'taken' ? 'Loan Taken' : 'Loan Given',
      particulars: loan.personName,
      methodName: methodName(loan.methodId),
      cashIn: loan.direction === 'taken' ? loan.principal : 0,
      cashOut: loan.direction === 'given' ? loan.principal : 0,
    });
  });

  db.investments.forEach((inv) => {
    rows.push({
      id: `cb-invest-${inv.id}`,
      date: inv.date,
      type: 'Investment',
      particulars: inv.investorName,
      methodName: methodName(inv.methodId),
      cashIn: inv.capitalAmount,
      cashOut: 0,
    });
  });

  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const clean = phone.replace(/[^\d+]/g, '').replace(/^\+/, '');
  const encoded = encodeURIComponent(message);
  return clean ? `https://wa.me/${clean}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}
