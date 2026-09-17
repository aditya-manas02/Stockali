import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Package,
  TrendingDown,
  Clock,
  ShieldCheck,
  RefreshCw,
  Sliders,
} from 'lucide-react';
import { insightsService } from '../api';
import { useAuth } from '../context/AuthContext';

export const InventoryHealth = () => {
  const { activeStore } = useAuth();
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [serviceLevel, setServiceLevel] = useState(0.95);
  const [leadTimeDays, setLeadTimeDays] = useState(2.0);

  useEffect(() => {
    if (activeStore?.id) {
      loadHealth();
    }
  }, [activeStore?.id, serviceLevel, leadTimeDays]);

  const loadHealth = async () => {
    setLoading(true);
    try {
      const data = await insightsService.getInventoryHealth(
        activeStore.id,
        serviceLevel,
        leadTimeDays
      );
      setHealthData(data);
    } catch (err) {
      console.error('Failed to load health diagnostics:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRiskBadge = (risk) => {
    switch (risk) {
      case 'stockout':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            Stockout (Depleted)
          </span>
        );
      case 'critical':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-300 border border-rose-500/30">
            Critical (Below SS)
          </span>
        );
      case 'warning':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            Warning (Below ROP)
          </span>
        );
      case 'overstock':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">
            Overstock
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            Optimal Buffer
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-teal-400" />
            Store Supply Chain Diagnostics & Health Index
          </h2>
          <p className="text-xs text-slate-400">
            Holistic inventory risk analysis, days-of-supply tracking, and lost-sales revenue recovery
          </p>
        </div>
      </div>

      {/* Control Sliders Card */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-teal-400" />
              Target Service Level Guarantee ($Z_\alpha$ score)
            </span>
            <span className="font-bold text-teal-400">{(serviceLevel * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0.80"
            max="0.99"
            step="0.01"
            value={serviceLevel}
            onChange={(e) => setServiceLevel(parseFloat(e.target.value))}
            className="w-full accent-teal-500 cursor-pointer"
          />
          <span className="text-[11px] text-slate-500 mt-1 block">
            Higher service level increases Safety Stock to prevent stockouts during demand spikes.
          </span>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-400" />
              Supplier Replenishment Lead Time ($L$)
            </span>
            <span className="font-bold text-amber-400">{leadTimeDays.toFixed(1)} Days</span>
          </div>
          <input
            type="range"
            min="1.0"
            max="10.0"
            step="0.5"
            value={leadTimeDays}
            onChange={(e) => setLeadTimeDays(parseFloat(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer"
          />
          <span className="text-[11px] text-slate-500 mt-1 block">
            Days from order placement until stock arrives at your kirana shop.
          </span>
        </div>
      </div>

      {/* Diagnostic KPI Summary Cards */}
      {healthData && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-center">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Total SKUs</span>
            <p className="text-2xl font-black text-white mt-1">{healthData.total_listings}</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-center">
            <span className="text-[10px] text-rose-400 uppercase font-semibold">Stockouts</span>
            <p className="text-2xl font-black text-rose-400 mt-1">{healthData.stockout_count}</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-center">
            <span className="text-[10px] text-amber-400 uppercase font-semibold">Critical Risk</span>
            <p className="text-2xl font-black text-amber-400 mt-1">{healthData.critical_count}</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-center">
            <span className="text-[10px] text-yellow-400 uppercase font-semibold">Below ROP</span>
            <p className="text-2xl font-black text-yellow-400 mt-1">{healthData.warning_count}</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-center">
            <span className="text-[10px] text-emerald-400 uppercase font-semibold">Healthy</span>
            <p className="text-2xl font-black text-emerald-400 mt-1">{healthData.healthy_count}</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-center">
            <span className="text-[10px] text-purple-400 uppercase font-semibold">Overstock</span>
            <p className="text-2xl font-black text-purple-400 mt-1">{healthData.overstock_count}</p>
          </div>
        </div>
      )}

      {/* Listing Cards */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Package className="w-4 h-4 text-teal-400" />
          Listing Supply Chain Health Breakdown
        </h3>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-slate-900/60 animate-pulse border border-slate-800" />
            ))}
          </div>
        ) : healthData?.listings_health?.length === 0 ? (
          <p className="text-xs text-slate-500 py-8 text-center">No listings to display.</p>
        ) : (
          healthData?.listings_health?.map((item) => (
            <div
              key={item.store_product_listing_id}
              className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-bold text-white">{item.product_name}</h4>
                  {getRiskBadge(item.stockout_risk)}
                </div>
                <p className="text-xs text-slate-400">
                  {item.brand} • {item.variant_label || 'Standard Pack'} • ₹{item.current_price.toFixed(2)}
                </p>
                <p className="text-xs text-slate-300 mt-2">
                  <strong className="text-teal-400">Action:</strong> {item.recommended_action}
                </p>
              </div>

              {/* Stat Chips */}
              <div className="flex flex-wrap items-center gap-3 shrink-0 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-850 border border-slate-750 text-center min-w-[70px]">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Stock</span>
                  <p className="text-sm font-black text-white">{item.current_stock}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-850 border border-slate-750 text-center min-w-[70px]">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Safety Stock</span>
                  <p className="text-sm font-black text-teal-400">{item.safety_stock}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-850 border border-slate-750 text-center min-w-[70px]">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Reorder Pt</span>
                  <p className="text-sm font-black text-amber-400">{item.reorder_point}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-850 border border-slate-750 text-center min-w-[70px]">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Days Supply</span>
                  <p className="text-sm font-black text-white">{item.days_of_supply}d</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
