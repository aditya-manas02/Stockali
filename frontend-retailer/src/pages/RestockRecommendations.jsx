import React, { useState, useEffect } from 'react';
import {
  PackagePlus,
  CheckCircle2,
  XCircle,
  Sliders,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  X,
} from 'lucide-react';
import { insightsService } from '../api';
import { useAuth } from '../context/AuthContext';

export const RestockRecommendations = () => {
  const { activeStore } = useAuth();
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('pending');
  const [adjustModal, setAdjustModal] = useState(null); // rec object
  const [adjustedQty, setAdjustedQty] = useState('');
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    if (activeStore?.id) {
      loadRecs();
    }
  }, [activeStore?.id, filterAction]);

  const loadRecs = async () => {
    setLoading(true);
    try {
      const data = await insightsService.getRestockRecommendations(
        activeStore.id,
        filterAction === 'all' ? null : filterAction
      );
      setRecs(data || []);
    } catch (err) {
      console.error('Failed to load restock recs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (recId, action, newQty = null) => {
    setProcessingId(recId);
    try {
      await insightsService.updateRestockAction(activeStore.id, recId, action, newQty);
      await loadRecs();
      if (adjustModal) setAdjustModal(null);
    } catch (err) {
      alert('Failed to update recommendation status.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <PackagePlus className="w-5 h-5 text-teal-400" />
            Restock & Safety Stock (ROP) Recommendations
          </h2>
          <p className="text-xs text-slate-400">
            Automated purchase order guidance calculated from 95% service level buffers and Economic Order Quantities (EOQ)
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2">
          {['pending', 'accepted', 'adjusted', 'all'].map((f) => (
            <button
              key={f}
              onClick={() => setFilterAction(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition ${
                filterAction === f
                  ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Recs Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-44 rounded-3xl bg-slate-900/60 animate-pulse border border-slate-800" />
          ))}
        </div>
      ) : recs.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-slate-900 border border-slate-800">
          <CheckCircle2 className="w-10 h-10 text-teal-400 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-white">No pending restock actions.</h3>
          <p className="text-xs text-slate-500 mt-1">
            All active store listings currently meet or exceed their statistical Reorder Point.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recs.map((r) => {
            const isProcessing = processingId === r.id;
            return (
              <div
                key={r.id}
                className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col justify-between space-y-4 hover:border-slate-700 transition"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        {r.product_name}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {r.brand} • {r.variant_label || 'Standard Pack'}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-teal-500/10 text-teal-400 border border-teal-500/30">
                        {r.retailer_action}
                      </span>
                      {r.confidence && (
                        <span className="block text-[10px] text-slate-400 mt-1">
                          Confidence: {(r.confidence * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stock vs Recommended Comparison */}
                  <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-slate-850 border border-slate-750 my-3 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Current Stock</span>
                      <p className="text-base font-black text-amber-400 mt-0.5">
                        {r.current_stock} units
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Recommended EOQ Order</span>
                      <p className="text-base font-black text-teal-400 mt-0.5">
                        +{r.recommended_quantity} units
                      </p>
                    </div>
                  </div>

                  {/* Explanation from Smart ML Engine */}
                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/40 p-3 rounded-xl border border-slate-800">
                    {r.explanation}
                  </p>
                </div>

                {/* Actions */}
                {r.retailer_action === 'pending' && (
                  <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleAction(r.id, 'dismissed')}
                      disabled={isProcessing}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white text-xs font-semibold transition"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={() => {
                        setAdjustModal(r);
                        setAdjustedQty(r.recommended_quantity.toString());
                      }}
                      disabled={isProcessing}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-teal-300 border border-teal-500/30 text-xs font-semibold flex items-center gap-1.5 transition"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Adjust Qty</span>
                    </button>
                    <button
                      onClick={() => handleAction(r.id, 'accepted')}
                      disabled={isProcessing}
                      className="px-4 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-teal-500/20 transition"
                    >
                      {isProcessing ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Accept Order</span>
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

      {/* Adjust Quantity Modal */}
      {adjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-sm p-6 shadow-2xl relative">
            <button
              onClick={() => setAdjustModal(null)}
              className="absolute top-4 right-4 p-1 rounded-xl text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold text-white mb-1">Adjust Order Quantity</h3>
            <p className="text-xs text-slate-400 mb-4">{adjustModal.product_name}</p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAction(adjustModal.id, 'adjusted', parseFloat(adjustedQty));
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  Adjusted Units to Purchase
                </label>
                <input
                  type="number"
                  step="1"
                  required
                  value={adjustedQty}
                  onChange={(e) => setAdjustedQty(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-teal-500"
                />
              </div>

              <button
                type="submit"
                disabled={processingId === adjustModal.id}
                className="w-full py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 transition"
              >
                Save & Accept Adjusted Quantity
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
