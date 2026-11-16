import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Download,
  Upload,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Check,
  Code2,
  RotateCcw,
  X,
} from 'lucide-react';
import { useBusiness } from '../../context/BusinessContext';
import { ModuleId, UserAccount, UserRole } from '../../types/business';
import { GAS_CODE_GS } from '../../utils/gasTemplate';
import { todayISO } from '../../utils/calculations';

const ALL_MODULES: ModuleId[] = [
  'dashboard',
  'pos',
  'inventory',
  'parties',
  'expense',
  'loan',
  'investment',
  'methods',
  'settings',
];

export const SettingsView: React.FC = () => {
  const {
    db,
    currentUser,
    tr,
    updateSettings,
    setLanguage,
    setCurrency,
    upsertUser,
    deleteUser,
    requestAdminAuth,
    resetDemoDatabase,
    notify,
  } = useBusiness();

  const [profile, setProfile] = useState({
    companyName: db.settings.companyName,
    address: db.settings.address,
    email: db.settings.email,
    mobile: db.settings.mobile,
    terms: db.settings.terms,
    logoBase64: db.settings.logoBase64,
    usdRate: db.settings.usdRate,
  });

  const [copiedGas, setCopiedGas] = useState(false);
  const [showGasCode, setShowGasCode] = useState(false);

  // User modal
  const [userModal, setUserModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [uForm, setUForm] = useState<{
    username: string;
    password: string;
    fullName: string;
    role: UserRole;
    permissions: ModuleId[];
    active: boolean;
  }>({
    username: '',
    password: '',
    fullName: '',
    role: 'Staff',
    permissions: ['dashboard', 'pos', 'inventory'],
    active: true,
  });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setProfile((p) => ({ ...p, logoBase64: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(profile);
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    const settingsRows = Object.entries(db.settings).map(([key, value]) => ({
      key,
      value: key === 'logoBase64' ? '[BASE64_LOGO]' : String(value),
    }));

    const sheets: [string, Record<string, unknown>[]][] = [
      ['SETTINGS', settingsRows],
      [
        'USERS',
        db.users.map((u) => ({
          ...u,
          permissions: u.permissions.join(','),
        })),
      ],
      ['ATTRS', db.attrs as unknown as Record<string, unknown>[]],
      ['PRODUCTS', db.products as unknown as Record<string, unknown>[]],
      ['PARTIES', db.parties as unknown as Record<string, unknown>[]],
      ['INVOICES', db.invoices as unknown as Record<string, unknown>[]],
      ['INV_LINES', db.invLines as unknown as Record<string, unknown>[]],
      ['PAYMENTS', db.payments as unknown as Record<string, unknown>[]],
      ['METHODS', db.methods as unknown as Record<string, unknown>[]],
      ['TRANSFERS', db.transfers as unknown as Record<string, unknown>[]],
      ['EXPENSES', db.expenses as unknown as Record<string, unknown>[]],
      ['LOANS', db.loans as unknown as Record<string, unknown>[]],
      ['INVESTMENTS', db.investments as unknown as Record<string, unknown>[]],
    ];

    sheets.forEach(([name, rows]) => {
      const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ empty: '' }]);
      XLSX.utils.book_append_sheet(wb, ws, name);
    });

    XLSX.writeFile(wb, `BusinessPRO_Backup_${todayISO()}.xlsx`);
    notify('success', tr('exportExcel'));
  };

  const handleCopyGas = async () => {
    try {
      await navigator.clipboard.writeText(GAS_CODE_GS);
      setCopiedGas(true);
      setTimeout(() => setCopiedGas(false), 2000);
      notify('success', 'Code.gs copied');
    } catch {
      notify('error', 'Copy failed');
    }
  };

  const handleDownloadGas = () => {
    const blob = new Blob([GAS_CODE_GS], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Code.gs';
    a.click();
    URL.revokeObjectURL(url);
  };

  const openAddUser = () => {
    setEditingUserId(null);
    setUForm({
      username: '',
      password: '',
      fullName: '',
      role: 'Staff',
      permissions: ['dashboard', 'pos', 'inventory'],
      active: true,
    });
    setUserModal(true);
  };

  const openEditUser = (u: UserAccount) => {
    requestAdminAuth(() => {
      setEditingUserId(u.id);
      setUForm({
        username: u.username,
        password: u.password,
        fullName: u.fullName,
        role: u.role,
        permissions: u.permissions,
        active: u.active,
      });
      setUserModal(true);
    });
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uForm.username.trim() || !uForm.password.trim()) return;
    upsertUser({
      id: editingUserId || `usr-${Date.now()}`,
      username: uForm.username.trim(),
      password: uForm.password,
      fullName: uForm.fullName.trim() || uForm.username.trim(),
      role: uForm.role,
      permissions: uForm.role === 'Admin' ? ALL_MODULES : uForm.permissions,
      active: uForm.active,
    });
    setUserModal(false);
  };

  const toggleModulePerm = (mod: ModuleId) => {
    setUForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(mod)
        ? prev.permissions.filter((m) => m !== mod)
        : [...prev.permissions, mod],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Company Profile */}
        <form
          onSubmit={handleSaveProfile}
          className="rounded-xl border border-slate-200 bg-white p-6 space-y-4 text-xs"
        >
          <h3 className="text-sm font-bold text-slate-900">
            {tr('companyProfile')}
          </h3>

          <div className="flex items-center gap-4">
            {profile.logoBase64 ? (
              <img
                src={profile.logoBase64}
                alt="Company Logo"
                className="h-14 w-14 rounded-lg border border-slate-200 object-contain bg-white p-1"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-emerald-700 text-sm font-bold text-white">
                BP
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50">
                <Upload className="h-3.5 w-3.5" />
                <span>{tr('uploadLogo')}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </label>
              {profile.logoBase64 && (
                <button
                  type="button"
                  onClick={() => setProfile({ ...profile, logoBase64: '' })}
                  className="rounded-lg border border-rose-200 px-3 py-1.5 font-medium text-rose-700 hover:bg-rose-50"
                >
                  {tr('removeLogo')}
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              {tr('companyName')}
            </label>
            <input
              type="text"
              required
              value={profile.companyName}
              onChange={(e) =>
                setProfile({ ...profile, companyName: e.target.value })
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                {tr('phone')}
              </label>
              <input
                type="text"
                value={profile.mobile}
                onChange={(e) =>
                  setProfile({ ...profile, mobile: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                {tr('email')}
              </label>
              <input
                type="email"
                value={profile.email}
                onChange={(e) =>
                  setProfile({ ...profile, email: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              {tr('address')}
            </label>
            <input
              type="text"
              value={profile.address}
              onChange={(e) =>
                setProfile({ ...profile, address: e.target.value })
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              {tr('termsConditions')}
            </label>
            <textarea
              rows={3}
              value={profile.terms}
              onChange={(e) =>
                setProfile({ ...profile, terms: e.target.value })
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-lg bg-emerald-700 px-5 py-2 font-semibold text-white hover:bg-emerald-800"
            >
              {tr('save')}
            </button>
          </div>
        </form>

        {/* Localization, Currency & Export */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-900">
              {tr('localizationCurrency')}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-slate-700 mb-1.5">
                  {tr('languageLabel')}
                </label>
                <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 p-1">
                  <button
                    type="button"
                    onClick={() => setLanguage('en')}
                    className={`rounded-md py-2 font-semibold ${
                      db.settings.language === 'en'
                        ? 'bg-emerald-700 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage('bn')}
                    className={`rounded-md py-2 font-semibold ${
                      db.settings.language === 'bn'
                        ? 'bg-emerald-700 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    বাংলা
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1.5">
                  {tr('currencyLabel')}
                </label>
                <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 p-1">
                  <button
                    type="button"
                    onClick={() => setCurrency('BDT')}
                    className={`rounded-md py-2 font-semibold ${
                      db.settings.currency === 'BDT'
                        ? 'bg-emerald-700 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    BDT (৳)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrency('USD')}
                    className={`rounded-md py-2 font-semibold ${
                      db.settings.currency === 'USD'
                        ? 'bg-emerald-700 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    USD ($)
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                {tr('usdRateLabel')}
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  step="any"
                  value={profile.usdRate}
                  onChange={(e) =>
                    setProfile({ ...profile, usdRate: Number(e.target.value) })
                  }
                  className="w-40 rounded-lg border border-slate-300 px-3 py-2 font-mono"
                />
                <button
                  type="button"
                  onClick={() => updateSettings({ usdRate: profile.usdRate })}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {tr('save')}
                </button>
              </div>
            </div>
          </div>

          {/* Excel Export & GAS Code.gs */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-900">
              {tr('dataExportBackup')}
            </h3>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleExportExcel}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 font-semibold text-white hover:bg-emerald-800"
              >
                <Download className="h-4 w-4" />
                {tr('exportExcel')}
              </button>

              <button
                type="button"
                onClick={() => requestAdminAuth(resetDemoDatabase)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Demo Data
              </button>
            </div>

            <div className="border-t border-slate-200 pt-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">
                  {tr('gasStudio')}
                </span>
                <button
                  type="button"
                  onClick={() => setShowGasCode((s) => !s)}
                  className="inline-flex items-center gap-1 text-emerald-700 font-semibold hover:underline"
                >
                  <Code2 className="h-3.5 w-3.5" />
                  {showGasCode ? 'Hide Code.gs' : 'View Code.gs'}
                </button>
              </div>
              <p className="text-slate-500">
                13 Google Sheets tabs (`SETTINGS`, `USERS`, `ATTRS`, `PRODUCTS`, `PARTIES`, `INVOICES`, `INV_LINES`, `PAYMENTS`, `METHODS`, `TRANSFERS`, `EXPENSES`, `LOANS`, `INVESTMENTS`) with atomic `LockService`.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleCopyGas}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
                >
                  {copiedGas ? (
                    <Check className="h-3.5 w-3.5 text-emerald-700" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {tr('copyCodeGs')}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadGas}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  {tr('downloadCodeGs')}
                </button>
              </div>

              {showGasCode && (
                <pre className="mt-2 max-h-60 overflow-auto rounded-lg border border-slate-200 bg-slate-900 p-3 text-[11px] font-mono text-slate-100">
                  {GAS_CODE_GS}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* User Management */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-sm font-bold text-slate-900">
            {tr('userManagement')}
          </h3>
          <button
            type="button"
            onClick={openAddUser}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
          >
            <Plus className="h-3.5 w-3.5" />
            {tr('addUser')}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="py-3 px-4 text-left font-semibold">{tr('fullName')}</th>
                <th className="py-3 px-3 text-left font-semibold">{tr('username')}</th>
                <th className="py-3 px-3 text-left font-semibold">{tr('role')}</th>
                <th className="py-3 px-3 text-left font-semibold">{tr('moduleAccess')}</th>
                <th className="py-3 px-4 text-right font-semibold">{tr('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {db.users.map((u) => (
                <tr key={u.id}>
                  <td className="py-2.5 px-4 font-semibold text-slate-900">
                    {u.fullName}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-600">
                    {u.username}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-slate-700">
                    {u.role} · {u.active ? 'Active' : 'Disabled'}
                  </td>
                  <td className="py-2.5 px-3 text-slate-500">
                    {u.role === 'Admin'
                      ? 'All Modules'
                      : u.permissions.map((p) => tr(p)).join(', ')}
                  </td>
                  <td className="py-2.5 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditUser(u)}
                        className="rounded-md p-1.5 text-slate-600 hover:bg-slate-200"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      {u.id !== currentUser?.id && u.id !== 'usr-admin' && (
                        <button
                          type="button"
                          onClick={() =>
                            requestAdminAuth(() => deleteUser(u.id))
                          }
                          className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit User Modal */}
      {userModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-base font-bold text-slate-900">
                {editingUserId ? tr('edit') : tr('addUser')}
              </h3>
              <button
                type="button"
                onClick={() => setUserModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  {tr('fullName')} *
                </label>
                <input
                  type="text"
                  required
                  value={uForm.fullName}
                  onChange={(e) =>
                    setUForm({ ...uForm, fullName: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {tr('username')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={uForm.username}
                    onChange={(e) =>
                      setUForm({ ...uForm, username: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {tr('password')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={uForm.password}
                    onChange={(e) =>
                      setUForm({ ...uForm, password: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {tr('role')}
                  </label>
                  <select
                    value={uForm.role}
                    onChange={(e) =>
                      setUForm({ ...uForm, role: e.target.value as UserRole })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2"
                  >
                    <option value="Staff">Staff</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <div className="flex items-end pb-2">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={uForm.active}
                      onChange={(e) =>
                        setUForm({ ...uForm, active: e.target.checked })
                      }
                      className="rounded border-slate-300 text-emerald-700"
                    />
                    <span>Active</span>
                  </label>
                </div>
              </div>

              {uForm.role === 'Staff' && (
                <div>
                  <label className="block font-medium text-slate-700 mb-2">
                    {tr('moduleAccess')}
                  </label>
                  <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    {ALL_MODULES.map((mod) => (
                      <label
                        key={mod}
                        className="inline-flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={uForm.permissions.includes(mod)}
                          onChange={() => toggleModulePerm(mod)}
                          className="rounded border-slate-300 text-emerald-700"
                        />
                        <span>{tr(mod)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setUserModal(false)}
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
