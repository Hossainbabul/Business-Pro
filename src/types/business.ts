export type Language = 'en' | 'bn';
export type CurrencyCode = 'BDT' | 'USD';

export type ModuleId =
  | 'dashboard'
  | 'pos'
  | 'inventory'
  | 'parties'
  | 'expense'
  | 'loan'
  | 'investment'
  | 'methods'
  | 'settings';

export type UserRole = 'Admin' | 'Staff';

export interface CompanySettings {
  companyName: string;
  address: string;
  email: string;
  mobile: string;
  terms: string;
  logoBase64: string;
  language: Language;
  currency: CurrencyCode;
  usdRate: number; // 1 USD = X BDT (base storage in BDT)
}

export interface UserAccount {
  id: string;
  username: string;
  password: string;
  fullName: string;
  role: UserRole;
  permissions: ModuleId[];
  active: boolean;
}

export type AttrType = 'category' | 'brand' | 'color' | 'size' | 'expense_cat';

export interface ProductAttr {
  id: string;
  type: AttrType;
  name: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  brand: string;
  color: string;
  size: string;
  buyPrice: number;
  sellPrice: number;
  openingStock: number;
  reorderLevel: number;
  createdAt: string;
}

export type PartyType = 'customer' | 'supplier';

export interface Party {
  id: string;
  type: PartyType;
  name: string;
  phone: string;
  address: string;
  openingBalance: number; // Positive means receivable (customer owes us) or payable (we owe supplier)
  isWalking: boolean;
  createdAt: string;
}

export type InvoiceType = 'sale' | 'purchase';

export interface Invoice {
  id: string;
  invoiceNo: string;
  type: InvoiceType;
  date: string; // YYYY-MM-DD
  partyId: string;
  partyName: string;
  subtotal: number;
  discountType: 'percent' | 'flat';
  discountValue: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
  prevDue: number;
  grandTotal: number;
  paidAmount: number;
  methodId: string;
  dueAmount: number;
  note: string;
  createdBy: string;
  createdAt: string;
}

export interface InvoiceLine {
  id: string;
  invoiceId: string;
  productId: string;
  productName: string;
  description: string;
  qty: number;
  rate: number;
  costRate: number;
  total: number;
}

export type PaymentCategory = 'party' | 'loan_given' | 'loan_taken' | 'investment';

export interface PaymentRecord {
  id: string;
  receiptNo: string;
  date: string;
  category: PaymentCategory;
  refId: string; // partyId, loanId, or investorId
  refName: string;
  direction: 'in' | 'out';
  amount: number;
  discount: number;
  methodId: string;
  note: string;
  createdBy: string;
  createdAt: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  accountNo: string;
  openingBalance: number;
  isDefault?: boolean;
}

export interface FundTransfer {
  id: string;
  date: string;
  fromMethodId: string;
  toMethodId: string;
  amount: number;
  note: string;
  createdBy: string;
  createdAt: string;
}

export interface ExpenseRecord {
  id: string;
  date: string;
  category: string;
  title: string;
  amount: number;
  methodId: string;
  note: string;
  createdBy: string;
  createdAt: string;
}

export type LoanDirection = 'given' | 'taken';

export interface LoanRecord {
  id: string;
  date: string;
  direction: LoanDirection;
  personName: string;
  phone: string;
  principal: number;
  interestRate: number;
  methodId: string;
  note: string;
  createdBy: string;
  createdAt: string;
}

export interface InvestmentRecord {
  id: string;
  date: string;
  investorName: string;
  phone: string;
  capitalAmount: number;
  sharePercent: number;
  methodId: string;
  note: string;
  createdBy: string;
  createdAt: string;
}

export interface BusinessDatabase {
  settings: CompanySettings;
  users: UserAccount[];
  attrs: ProductAttr[];
  products: Product[];
  parties: Party[];
  invoices: Invoice[];
  invLines: InvoiceLine[];
  payments: PaymentRecord[];
  methods: PaymentMethod[];
  transfers: FundTransfer[];
  expenses: ExpenseRecord[];
  loans: LoanRecord[];
  investments: InvestmentRecord[];
}

export interface PrintConfig {
  showDesc: boolean;
  showSubtotal: boolean;
  showTax: boolean;
  showDiscount: boolean;
  showPrevDue: boolean;
  showTotal: boolean;
  showPayment: boolean;
  showCurrentDue: boolean;
  challanMode: boolean;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}
