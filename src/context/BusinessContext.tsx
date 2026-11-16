import React, { createContext, useContext, useEffect, useState } from 'react';
import { createSeedDatabase } from '../data/seedData';
import { t, TranslationKey } from '../i18n/translations';
import {
  AttrType,
  BusinessDatabase,
  CompanySettings,
  CurrencyCode,
  ExpenseRecord,
  FundTransfer,
  InvestmentRecord,
  Invoice,
  InvoiceLine,
  Language,
  LoanRecord,
  ModuleId,
  Party,
  PaymentMethod,
  PaymentRecord,
  Product,
  ToastMessage,
  UserAccount,
} from '../types/business';
import { computeMethodBalance, formatMoney } from '../utils/calculations';

const DB_STORAGE_KEY = 'business_pro_db_v1';
const SESSION_STORAGE_KEY = 'business_pro_session_v1';

export type PrintModalPayload =
  | { kind: 'invoice'; invoiceId: string }
  | { kind: 'receipt'; paymentId: string }
  | {
      kind: 'report';
      title: string;
      subtitle?: string;
      columns: { label: string; align?: 'left' | 'right' }[];
      rows: (string | number)[][];
      summary?: { label: string; value: string }[];
    };

interface AdminPromptState {
  open: boolean;
  onSuccess: (() => void) | null;
}

interface ConfirmPromptState {
  open: boolean;
  title: string;
  details: string;
  amountLabel?: string;
  onConfirm: (() => void) | null;
}

interface BusinessContextValue {
  db: BusinessDatabase;
  currentUser: UserAccount | null;
  activeModule: ModuleId;
  setActiveModule: (mod: ModuleId) => void;
  editingInvoiceId: string | null;
  setEditingInvoiceId: (id: string | null) => void;
  printPayload: PrintModalPayload | null;
  setPrintPayload: (payload: PrintModalPayload | null) => void;
  toasts: ToastMessage[];
  notify: (type: ToastMessage['type'], text: string) => void;
  tr: (key: TranslationKey) => string;
  fmt: (amountBdt: number) => string;
  login: (username: string, password: string, rememberMe: boolean) => boolean;
  logout: () => void;
  hasPermission: (mod: ModuleId) => boolean;
  setLanguage: (lang: Language) => void;
  setCurrency: (curr: CurrencyCode) => void;
  updateSettings: (settings: Partial<CompanySettings>) => void;

  // Security & confirmations
  adminPrompt: AdminPromptState;
  closeAdminPrompt: () => void;
  verifyAndRunAdmin: (password: string) => boolean;
  requestAdminAuth: (action: () => void) => void;

  confirmPrompt: ConfirmPromptState;
  closeConfirmPrompt: () => void;
  requestFinancialConfirm: (
    opts: { title: string; details: string; amountLabel?: string },
    action: () => void
  ) => void;

  // Strict balance validator
  checkMethodBalance: (methodId: string, requiredAmount: number, excludeInvoiceId?: string) => boolean;

  // Atomic CRUD operations
  addAttr: (type: AttrType, name: string) => void;
  upsertProduct: (product: Product) => void;
  deleteProduct: (id: string) => void;
  upsertParty: (party: Party) => void;
  deleteParty: (id: string) => void;
  saveInvoice: (invoice: Invoice, lines: InvoiceLine[], isEdit: boolean) => void;
  deleteInvoice: (id: string) => void;
  addPayment: (payment: PaymentRecord) => void;
  deletePayment: (id: string) => void;
  upsertMethod: (method: PaymentMethod) => void;
  deleteMethod: (id: string) => void;
  addTransfer: (transfer: FundTransfer) => void;
  deleteTransfer: (id: string) => void;
  upsertExpense: (expense: ExpenseRecord) => void;
  deleteExpense: (id: string) => void;
  upsertLoan: (loan: LoanRecord) => void;
  deleteLoan: (id: string) => void;
  upsertInvestment: (inv: InvestmentRecord) => void;
  deleteInvestment: (id: string) => void;
  upsertUser: (user: UserAccount) => void;
  deleteUser: (id: string) => void;
  resetDemoDatabase: () => void;
}

const BusinessContext = createContext<BusinessContextValue | null>(null);

export const BusinessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [db, setDb] = useState<BusinessDatabase>(() => {
    try {
      const saved = localStorage.getItem(DB_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved.replaceAll('Tariqul Islam', 'Babul Hossain'));
      }
    } catch {
      // Fallback to seed
    }
    return createSeedDatabase();
  });

  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    try {
      return (
        localStorage.getItem(SESSION_STORAGE_KEY) ||
        sessionStorage.getItem(SESSION_STORAGE_KEY)
      );
    } catch {
      return null;
    }
  });

  const [activeModule, setActiveModule] = useState<ModuleId>('dashboard');
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [printPayload, setPrintPayload] = useState<PrintModalPayload | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [adminPrompt, setAdminPrompt] = useState<AdminPromptState>({
    open: false,
    onSuccess: null,
  });

  const [confirmPrompt, setConfirmPrompt] = useState<ConfirmPromptState>({
    open: false,
    title: '',
    details: '',
    onConfirm: null,
  });

  useEffect(() => {
    try {
      localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(db));
    } catch {
      // Ignore quota errors
    }
  }, [db]);

  const currentUser =
    db.users.find((u) => u.id === currentUserId && u.active) || null;

  const notify = (type: ToastMessage['type'], text: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 3600);
  };

  const tr = (key: TranslationKey) => t(db.settings.language, key);
  const fmt = (amountBdt: number) =>
    formatMoney(amountBdt, db.settings.currency, db.settings.usdRate);

  const login = (username: string, password: string, rememberMe: boolean): boolean => {
    const found = db.users.find(
      (u) =>
        u.username.toLowerCase() === username.trim().toLowerCase() &&
        u.password === password &&
        u.active
    );
    if (!found) return false;
    setCurrentUserId(found.id);
    try {
      if (rememberMe) {
        localStorage.setItem(SESSION_STORAGE_KEY, found.id);
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      } else {
        sessionStorage.setItem(SESSION_STORAGE_KEY, found.id);
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {
      // Ignore
    }
    if (!found.permissions.includes(activeModule)) {
      setActiveModule(found.permissions[0] || 'dashboard');
    }
    return true;
  };

  const logout = () => {
    setCurrentUserId(null);
    setEditingInvoiceId(null);
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Ignore
    }
  };

  const hasPermission = (mod: ModuleId): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'Admin') return true;
    return currentUser.permissions.includes(mod);
  };

  const setLanguage = (language: Language) => {
    setDb((prev) => ({
      ...prev,
      settings: { ...prev.settings, language },
    }));
  };

  const setCurrency = (currency: CurrencyCode) => {
    setDb((prev) => ({
      ...prev,
      settings: { ...prev.settings, currency },
    }));
  };

  const updateSettings = (patch: Partial<CompanySettings>) => {
    setDb((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...patch },
    }));
    notify('success', tr('save'));
  };

  // Admin password confirmation
  const requestAdminAuth = (action: () => void) => {
    setAdminPrompt({ open: true, onSuccess: action });
  };

  const closeAdminPrompt = () => {
    setAdminPrompt({ open: false, onSuccess: null });
  };

  const verifyAndRunAdmin = (password: string): boolean => {
    const valid = db.users.some(
      (u) => u.role === 'Admin' && u.active && u.password === password
    );
    if (!valid) return false;
    const cb = adminPrompt.onSuccess;
    setAdminPrompt({ open: false, onSuccess: null });
    if (cb) cb();
    return true;
  };

  // Financial commit confirmation
  const requestFinancialConfirm = (
    opts: { title: string; details: string; amountLabel?: string },
    action: () => void
  ) => {
    setConfirmPrompt({
      open: true,
      title: opts.title,
      details: opts.details,
      amountLabel: opts.amountLabel,
      onConfirm: action,
    });
  };

  const closeConfirmPrompt = () => {
    setConfirmPrompt({ open: false, title: '', details: '', onConfirm: null });
  };

  // Strict overdraft prevention
  const checkMethodBalance = (
    methodId: string,
    requiredAmount: number,
    excludeInvoiceId?: string
  ): boolean => {
    if (requiredAmount <= 0) return true;
    let available = computeMethodBalance(methodId, db);
    if (excludeInvoiceId) {
      const oldInv = db.invoices.find((i) => i.id === excludeInvoiceId);
      if (oldInv && oldInv.methodId === methodId && oldInv.type === 'purchase') {
        available += oldInv.paidAmount;
      }
    }
    return available >= requiredAmount - 0.001;
  };

  // CRUD Mutations
  const addAttr = (type: AttrType, name: string) => {
    const clean = name.trim();
    if (!clean) return;
    setDb((prev) => {
      const exists = prev.attrs.some(
        (a) => a.type === type && a.name.toLowerCase() === clean.toLowerCase()
      );
      if (exists) return prev;
      return {
        ...prev,
        attrs: [
          ...prev.attrs,
          { id: `attr-${Date.now()}`, type, name: clean },
        ],
      };
    });
  };

  const upsertProduct = (product: Product) => {
    setDb((prev) => {
      const exists = prev.products.some((p) => p.id === product.id);
      return {
        ...prev,
        products: exists
          ? prev.products.map((p) => (p.id === product.id ? product : p))
          : [product, ...prev.products],
      };
    });
    notify('success', `${product.name} ${tr('save').toLowerCase()}`);
  };

  const deleteProduct = (id: string) => {
    setDb((prev) => ({
      ...prev,
      products: prev.products.filter((p) => p.id !== id),
    }));
    notify('info', tr('delete'));
  };

  const upsertParty = (party: Party) => {
    setDb((prev) => {
      const exists = prev.parties.some((p) => p.id === party.id);
      return {
        ...prev,
        parties: exists
          ? prev.parties.map((p) => (p.id === party.id ? party : p))
          : [party, ...prev.parties],
      };
    });
    notify('success', `${party.name} ${tr('save').toLowerCase()}`);
  };

  const deleteParty = (id: string) => {
    setDb((prev) => ({
      ...prev,
      parties: prev.parties.filter((p) => p.id !== id),
    }));
    notify('info', tr('delete'));
  };

  const saveInvoice = (invoice: Invoice, lines: InvoiceLine[], isEdit: boolean) => {
    setDb((prev) => ({
      ...prev,
      invoices: isEdit
        ? prev.invoices.map((inv) => (inv.id === invoice.id ? invoice : inv))
        : [invoice, ...prev.invoices],
      invLines: [
        ...prev.invLines.filter((l) => l.invoiceId !== invoice.id),
        ...lines,
      ],
    }));
    notify('success', `${invoice.invoiceNo} ${tr('save').toLowerCase()}`);
  };

  const deleteInvoice = (id: string) => {
    setDb((prev) => ({
      ...prev,
      invoices: prev.invoices.filter((inv) => inv.id !== id),
      invLines: prev.invLines.filter((l) => l.invoiceId !== id),
    }));
    notify('info', tr('delete'));
  };

  const addPayment = (payment: PaymentRecord) => {
    setDb((prev) => ({
      ...prev,
      payments: [payment, ...prev.payments],
    }));
    notify('success', `${payment.receiptNo} ${tr('save').toLowerCase()}`);
  };

  const deletePayment = (id: string) => {
    setDb((prev) => ({
      ...prev,
      payments: prev.payments.filter((p) => p.id !== id),
    }));
    notify('info', tr('delete'));
  };

  const upsertMethod = (method: PaymentMethod) => {
    setDb((prev) => {
      const exists = prev.methods.some((m) => m.id === method.id);
      return {
        ...prev,
        methods: exists
          ? prev.methods.map((m) => (m.id === method.id ? method : m))
          : [...prev.methods, method],
      };
    });
    notify('success', `${method.name} ${tr('save').toLowerCase()}`);
  };

  const deleteMethod = (id: string) => {
    setDb((prev) => ({
      ...prev,
      methods: prev.methods.filter((m) => m.id !== id),
    }));
    notify('info', tr('delete'));
  };

  const addTransfer = (transfer: FundTransfer) => {
    setDb((prev) => ({
      ...prev,
      transfers: [transfer, ...prev.transfers],
    }));
    notify('success', tr('fundTransfer'));
  };

  const deleteTransfer = (id: string) => {
    setDb((prev) => ({
      ...prev,
      transfers: prev.transfers.filter((tItem) => tItem.id !== id),
    }));
    notify('info', tr('delete'));
  };

  const upsertExpense = (expense: ExpenseRecord) => {
    setDb((prev) => {
      const exists = prev.expenses.some((e) => e.id === expense.id);
      return {
        ...prev,
        expenses: exists
          ? prev.expenses.map((e) => (e.id === expense.id ? expense : e))
          : [expense, ...prev.expenses],
      };
    });
    notify('success', `${expense.title} ${tr('save').toLowerCase()}`);
  };

  const deleteExpense = (id: string) => {
    setDb((prev) => ({
      ...prev,
      expenses: prev.expenses.filter((e) => e.id !== id),
    }));
    notify('info', tr('delete'));
  };

  const upsertLoan = (loan: LoanRecord) => {
    setDb((prev) => {
      const exists = prev.loans.some((l) => l.id === loan.id);
      return {
        ...prev,
        loans: exists
          ? prev.loans.map((l) => (l.id === loan.id ? loan : l))
          : [loan, ...prev.loans],
      };
    });
    notify('success', `${loan.personName} ${tr('save').toLowerCase()}`);
  };

  const deleteLoan = (id: string) => {
    setDb((prev) => ({
      ...prev,
      loans: prev.loans.filter((l) => l.id !== id),
      payments: prev.payments.filter((p) => p.refId !== id),
    }));
    notify('info', tr('delete'));
  };

  const upsertInvestment = (inv: InvestmentRecord) => {
    setDb((prev) => {
      const exists = prev.investments.some((i) => i.id === inv.id);
      return {
        ...prev,
        investments: exists
          ? prev.investments.map((i) => (i.id === inv.id ? inv : i))
          : [inv, ...prev.investments],
      };
    });
    notify('success', `${inv.investorName} ${tr('save').toLowerCase()}`);
  };

  const deleteInvestment = (id: string) => {
    setDb((prev) => ({
      ...prev,
      investments: prev.investments.filter((i) => i.id !== id),
      payments: prev.payments.filter((p) => p.refId !== id),
    }));
    notify('info', tr('delete'));
  };

  const upsertUser = (user: UserAccount) => {
    setDb((prev) => {
      const exists = prev.users.some((u) => u.id === user.id);
      return {
        ...prev,
        users: exists
          ? prev.users.map((u) => (u.id === user.id ? user : u))
          : [...prev.users, user],
      };
    });
    notify('success', `${user.fullName} ${tr('save').toLowerCase()}`);
  };

  const deleteUser = (id: string) => {
    setDb((prev) => ({
      ...prev,
      users: prev.users.filter((u) => u.id !== id),
    }));
    notify('info', tr('delete'));
  };

  const resetDemoDatabase = () => {
    const fresh = createSeedDatabase();
    setDb(fresh);
    notify('info', 'Demo database reset.');
  };

  return (
    <BusinessContext.Provider
      value={{
        db,
        currentUser,
        activeModule,
        setActiveModule,
        editingInvoiceId,
        setEditingInvoiceId,
        printPayload,
        setPrintPayload,
        toasts,
        notify,
        tr,
        fmt,
        login,
        logout,
        hasPermission,
        setLanguage,
        setCurrency,
        updateSettings,
        adminPrompt,
        closeAdminPrompt,
        verifyAndRunAdmin,
        requestAdminAuth,
        confirmPrompt,
        closeConfirmPrompt,
        requestFinancialConfirm,
        checkMethodBalance,
        addAttr,
        upsertProduct,
        deleteProduct,
        upsertParty,
        deleteParty,
        saveInvoice,
        deleteInvoice,
        addPayment,
        deletePayment,
        upsertMethod,
        deleteMethod,
        addTransfer,
        deleteTransfer,
        upsertExpense,
        deleteExpense,
        upsertLoan,
        deleteLoan,
        upsertInvestment,
        deleteInvestment,
        upsertUser,
        deleteUser,
        resetDemoDatabase,
      }}
    >
      {children}
    </BusinessContext.Provider>
  );
};

export function useBusiness(): BusinessContextValue {
  const ctx = useContext(BusinessContext);
  if (!ctx) throw new Error('useBusiness must be used within BusinessProvider');
  return ctx;
}
