import React, { useState, useEffect } from 'react';
import {
  Sliders,
  AlertTriangle,
  Zap,
  TrendingUp,
  Clock,
  ShieldAlert,
  ShoppingBag,
  RefreshCw,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { insightsService } from '../api';
import { useAuth } from '../context/AuthContext';

export const ScenarioSimulator = () => {
  const { activeStore } = useAuth();
  const [demandSurge, setDemandSurge] = useState(30.0);
  const [leadTimeDelay, setLeadTimeDelay] = useState(2);
  const [serviceLevel, setServiceLevel] = useState(0.95);
  const [simResult, setSimResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeStore?.id) {
      runSimulation();
    }
  }, [activeStore?.id, demandSurge, leadTimeDelay, serviceLevel]);

  const runSimulation = async () => {
    setLoading(true);
    try {
      const data = await insightsService.simulateScenario(activeStore.id, {
        demand_surge_pct: demandSurge,
        lead_time_delay_days: leadTimeDelay,
        target_service_level: serviceLevel,
      });
      setSimResult(data);
    } catch (err) {
      console.error('Failed to run simulation:', err);
    } finally {
      setLoading(false);
    }
  };

  const getUrgencyBadge = (urgency) => {
    switch (urgency) {
      case 'immediate':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
            Immediate Action
          </span>
        );
      case 'high':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            High Risk
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
            Medium Priority
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-amber-400" />
            Interactive Supply Chain Shock & What-If Simulator
          </h2>
          <p className="text-xs text-slate-400">
            Stress-test your kirana inventory against localized demand spikes and supplier delivery disruptions
          </p>
        </div>
      </div>

      {/* Sliders Configuration Card */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-amber-400" />
          Simulate Market Disruption Variables
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Demand Surge Slider */}
          <div className="p-4 rounded-2xl bg-slate-850 border border-slate-750">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Demand Surge / Festival Shock
              </span>
              <span className="font-bold text-emerald-400">+{demandSurge.toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={demandSurge}
              onChange={(e) => setDemandSurge(parseFloat(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>Normal (0%)</span>
              <span>Diwali / Festival (+100%)</span>
            </div>
          </div>

          {/* Supplier Lead Time Delay Slider */}
          <div className="p-4 rounded-2xl bg-slate-850 border border-slate-750">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-rose-400" />
                Supplier Delivery Delay
              </span>
              <span className="font-bold text-rose-400">+{leadTimeDelay} Days</span>
            </div>
            <input
              type="range"
              min="0"
              max="7"
              step="1"
              value={leadTimeDelay}
              onChange={(e) => setLeadTimeDelay(parseInt(e.target.value))}
              className="w-full accent-rose-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>On Time (0d)</span>
              <span>Major Backlog (+7d)</span>
            </div>
          </div>

          {/* Service Level Slider */}
          <div className="p-4 rounded-2xl bg-slate-850 border border-slate-750">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-teal-400" />
                Target Service Level
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
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>80% Buffer</span>
              <span>99% Zero-Stockout Target</span>
            </div>
          </div>
        </div>
      </div>

      {/* Simulation Results */}
      {simResult && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Baseline Stockouts</span>
              <p className="text-2xl font-black text-slate-300 mt-1">
                {simResult.baseline_stockout_items_count} SKUs
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
              <span className="text-[10px] text-rose-400 uppercase font-semibold">Projected Stockouts</span>
              <p className="text-2xl font-black text-rose-400 mt-1">
                {simResult.projected_stockout_items_count} SKUs
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
              <span className="text-[10px] text-amber-400 uppercase font-semibold">Additional At-Risk</span>
              <p className="text-2xl font-black text-amber-400 mt-1">
                +{simResult.additional_stockouts_count} SKUs
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
              <span className="text-[10px] text-teal-400 uppercase font-semibold">Projected Lost Revenue</span>
              <p className="text-2xl font-black text-teal-400 mt-1">
                ₹{simResult.projected_weekly_lost_revenue.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Emergency Orders List */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-amber-400" />
                Recommended Emergency Purchase Orders ({simResult.recommended_emergency_orders?.length || 0})
              </h3>
              <span className="text-xs text-slate-500">Auto-calculated to absorb shock</span>
            </div>

            {simResult.recommended_emergency_orders?.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                Your current stock buffers can fully withstand this simulated surge without emergency replenishment!
              </p>
            ) : (
              <div className="space-y-3">
                {simResult.recommended_emergency_orders.map((eo) => (
                  <div
                    key={eo.store_product_listing_id}
                    className="p-4 rounded-2xl bg-slate-850 border border-slate-750 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-white">{eo.product_name}</h4>
                        {getUrgencyBadge(eo.urgency)}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Current stock: {eo.current_stock} units • Stockout expected in: <strong className="text-white">{eo.stockout_in_days} days</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-xs shrink-0">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block text-right">
                          Emergency Order
                        </span>
                        <span className="text-sm font-black text-teal-400">
                          +{eo.recommended_emergency_order_qty} units
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
