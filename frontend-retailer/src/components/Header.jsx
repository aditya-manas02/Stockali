import React from 'react';
import {
  Store,
  LogOut,
  ChevronDown,
  UserCheck,
  Building2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Header = () => {
  const { user, stores, activeStore, selectStore, logout } = useAuth();

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between">
      {/* Store Switcher */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Store className="w-4 h-4 text-teal-400" />
          <span className="text-xs text-slate-400">Store:</span>
        </div>
        {stores.length > 1 ? (
          <select
            value={activeStore?.id || ''}
            onChange={(e) => {
              const selected = stores.find((s) => s.id === e.target.value);
              selectStore(selected);
            }}
            className="bg-slate-800 border border-slate-700 text-xs text-white rounded-xl px-3 py-1.5 focus:outline-none focus:border-teal-500 font-semibold"
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs font-bold text-white bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
            {activeStore ? activeStore.name : 'Store'}
          </span>
        )}

        <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live Connected
        </span>
      </div>

      {/* User profile & Logout */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold text-xs border border-teal-500/30">
            {user?.full_name ? user.full_name[0].toUpperCase() : 'R'}
          </div>
          <div className="hidden md:block text-right">
            <p className="text-xs font-bold text-white leading-tight">
              {user?.full_name || 'Retailer'}
            </p>
            <p className="text-[10px] text-slate-400 leading-tight capitalize">
              {user?.role?.replace('_', ' ') || 'Store Owner'}
            </p>
          </div>
        </div>

        <button
          onClick={logout}
          className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
