import React, { useState } from 'react';
import {
  X,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Send,
  AlertCircle,
  Store,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { shoppingService } from '../api';
import { useAuth } from '../context/AuthContext';

export const ShoppingListModal = ({
  isOpen,
  onClose,
  items,
  selectedStore,
  onUpdateQuantity,
  onRemoveItem,
  onOrderSubmitted,
  onOpenAuth,
}) => {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [substitutions, setSubstitutions] = useState({});

  if (!isOpen) return null;

  const totalPrice = items.reduce((acc, item) => acc + item.price * item.quantity, 0);

  const handleSubstitutionChange = (listingId, pref) => {
    setSubstitutions((prev) => ({ ...prev, [listingId]: pref }));
  };

  const handleSubmitPickup = async () => {
    if (!user) {
      onOpenAuth();
      return;
    }
    if (items.length === 0 || !selectedStore) return;

    setSubmitting(true);
    setError(null);
    try {
      // 1. Create a draft list for this store
      const list = await shoppingService.createList(
        selectedStore.id,
        `Pickup Order - ${new Date().toLocaleDateString()}`
      );

      // 2. Add each item
      for (const item of items) {
        await shoppingService.addItem(list.id, {
          store_product_listing_id: item.store_product_listing_id,
          quantity: item.quantity,
          substitution_preference: substitutions[item.store_product_listing_id] || 'cheapest_alternative',
          customer_notes: '',
        });
      }

      // 3. Submit list for hold / pickup
      const submitted = await shoppingService.submitList(list.id);
      onOrderSubmitted(submitted);
      onClose();
    } catch (err) {
      console.error('Failed to submit pickup order:', err);
      setError(err.response?.data?.detail || 'Failed to submit pickup order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Curbside Pickup Cart</h3>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Store className="w-3 h-3 text-brand-400" />
                {selectedStore ? selectedStore.name : 'Selected Store'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {items.length === 0 ? (
            <div className="py-12 text-center">
              <ShoppingBag className="w-12 h-12 text-slate-700 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-300">Your pickup cart is empty.</p>
              <p className="text-xs text-slate-500 mt-1">
                Browse catalogue items from your neighbourhood store to assemble a pickup order.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.store_product_listing_id}
                  className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-700/60 flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">
                        {item.product_name}
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        {item.variant_label || 'Standard Pack'} • ₹{item.price.toFixed(2)} each
                      </p>
                    </div>
                    <div className="text-xs font-black text-white">
                      ₹{(item.price * item.quantity).toFixed(2)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-700/40 text-xs">
                    {/* Substitution Preference Dropdown */}
                    <select
                      value={substitutions[item.store_product_listing_id] || 'cheapest_alternative'}
                      onChange={(e) => handleSubstitutionChange(item.store_product_listing_id, e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-[11px] text-slate-300 rounded-lg px-2 py-1 focus:outline-none"
                    >
                      <option value="cheapest_alternative">Cheapest Alternative</option>
                      <option value="brand_only">Exact Brand Only</option>
                      <option value="contact_customer">Call Me First</option>
                    </select>

                    {/* Quantity Selector */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onUpdateQuantity(item.store_product_listing_id, item.quantity - 1)}
                        className="w-6 h-6 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center transition"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-bold text-white w-4 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQuantity(item.store_product_listing_id, item.quantity + 1)}
                        className="w-6 h-6 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center transition"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => onRemoveItem(item.store_product_listing_id)}
                        className="p-1 text-slate-500 hover:text-rose-400 transition ml-1"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer with Totals & Submit */}
        {items.length > 0 && (
          <div className="px-6 py-4 bg-slate-800/80 border-t border-slate-800 flex flex-col gap-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Total Estimated Amount:</span>
              <span className="text-lg font-black text-white">₹{totalPrice.toFixed(2)}</span>
            </div>

            <button
              onClick={handleSubmitPickup}
              disabled={submitting}
              className="w-full py-3 rounded-2xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 transition disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Submitting Order to Store...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>
                    {user ? 'Submit Order for Kirana Pickup Hold' : 'Sign In & Submit Pickup Order'}
                  </span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
