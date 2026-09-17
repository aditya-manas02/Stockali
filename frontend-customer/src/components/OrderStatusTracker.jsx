import React, { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle2,
  PackageCheck,
  ShoppingBag,
  Store,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { shoppingService } from '../api';
import { useAuth } from '../context/AuthContext';

export const OrderStatusTracker = ({ lastSubmittedOrder }) => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadOrders();
    }
  }, [user, lastSubmittedOrder]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await shoppingService.getUserLists();
      // Only show orders with active pickup statuses
      const active = (data || []).filter((o) =>
        ['submitted', 'accepted', 'ready', 'collected'].includes(o.status)
      );
      setOrders(active);
    } catch (err) {
      console.error('Error loading orders:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!user || orders.length === 0) return null;

  const getStepIndex = (status) => {
    switch (status) {
      case 'submitted':
        return 0;
      case 'accepted':
        return 1;
      case 'ready':
        return 2;
      case 'collected':
        return 3;
      default:
        return 0;
    }
  };

  return (
    <section className="py-6 border-b border-slate-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-brand-400" />
          Active Pickup Orders
        </h3>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/30">
          Live Kirana Hold
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {orders.slice(0, 2).map((order) => {
          const step = getStepIndex(order.status);
          const steps = [
            { label: 'Submitted', desc: 'Order sent to store' },
            { label: 'Accepted', desc: 'Store confirmed stock' },
            { label: 'Ready', desc: 'Packed for pickup' },
            { label: 'Collected', desc: 'Handed over to customer' },
          ];

          return (
            <div
              key={order.id}
              className="p-5 rounded-3xl bg-slate-800/60 border border-slate-700/80 shadow-xl space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {order.title || 'Store Pickup'}
                  </h4>
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                    <Store className="w-3 h-3 text-brand-400" />
                    Store ID: {order.store_id.slice(0, 8)}...
                  </p>
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-slate-700 text-brand-300">
                  {order.status}
                </span>
              </div>

              {/* Progress Stepper */}
              <div className="relative flex justify-between items-center px-2 pt-2">
                <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-slate-700 -translate-y-1/2 z-0" />
                <div
                  className="absolute top-1/2 left-4 h-0.5 bg-brand-500 -translate-y-1/2 z-0 transition-all duration-500"
                  style={{ width: `${(step / 3) * 90}%` }}
                />

                {steps.map((s, idx) => {
                  const isDone = idx <= step;
                  const isCurrent = idx === step;
                  return (
                    <div
                      key={s.label}
                      className="relative z-10 flex flex-col items-center gap-1.5"
                    >
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                          isDone
                            ? 'bg-brand-500 text-slate-950 ring-4 ring-slate-900 shadow-md shadow-brand-500/30'
                            : 'bg-slate-700 text-slate-400 ring-4 ring-slate-900'
                        }`}
                      >
                        {isDone ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                      </div>
                      <span
                        className={`text-[10px] font-bold ${
                          isCurrent
                            ? 'text-brand-400'
                            : isDone
                            ? 'text-slate-300'
                            : 'text-slate-500'
                        }`}
                      >
                        {s.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Status Hint */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/60 text-xs text-slate-300 flex items-center justify-between">
                <span>Items reserved: {order.items?.length || 1} items</span>
                {order.status === 'ready' && (
                  <span className="font-bold text-emerald-400 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    Ready for Store Handover!
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
