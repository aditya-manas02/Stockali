import React, { useState, useEffect } from 'react';
import {
  Tag,
  CheckCircle2,
  XCircle,
  Percent,
  Clock,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { insightsService } from '../api';
import { useAuth } from '../context/AuthContext';

export const DiscountMarkdown = () => {
  const { activeStore } = useAuth();
  const [discounts, setDiscounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    if (activeStore?.id) {
      loadDiscounts();
    }
  }, [activeStore?.id]);

  const loadDiscounts = async () => {
    setLoading(true);
    try {
      const data = await insightsService.getDiscountRecommendations(activeStore.id);
      setDiscounts(data || []);
    } catch (err) {
      console.error('Failed to load discounts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (recId, action) => {
    setProcessingId(recId);
    try {
      await insightsService.updateDiscountAction(activeStore.id, recId, action);
      await loadDiscounts();
    } catch (err) {
      alert('Failed to update discount recommendation.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Tag className="w-5 h-5 text-purple-400" />
            Dynamic Perishable & Slow-Mover Markdown Desk
          </h2>
          <p className="text-xs text-slate-400">
            Automated promotional discount suggestions for near-expiry perishables and excess inventory
          </p>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-40 rounded-3xl bg-slate-900/60 animate-pulse border border-slate-800" />
          ))}
        </div>
      ) : discounts.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-slate-900 border border-slate-800">
          <CheckCircle2 className="w-10 h-10 text-purple-400 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-white">No active markdown suggestions.</h3>
          <p className="text-xs text-slate-500 mt-1">
            All perishable products and stock velocities are within healthy parameters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {discounts.map((d) => {
            const isProcessing = processingId === d.id;
            return (
              <div
                key={d.id}
                className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col justify-between space-y-4 hover:border-slate-700 transition"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <h3 className="text-sm font-bold text-white">{d.product_name}</h3>
                      <p className="text-xs text-slate-400">
                        {d.brand} • {d.variant_label || 'Standard Pack'}
                      </p>
                    </div>

                    <span
                      className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border ${
                        d.reason === 'near_expiry'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {d.reason === 'near_expiry' ? 'Near Expiry' : 'Slow Mover'}
                    </span>
                  </div>

                  {/* Pricing Comparison */}
                  <div className="flex items-center gap-4 p-3 rounded-2xl bg-slate-850 border border-slate-750 my-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-black text-sm">
                      -{d.recommended_discount_pct}%
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Store Price Shift</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-500 line-through">
                          ₹{d.current_price.toFixed(2)}
                        </span>
                        <span className="text-base font-black text-emerald-400">
                          ₹{d.discounted_price.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>Status: <strong className="text-white capitalize">{d.retailer_action}</strong></span>
                  </div>
                </div>

                {d.retailer_action === 'pending' && (
                  <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleAction(d.id, 'dismissed')}
                      disabled={isProcessing}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white text-xs font-semibold transition"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={() => handleAction(d.id, 'approved')}
                      disabled={isProcessing}
                      className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-purple-500/20 transition"
                    >
                      {isProcessing ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve & Update Price</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
