import React from 'react';
import {
  LayoutDashboard,
  Boxes,
  ClipboardList,
  TrendingUp,
  PackagePlus,
  Tag,
  Activity,
  Sliders,
  Store,
  Sparkles,
} from 'lucide-react';

export const Sidebar = ({ currentTab, onSelectTab }) => {
  const navItems = [
    { id: 'dashboard', label: 'Executive Overview', icon: LayoutDashboard },
    { id: 'inventory', label: 'Inventory & Pricing Desk', icon: Boxes },
    { id: 'orders', label: 'Pickup Order Counter', icon: ClipboardList },
    { id: 'forecasts', label: 'Probabilistic ML Forecasts', icon: TrendingUp, highlight: true },
    { id: 'restock', label: 'Restock & Safety Stock (ROP)', icon: PackagePlus, highlight: true },
    { id: 'discount', label: 'Dynamic Markdown Desk', icon: Tag },
    { id: 'health', label: 'Supply Chain Diagnostics', icon: Activity, highlight: true },
    { id: 'simulator', label: 'What-If Scenario Simulator', icon: Sliders, highlight: true },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-850 flex flex-col shrink-0">
      {/* Brand Header */}
      <div className="h-16 px-5 border-b border-slate-800 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-teal-500/20">
          <Store className="w-5 h-5 text-slate-950 font-bold" />
        </div>
        <div>
          <span className="text-lg font-black text-white tracking-tight flex items-center gap-1.5">
            Stockali
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
              Retail B2B
            </span>
          </span>
          <p className="text-[11px] text-slate-400">Kirana Supply Chain AI</p>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Operations & Fulfillment
        </div>
        {navItems.slice(0, 3).map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                isActive
                  ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-teal-400' : 'text-slate-500'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}

        <div className="pt-4 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
          <span>AI & Supply Chain ML</span>
          <Sparkles className="w-3 h-3 text-teal-400" />
        </div>
        {navItems.slice(3).map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                isActive
                  ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-teal-400' : 'text-slate-500'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Model Version Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-900/60 text-[11px] text-slate-400 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
          ML Engine v2.0
        </span>
        <span className="text-[10px] text-slate-500 font-mono">P10-P90 / ROP</span>
      </div>
    </aside>
  );
};
