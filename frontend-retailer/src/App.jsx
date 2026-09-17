import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './pages/Dashboard';
import { InventoryDesk } from './pages/InventoryDesk';
import { OrderFulfillment } from './pages/OrderFulfillment';
import { MLForecasts } from './pages/MLForecasts';
import { RestockRecommendations } from './pages/RestockRecommendations';
import { DiscountMarkdown } from './pages/DiscountMarkdown';
import { InventoryHealth } from './pages/InventoryHealth';
import { ScenarioSimulator } from './pages/ScenarioSimulator';
import { AuthPage } from './pages/AuthPage';
import { useAuth } from './context/AuthContext';
import { RefreshCw } from 'lucide-react';

export default function App() {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-teal-400 text-xs">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        Connecting to Stockali Retail Services...
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-slate-950 flex selection:bg-teal-500 selection:text-slate-950">
      {/* Sidebar */}
      <Sidebar currentTab={currentTab} onSelectTab={setCurrentTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header />

        <main className="flex-1 p-6 overflow-y-auto max-w-7xl w-full mx-auto">
          {currentTab === 'dashboard' && <Dashboard onNavigate={setCurrentTab} />}
          {currentTab === 'inventory' && <InventoryDesk />}
          {currentTab === 'orders' && <OrderFulfillment />}
          {currentTab === 'forecasts' && <MLForecasts />}
          {currentTab === 'restock' && <RestockRecommendations />}
          {currentTab === 'discount' && <DiscountMarkdown />}
          {currentTab === 'health' && <InventoryHealth />}
          {currentTab === 'simulator' && <ScenarioSimulator />}
        </main>
      </div>
    </div>
  );
}
