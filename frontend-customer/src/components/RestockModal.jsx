import React, { useState } from 'react';
import {
  X,
  BellRing,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { notificationService } from '../api';
import { useAuth } from '../context/AuthContext';

export const RestockModal = ({
  isOpen,
  onClose,
  product,
  onOpenAuth,
}) => {
  const { user } = useAuth();
  const [subscribing, setSubscribing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !product) return null;

  const handleSubscribe = async () => {
    if (!user) {
      onOpenAuth();
      return;
    }

    setSubscribing(true);
    setError(null);
    try {
      await notificationService.subscribeRestock(product.store_product_listing_id);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to register alert.');
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
          <BellRing className="w-6 h-6" />
        </div>

        <h3 className="text-base font-bold text-white">
          Notify When Restocked
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          {product.product_name} ({product.variant_label || 'Pack'}) is currently out of stock at{' '}
          <strong className="text-white">{product.store_name}</strong>.
        </p>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="mt-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-bold">Subscription Confirmed!</p>
              <p className="text-[11px] text-emerald-300">
                You will be notified immediately when this item is restocked.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs text-slate-300">
              <span className="font-semibold text-brand-400 flex items-center gap-1 mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                Hyperlocal Restock Guarantee
              </span>
              Our demand engine alerts the retailer that you are waiting for this product!
            </div>

            <button
              onClick={handleSubscribe}
              disabled={subscribing}
              className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
            >
              {subscribing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Registering Alert...</span>
                </>
              ) : (
                <>
                  <BellRing className="w-4 h-4" />
                  <span>{user ? 'Set Restock Alert' : 'Sign In & Set Restock Alert'}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
