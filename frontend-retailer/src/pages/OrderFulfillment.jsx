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
  Scan,
  Volume2,
  Zap,
  Sparkles,
  Check,
} from 'lucide-react';
import { fulfillmentService, inventoryService } from '../api';
import { useAuth } from '../context/AuthContext';
import { playKiranaChime } from '../utils/sound';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const OrderFulfillment = () => {
  const { activeStore } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [newOrderAlert, setNewOrderAlert] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [selectedOrderForScan, setSelectedOrderForScan] = useState(null);
  const [verifiedListings, setVerifiedListings] = useState({});
  const [storeListings, setStoreListings] = useState([]);

  useEffect(() => {
    if (activeStore?.id) {
      loadOrders();
      loadStoreListings();
      setupSSEStream();
    }
  }, [activeStore?.id]);

  const loadStoreListings = async () => {
    try {
      const data = await inventoryService.getListings(activeStore.id, { limit: 100 });
      setStoreListings(data.items || []);
    } catch (e) {
      console.warn('Failed to load store listings for scanner:', e);
    }
  };

  const setupSSEStream = () => {
    let eventSource;
    try {
      eventSource = new EventSource(`${API_BASE_URL}/events/stream/stores/${activeStore.id}`);

      eventSource.addEventListener('connected', () => {
        setIsLiveConnected(true);
      });

      eventSource.addEventListener('order_created', (e) => {
        playKiranaChime();
        try {
          const data = JSON.parse(e.data);
          setNewOrderAlert(`Incoming Pickup Order #${data.order_id?.slice(0, 6)} (₹${data.estimated_total})`);
        } catch (_) {
          setNewOrderAlert('New Curbside Pickup Order received!');
        }
        loadOrders();
      });

      eventSource.addEventListener('order_status_updated', () => {
        loadOrders();
      });

      eventSource.onerror = () => {
        setIsLiveConnected(false);
      };
    } catch (err) {
      console.warn('SSE connection failed:', err);
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await fulfillmentService.getStoreOrders(activeStore.id);
      setOrders(data.items || data || []);
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

  const openScanForOrder = (order) => {
    setSelectedOrderForScan(order);
    setScannerOpen(true);
  };

  const handleItemVerified = (listingId) => {
    if (selectedOrderForScan) {
      setVerifiedListings((prev) => ({
        ...prev,
        [`${selectedOrderForScan.id}_${listingId}`]: true,
      }));
    }
  };

  const submittedOrders = orders.filter((o) => o.status === 'submitted');
  const acceptedOrders = orders.filter((o) => o.status === 'accepted');
  const readyOrders = orders.filter((o) => o.status === 'ready');

  return (
    <div className="space-y-6">
      {/* Live Alert Banner */}
      {newOrderAlert && (
        <div className="p-4 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center justify-between shadow-xl animate-bounce">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-amber-400" />
            <span>{newOrderAlert}</span>
          </div>
          <button
            onClick={() => setNewOrderAlert(null)}
            className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-teal-400" />
              Curbside Pickup Fulfillment Counter
            </h2>
            {/* Live SSE Status Badge */}
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1.5 transition ${
                isLiveConnected
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isLiveConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                }`}
              ></span>
              <span>{isLiveConnected ? 'Live Stream Active' : 'Connecting Stream...'}</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Instant counter sync: accept orders, scan barcodes to verify pack bags, and confirm customer handovers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setScannerOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-teal-500/20"
          >
            <Scan className="w-4 h-4" />
            <span>Barcode Scanner Desk</span>
          </button>

          <button
            onClick={loadOrders}
            disabled={loading}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
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
              <div className="text-center py-10 space-y-1">
                <p className="text-xs text-slate-500">No new incoming orders.</p>
                <p className="text-[10px] text-slate-600">New orders will ding instantly here via SSE.</p>
              </div>
            ) : (
              submittedOrders.map((order) => (
                <div
                  key={order.id}
                  className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/80 space-y-3 shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white">Order #{order.id.slice(0, 6)}</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {order.total_items || order.items?.length || 1} items • ₹{order.estimated_total || 0}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      Pending
                    </span>
                  </div>

                  {/* Item preview */}
                  <div className="p-2 rounded-xl bg-slate-900/60 text-[11px] text-slate-300 space-y-1">
                    {(order.items || []).slice(0, 2).map((item, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span className="truncate">{item.product_name || 'Item'}</span>
                        <span className="text-slate-400 font-mono">x{item.quantity}</span>
                      </div>
                    ))}
                    {(order.items?.length || 0) > 2 && (
                      <div className="text-[10px] text-slate-500 italic">
                        +{order.items.length - 2} more items...
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleStatusUpdate(order.id, 'accepted')}
                      disabled={actionLoading === order.id}
                      className="flex-1 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1 transition shadow-md shadow-teal-500/20"
                    >
                      {actionLoading === order.id ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <span>Accept & Reserve</span>
                      )}
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(order.id, 'declined')}
                      disabled={actionLoading === order.id}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 text-xs font-semibold border border-slate-700 transition"
                    >
                      Decline
                    </button>
                  </div>
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
              Packing Queue ({acceptedOrders.length})
            </h3>
            <span className="text-[10px] text-slate-500 font-semibold">Step 2</span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto">
            {acceptedOrders.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-10">No orders in packing queue.</p>
            ) : (
              acceptedOrders.map((order) => (
                <div
                  key={order.id}
                  className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/80 space-y-3 shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white">Order #{order.id.slice(0, 6)}</h4>
                      <p className="text-[11px] text-blue-300 mt-0.5">Stock reserved</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/30">
                      In Packing
                    </span>
                  </div>

                  {/* Checklist & Barcode Scan Matcher */}
                  <div className="space-y-1.5 p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Order Items:</span>
                      <button
                        onClick={() => openScanForOrder(order)}
                        className="text-[10px] font-bold text-teal-400 hover:text-teal-300 flex items-center gap-1"
                      >
                        <Scan className="w-3 h-3" />
                        <span>Scan & Verify</span>
                      </button>
                    </div>

                    {(order.items || []).map((item, idx) => {
                      const isVerified = verifiedListings[`${order.id}_${item.store_product_listing_id}`];
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs py-1 border-b border-slate-800/50 last:border-0"
                        >
                          <span className={`truncate ${isVerified ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                            {item.product_name} x{item.quantity}
                          </span>
                          {isVerified ? (
                            <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-0.5">
                              <Check className="w-3 h-3" /> Scanned
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500">Unverified</span>
                          )}
                        </div>
                      );
                    })}
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
              <p className="text-xs text-slate-500 text-center py-10">No orders awaiting collection.</p>
            ) : (
              readyOrders.map((order) => (
                <div
                  key={order.id}
                  className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/80 space-y-3 shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white">Order #{order.id.slice(0, 6)}</h4>
                      <p className="text-[11px] text-emerald-400 mt-0.5 font-semibold">
                        Awaiting customer at kirana counter
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      Ready
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-900/60 text-xs text-slate-300 flex justify-between">
                    <span>Total Bill:</span>
                    <span className="font-bold text-white font-mono">₹{order.estimated_total || 0}</span>
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

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        availableListings={storeListings}
        activeOrder={selectedOrderForScan}
        onItemVerified={handleItemVerified}
      />
    </div>
  );
};
