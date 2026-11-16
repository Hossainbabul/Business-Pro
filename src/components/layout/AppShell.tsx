import React, { useState } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Receipt,
  Landmark,
  TrendingUp,
  Wallet,
  Settings,
  LogOut,
  Menu,
  X,
  Globe,
} from 'lucide-react';
import { useBusiness } from '../../context/BusinessContext';
import { ModuleId } from '../../types/business';

const NAV_ITEMS: { id: ModuleId; icon: React.FC<{ className?: string }> }[] = [
  { id: 'dashboard', icon: LayoutDashboard },
  { id: 'pos', icon: ShoppingCart },
  { id: 'inventory', icon: Package },
  { id: 'parties', icon: Users },
  { id: 'expense', icon: Receipt },
  { id: 'loan', icon: Landmark },
  { id: 'investment', icon: TrendingUp },
  { id: 'methods', icon: Wallet },
  { id: 'settings', icon: Settings },
];

export const AppShell: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const {
    db,
    currentUser,
    activeModule,
    setActiveModule,
    hasPermission,
    setLanguage,
    setCurrency,
    logout,
    tr,
  } = useBusiness();

  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleNav = NAV_ITEMS.filter((item) => hasPermission(item.id));

  const handleSelectModule = (mod: ModuleId) => {
    setActiveModule(mod);
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="no-print hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-200 bg-white">
        <div className="flex h-14 items-center gap-2.5 border-b border-slate-200 px-5">
          {db.settings.logoBase64 ? (
            <img
              src={db.settings.logoBase64}
              alt={db.settings.companyName}
              className="h-8 w-8 rounded-md object-contain"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-700 text-xs font-bold text-white shrink-0">
              BP
            </div>
          )}
          <span className="text-sm font-bold tracking-tight text-slate-900 truncate">
            {tr('appName')}
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectModule(item.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-emerald-50 text-emerald-800 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    active ? 'text-emerald-700' : 'text-slate-400'
                  }`}
                />
                <span className="truncate">{tr(item.id)}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2.5">
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-slate-900">
                {currentUser?.fullName}
              </div>
              <div className="text-[11px] text-slate-500">
                {currentUser?.role}
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              title={tr('logout')}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 flex flex-col z-50">
            <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
              <span className="text-sm font-bold text-slate-900">
                {tr('appName')}
              </span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
              {visibleNav.map((item) => {
                const Icon = item.icon;
                const active = activeModule === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectModule(item.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium ${
                      active
                        ? 'bg-emerald-50 text-emerald-800 font-semibold'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{tr(item.id)}</span>
                  </button>
                );
              })}
            </nav>
            <div className="border-t border-slate-200 p-3">
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50"
              >
                <LogOut className="h-4 w-4" />
                <span>{tr('logout')}</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-xs sm:text-sm min-w-0">
              <span className="hidden sm:inline text-slate-400 truncate">
                {db.settings.companyName}
              </span>
              <span className="hidden sm:inline text-slate-300">/</span>
              <span className="font-semibold text-slate-900 truncate">
                {tr(activeModule)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setCurrency('BDT')}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors whitespace-nowrap ${
                  db.settings.currency === 'BDT'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                BDT ৳
              </button>
              <button
                type="button"
                onClick={() => setCurrency('USD')}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors whitespace-nowrap ${
                  db.settings.currency === 'USD'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                USD $
              </button>
            </div>

            <button
              type="button"
              onClick={() =>
                setLanguage(db.settings.language === 'en' ? 'bn' : 'en')
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Globe className="h-3.5 w-3.5 text-emerald-700" />
              <span>{db.settings.language === 'en' ? 'বাংলা' : 'EN'}</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {hasPermission(activeModule) ? (
            children
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              {tr('accessDenied')}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
