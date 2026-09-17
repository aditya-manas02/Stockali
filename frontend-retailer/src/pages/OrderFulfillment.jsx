import React, { useState, useEffect } from 'react';
import {
  ClipboardCheck,
  Package,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ShoppingBag,
  ArrowRight,
  User,
} from 'lucide-react';
import { fulfillmentService } from '../api';
import { useAuth } from '../context/AuthContext';

export const OrderFulfillment = () => {
  const { activeStore } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    if (activeStore?.id) {
      loadOrders();
    }
  }, [activeStore?.id]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await fulfillmentService.getStoreOrders(activeStore.id);
      setOrders(data || []);
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    setActionLoading(orderId);
    try {
      await fulfillmentService.updateOrderStatus(orderId, newStatus);
      await loadOrders();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update order state.');
    } finally {
      setActionLoading(null);
    }
  };

  const submittedOrders = orders.filter((o) => o.status === 'submitted');
  const acceptedOrders = orders.filter((o) => o.status === 'accepted');
  const readyOrders = orders.filter((o) => o.status === 'ready');
  const completedOrders = orders.filter((o) => o.status === 'collected');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-teal-400" />
            Curbside Pickup Fulfillment Counter
          </h2>
          <p className="text-xs text-slate-400">
            Accept incoming shopping lists, pack requested SKUs, and confirm customer handover.
          </p>
        </div>
        <button
          onClick={loadOrders}
          disabled={loading}
          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center gap-1.5 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Orders Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 1. Incoming Submitted */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              Incoming ({submittedOrders.length})
            </h3>
            <span className="text-[10px] text-slate-500 font-semibold">Step 1</span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto">
            {submittedOrders.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">No new incoming orders.</p>
            ) : (
              submittedOrders.map((order) => (
                <div
                  key={order.id}
                  className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/80 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white">Order #{order.id.slice(0, 6)}</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {order.items?.length || 1} Items requested
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      Pending
                    </span>
                  </div>

                  <button
                    onClick={() => handleStatusUpdate(order.id, 'accepted')}
                    disabled={actionLoading === order.id}
                    className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-md shadow-amber-500/20"
                  >
                    {actionLoading === order.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <span>Accept & Start Packing</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 2. Packing In-Progress */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
              <Package className="w-4 h-4" />
              Packing ({acceptedOrders.length})
            </h3>
            <span className="text-[10px] text-slate-500 font-semibold">Step 2</span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto">
            {acceptedOrders.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">No orders in packing queue.</p>
            ) : (
              acceptedOrders.map((order) => (
                <div
                  key={order.id}
                  className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/80 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white">Order #{order.id.slice(0, 6)}</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">Stock reserved</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/30">
                      In Packing
                    </span>
                  </div>

                  <button
                    onClick={() => handleStatusUpdate(order.id, 'ready')}
                    disabled={actionLoading === order.id}
                    className="w-full py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-md shadow-teal-500/20"
                  >
                    {actionLoading === order.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Mark Ready for Pickup</span>
                      </>
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 3. Ready for Customer Handover */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              Ready for Handover ({readyOrders.length})
            </h3>
            <span className="text-[10px] text-slate-500 font-semibold">Step 3</span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto">
            {readyOrders.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">No orders awaiting collection.</p>
            ) : (
              readyOrders.map((order) => (
                <div
                  key={order.id}
                  className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/80 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white">Order #{order.id.slice(0, 6)}</h4>
                      <p className="text-[11px] text-emerald-400 mt-0.5 font-semibold">
                        Awaiting customer at counter
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      Ready
                    </span>
                  </div>

                  <button
                    onClick={() => handleStatusUpdate(order.id, 'collected')}
                    disabled={actionLoading === order.id}
                    className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs border border-emerald-500/30 flex items-center justify-center gap-1.5 transition"
                  >
                    {actionLoading === order.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Confirm Collected</span>
                      </>
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
