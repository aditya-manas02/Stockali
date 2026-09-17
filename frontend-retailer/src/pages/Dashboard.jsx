import React, { useState, useEffect } from 'react';
import {
  Boxes,
  TrendingUp,
  AlertTriangle,
  ClipboardCheck,
  Tag,
  ArrowUpRight,
  ShieldCheck,
  Sparkles,
  ChevronRight,
  Activity,
} from 'lucide-react';
import { insightsService, inventoryService, fulfillmentService } from '../api';
import { useAuth } from '../context/AuthContext';
import { InteractiveCatchmentMap } from '../components/InteractiveCatchmentMap';

export const Dashboard = ({ onNavigate }) => {
  const { activeStore } = useAuth();
  const [stats, setStats] = useState({
    totalListings: 0,
    pendingRestocks: 0,
    activeOrders: 0,
    discountSuggestions: 0,
    estLostRevenue: 0,
    forecastSample: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeStore?.id) {
      loadStats();
    }
  }, [activeStore?.id]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const [listings, recs, orders, discounts, health] = await Promise.all([
        inventoryService.getListings(activeStore.id, { limit: 1 }),
        insightsService.getRestockRecommendations(activeStore.id, 'pending'),
        fulfillmentService.getStoreOrders(activeStore.id),
        insightsService.getDiscountRecommendations(activeStore.id, 'pending'),
        insightsService.getInventoryHealth(activeStore.id),
      ]);

      setStats({
        totalListings: listings.total || 0,
        pendingRestocks: (recs || []).length,
        activeOrders: (orders || []).filter((o) => ['submitted', 'accepted'].includes(o.status)).length,
        discountSuggestions: (discounts || []).length,
        estLostRevenue: health.total_estimated_weekly_lost_revenue || 0,
      });
    } catch (err) {
      console.error('Error loading dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const kpis = [
    {
      title: 'Store Listings',
      value: stats.totalListings,
      subtitle: 'Active catalogue SKUs',
      icon: Boxes,
      color: 'teal',
      tab: 'inventory',
    },
    {
      title: 'Restock Action Needed',
      value: stats.pendingRestocks,
      subtitle: 'Below Reorder Point (ROP)',
      icon: AlertTriangle,
      color: 'amber',
      tab: 'restock',
    },
    {
      title: 'Pending Pickup Orders',
      value: stats.activeOrders,
      subtitle: 'Curbside lists to pack',
      icon: ClipboardCheck,
      color: 'blue',
      tab: 'orders',
    },
    {
      title: 'Dynamic Markdowns',
      value: stats.discountSuggestions,
      subtitle: 'Near-expiry perishables',
      icon: Tag,
      color: 'purple',
      tab: 'discount',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/80 p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-400 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Supply Chain Engine v2.0 Active</span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            Store Operations & Intelligence Dashboard
          </h2>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            Managing <strong className="text-white">{activeStore?.name || 'Local Kirana'}</strong>.
            Real-time demand signals, probabilistic forecasting, statistical safety stock, and automated curbside order fulfillment.
          </p>

          <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-slate-700/60 text-xs">
            <button
              onClick={() => onNavigate('forecasts')}
              className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold flex items-center gap-2 shadow-lg shadow-teal-500/20 transition"
            >
              <TrendingUp className="w-4 h-4" />
              <span>View 7-Day ML Forecasts</span>
            </button>
            <button
              onClick={() => onNavigate('simulator')}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 font-semibold flex items-center gap-2 transition"
            >
              <Activity className="w-4 h-4" />
              <span>Run Stress Simulator</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.title}
              onClick={() => onNavigate(kpi.tab)}
              className="group cursor-pointer rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 p-5 shadow-lg transition-all hover:bg-slate-850"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-400">
                  {kpi.title}
                </span>
                <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-teal-400 group-hover:scale-110 transition">
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-white mb-1">
                {kpi.value}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{kpi.subtitle}</span>
                <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-teal-400 transition" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Hyperlocal Catchment & Demand Hotspots */}
      <InteractiveCatchmentMap activeStore={activeStore} />

      {/* Quick Launch Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ML Supply Chain Optimization Card */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-teal-400" />
              Probabilistic Quantile Forecasts (P10 / P50 / P90)
            </h3>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/30">
              Active
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Unlike simple single-point predictors, our engine models lower-bound demand ($P_{10}$), median trajectory ($P_{50}$), and peak surge scenario ($P_{90}$) with geocoded catchment density and half-life recency decay.
          </p>
          <button
            onClick={() => onNavigate('forecasts')}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 font-semibold text-xs border border-teal-500/30 flex items-center justify-center gap-2 transition"
          >
            <span>Explore Store Demand Curves</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* What-If Scenario Stress Testing Card */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-400" />
              Store Shock Simulator
            </h3>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
              Interactive
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Test how a festival surge (+30%) or supplier delay (+2 days) impacts your inventory buffers. Identifies critical stockout items and calculates emergency replenishment purchase orders.
          </p>
          <button
            onClick={() => onNavigate('simulator')}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold text-xs border border-amber-500/30 flex items-center justify-center gap-2 transition"
          >
            <span>Launch What-If Simulator</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
