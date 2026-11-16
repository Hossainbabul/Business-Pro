import React, { useState } from 'react';
import { Lock, User, ArrowRight, Globe } from 'lucide-react';
import { useBusiness } from '../../context/BusinessContext';

export const LoginScreen: React.FC = () => {
  const { db, login, setLanguage, tr } = useBusiness();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('123');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = login(username, password, rememberMe);
    if (!ok) {
      setError(tr('invalidCredentials'));
    } else {
      setError('');
    }
  };

  const quickFill = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError('');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-4 sm:p-8">
      <div className="flex items-center justify-between max-w-5xl w-full mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-700 text-sm font-bold text-white">
            BP
          </div>
          <span className="text-base font-bold tracking-tight text-slate-900">
            {tr('appName')}
          </span>
        </div>

        <button
          type="button"
          onClick={() =>
            setLanguage(db.settings.language === 'en' ? 'bn' : 'en')
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          <Globe className="h-3.5 w-3.5 text-emerald-700" />
          {db.settings.language === 'en' ? 'বাংলা' : 'English'}
        </button>
      </div>

      <div className="mx-auto w-full max-w-md my-8">
        <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
          <h1 className="text-xl font-bold text-slate-900">
            {tr('loginTitle')}
          </h1>
          <p className="mt-1.5 text-xs text-slate-500">
            {tr('loginSubtitle')}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                {tr('username')}
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                {tr('password')}
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                />
                <span>{tr('rememberMe')}</span>
              </label>
            </div>

            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 transition-colors"
            >
              <span>{tr('signIn')}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="mt-6 border-t border-slate-200 pt-4">
            <div className="text-[11px] font-medium text-slate-500 mb-2">
              {tr('quickDemoFill')}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => quickFill('admin', '123')}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs hover:bg-slate-100"
              >
                <div className="font-semibold text-slate-800">admin / 123</div>
                <div className="text-[11px] text-slate-500 truncate">
                  {tr('adminDemo')}
                </div>
              </button>
              <button
                type="button"
                onClick={() => quickFill('staff', '123')}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs hover:bg-slate-100"
              >
                <div className="font-semibold text-slate-800">staff / 123</div>
                <div className="text-[11px] text-slate-500 truncate">
                  {tr('staffDemo')}
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-slate-400">
        {db.settings.companyName} · {tr('tagline')}
      </div>
    </div>
  );
};
