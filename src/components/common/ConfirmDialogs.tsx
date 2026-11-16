import React, { useState } from 'react';
import { ShieldAlert, CheckCircle2, AlertCircle, X, Lock } from 'lucide-react';
import { useBusiness } from '../../context/BusinessContext';

export const ConfirmDialogs: React.FC = () => {
  const {
    adminPrompt,
    closeAdminPrompt,
    verifyAndRunAdmin,
    confirmPrompt,
    closeConfirmPrompt,
    toasts,
    tr,
  } = useBusiness();

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyAndRunAdmin(password)) {
      setError(tr('wrongAdminPassword'));
      return;
    }
    setPassword('');
    setError('');
  };

  const handleCloseAdmin = () => {
    setPassword('');
    setError('');
    closeAdminPrompt();
  };

  return (
    <>
      {/* Admin Password Verification Modal */}
      {adminPrompt.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs no-print">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {tr('adminVerifyTitle')}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {tr('adminVerifyDesc')}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseAdmin}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAdminSubmit} className="mt-5 space-y-4">
              <div>
                <input
                  type="password"
                  autoFocus
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder={tr('adminPasswordPlaceholder')}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
                {error && (
                  <p className="mt-1.5 text-xs font-medium text-rose-600">
                    {error}
                  </p>
                )}
                <p className="mt-1.5 text-[11px] text-slate-400">
                  Demo Admin password: <span className="font-mono font-medium text-slate-600">123</span>
                </p>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseAdmin}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  {tr('cancel')}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap"
                >
                  {tr('confirm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Financial Commit Confirmation Modal */}
      {confirmPrompt.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs no-print">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-slate-900">
                  {confirmPrompt.title}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {confirmPrompt.details}
                </p>
                {confirmPrompt.amountLabel && (
                  <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 px-3.5 py-2.5 font-mono text-base font-bold text-slate-900 tabular-nums">
                    {confirmPrompt.amountLabel}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeConfirmPrompt}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                {tr('cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  const fn = confirmPrompt.onConfirm;
                  closeConfirmPrompt();
                  if (fn) fn();
                }}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap"
              >
                {tr('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Stack */}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 no-print pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-2.5 rounded-lg border px-4 py-3 text-xs font-medium shadow-lg transition-all ${
              toast.type === 'success'
                ? 'border-emerald-200 bg-white text-emerald-900'
                : toast.type === 'error'
                  ? 'border-rose-200 bg-rose-50 text-rose-900'
                  : 'border-slate-200 bg-white text-slate-800'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle
                className={`h-4 w-4 shrink-0 ${
                  toast.type === 'error' ? 'text-rose-600' : 'text-slate-600'
                }`}
              />
            )}
            <span>{toast.text}</span>
          </div>
        ))}
      </div>
    </>
  );
};
