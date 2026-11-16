/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BusinessProvider, useBusiness } from './context/BusinessContext';
import { LoginScreen } from './components/auth/LoginScreen';
import { AppShell } from './components/layout/AppShell';
import { ConfirmDialogs } from './components/common/ConfirmDialogs';
import { PrintModal } from './components/print/PrintModal';
import { DashboardView } from './components/modules/DashboardView';
import { PosView } from './components/modules/PosView';
import { InventoryView } from './components/modules/InventoryView';
import { PartiesView } from './components/modules/PartiesView';
import { ExpensesView } from './components/modules/ExpensesView';
import { LoansView } from './components/modules/LoansView';
import { InvestmentsView } from './components/modules/InvestmentsView';
import { MethodsView } from './components/modules/MethodsView';
import { SettingsView } from './components/modules/SettingsView';

const BusinessProRouter: React.FC = () => {
  const { currentUser, activeModule } = useBusiness();

  if (!currentUser) {
    return (
      <>
        <LoginScreen />
        <ConfirmDialogs />
      </>
    );
  }

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard':
        return <DashboardView />;
      case 'pos':
        return <PosView />;
      case 'inventory':
        return <InventoryView />;
      case 'parties':
        return <PartiesView />;
      case 'expense':
        return <ExpensesView />;
      case 'loan':
        return <LoansView />;
      case 'investment':
        return <InvestmentsView />;
      case 'methods':
        return <MethodsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <>
      <AppShell>{renderModule()}</AppShell>
      <ConfirmDialogs />
      <PrintModal />
    </>
  );
};

export default function App() {
  return (
    <BusinessProvider>
      <BusinessProRouter />
    </BusinessProvider>
  );
}
