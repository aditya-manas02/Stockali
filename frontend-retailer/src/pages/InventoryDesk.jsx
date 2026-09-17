import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Search,
  Plus,
  Minus,
  Edit2,
  AlertCircle,
  CheckCircle2,
  History,
  X,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { inventoryService } from '../api';
import { useAuth } from '../context/AuthContext';

export const InventoryDesk = () => {
  const { activeStore } = useAuth();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeModal, setActiveModal] = useState(null); // { type: 'price' | 'stock', listing: ... }
  const [priceInput, setPriceInput] = useState('');
  const [qtyDelta, setQtyDelta] = useState('');
  const [movementReason, setMovementReason] = useState('restock');
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    if (activeStore?.id) {
      loadListings();
    }
  }, [activeStore?.id]);

  const loadListings = async () => {
    setLoading(true);
    try {
      const data = await inventoryService.getListings(activeStore.id, { limit: 50 });
      setListings(data.items || []);
    } catch (err) {
      console.error('Failed to load inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePrice = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const listing = activeModal.listing;
      const newPrice = parseFloat(priceInput);
      await inventoryService.updateListing(activeStore.id, listing.id, {
        current_price: newPrice,
      });

      setNotification({
        type: 'success',
        msg: `Price updated to ₹${newPrice.toFixed(2)} with audit entry logged.`,
      });
      setActiveModal(null);
      loadListings();
    } catch (err) {
      setNotification({ type: 'error', msg: 'Failed to update price.' });
    } finally {
      setSaving(false);
    }
  };

  const handleRecordStockMovement = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const listing = activeModal.listing;
      const delta = parseFloat(qtyDelta);
      await inventoryService.recordStockMovement(activeStore.id, listing.id, {
        change_qty: delta,
        reason: movementReason,
      });

      setNotification({
        type: 'success',
        msg: `Stock adjusted by ${delta > 0 ? `+${delta}` : delta} units (${movementReason}).`,
      });
      setActiveModal(null);
      loadListings();
    } catch (err) {
      setNotification({ type: 'error', msg: 'Failed to adjust stock.' });
    } finally {
      setSaving(false);
    }
  };

  const filteredListings = listings.filter((item) => {
    const q = searchQuery.toLowerCase();
    return (
      (item.product_name || '').toLowerCase().includes(q) ||
      (item.brand || '').toLowerCase().includes(q) ||
      (item.variant_label || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Boxes className="w-5 h-5 text-teal-400" />
            Inventory & Price Management Desk
          </h2>
          <p className="text-xs text-slate-400">
            Real-time stock on hand, price history audit logging, and inventory movements for {activeStore?.name}
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter SKUs..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
          />
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between animate-in fade-in ${
            notification.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {notification.msg}
          </span>
          <button
            onClick={() => setNotification(null)}
            className="p-1 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Listings Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-850 text-slate-400 uppercase tracking-wider text-[10px] font-bold border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Product / SKU</th>
                <th className="py-3.5 px-4">Brand</th>
                <th className="py-3.5 px-4">Variant</th>
                <th className="py-3.5 px-4">Selling Price</th>
                <th className="py-3.5 px-4">Stock on Hand</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Loading inventory records...
                  </td>
                </tr>
              ) : filteredListings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No matching listings found.
                  </td>
                </tr>
              ) : (
                filteredListings.map((item) => {
                  const isDepleted = item.quantity_on_hand <= 0;
                  const isLow = item.quantity_on_hand < (item.reorder_threshold || 10);

                  return (
                    <tr key={item.id} className="hover:bg-slate-850/50 transition">
                      <td className="py-3.5 px-4 font-bold text-white">
                        {item.product_name}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {item.brand || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {item.variant_label || 'Standard'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-extrabold text-white text-sm">
                          ₹{item.current_price.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`font-black text-sm ${
                            isDepleted
                              ? 'text-rose-400'
                              : isLow
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {item.quantity_on_hand}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {isDepleted ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                            Out of Stock
                          </span>
                        ) : isLow ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            Low Stock
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            Healthy
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setActiveModal({ type: 'price', listing: item });
                              setPriceInput(item.current_price.toString());
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                            title="Edit Price"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setActiveModal({ type: 'stock', listing: item });
                              setQtyDelta('10');
                              setMovementReason('restock');
                            }}
                            className="p-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/30 transition"
                            title="Adjust Stock"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Price Modal */}
      {activeModal?.type === 'price' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-sm shadow-2xl p-6 relative">
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold text-white mb-1">
              Update Selling Price
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              {activeModal.listing.product_name}
            </p>

            <form onSubmit={handleUpdatePrice} className="space-y-4">
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  New Selling Price (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700 text-[11px] text-slate-400">
                A new record will automatically be written to <strong>PriceHistory</strong> with effective timestamp.
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 transition disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Confirm Price Update'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Stock Movement Modal */}
      {activeModal?.type === 'stock' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-sm shadow-2xl p-6 relative">
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold text-white mb-1">
              Record Stock Movement
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              {activeModal.listing.product_name} (Current: {activeModal.listing.quantity_on_hand} units)
            </p>

            <form onSubmit={handleRecordStockMovement} className="space-y-4">
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  Quantity Delta (+ for restock, - for deduction)
                </label>
                <input
                  type="number"
                  step="1"
                  required
                  value={qtyDelta}
                  onChange={(e) => setQtyDelta(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  Movement Reason
                </label>
                <select
                  value={movementReason}
                  onChange={(e) => setMovementReason(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="restock">Restock from Supplier (+)</option>
                  <option value="sale">Over-the-counter Offline Sale (-)</option>
                  <option value="adjustment">Physical Inventory Audit Adjustment (±)</option>
                  <option value="expiry_writeoff">Damaged / Expired Write-off (-)</option>
                </select>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700 text-[11px] text-slate-400">
                Replenishing an out-of-stock item triggers automated in-app notifications to subscribed customers!
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 transition disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Record Stock Movement'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
