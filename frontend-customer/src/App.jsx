import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { StoreDiscovery } from './components/StoreDiscovery';
import { ProductSearch } from './components/ProductSearch';
import { ShoppingListModal } from './components/ShoppingListModal';
import { OrderStatusTracker } from './components/OrderStatusTracker';
import { RestockModal } from './components/RestockModal';
import { NotificationsDropdown } from './components/NotificationsDropdown';
import { AuthModal } from './components/AuthModal';
import { useAuth } from './context/AuthContext';
import { Sparkles, MapPin, Zap, ShieldCheck } from 'lucide-react';

export default function App() {
  const { location, searchRadius } = useAuth();
  const [selectedStore, setSelectedStore] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [lastOrder, setLastOrder] = useState(null);

  // Modal states
  const [showCart, setShowCart] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [restockProduct, setRestockProduct] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Cart operations
  const handleAddToCart = (product) => {
    setCartItems((prev) => {
      const existing = prev.find(
        (i) => i.store_product_listing_id === product.store_product_listing_id
      );
      if (existing) {
        return prev.map((i) =>
          i.store_product_listing_id === product.store_product_listing_id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [
        ...prev,
        {
          store_product_listing_id: product.store_product_listing_id,
          product_name: product.product_name,
          variant_label: product.variant_label,
          price: product.price,
          quantity: 1,
        },
      ];
    });
  };

  const handleUpdateQuantity = (listingId, newQty) => {
    if (newQty <= 0) {
      handleRemoveItem(listingId);
      return;
    }
    setCartItems((prev) =>
      prev.map((i) =>
        i.store_product_listing_id === listingId ? { ...i, quantity: newQty } : i
      )
    );
  };

  const handleRemoveItem = (listingId) => {
    setCartItems((prev) =>
      prev.filter((i) => i.store_product_listing_id !== listingId)
    );
  };

  const handleOrderSubmitted = (order) => {
    setLastOrder(order);
    setCartItems([]);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col selection:bg-brand-500 selection:text-slate-950">
      <Navbar
        cartCount={cartItems.reduce((acc, i) => acc + i.quantity, 0)}
        unreadCount={unreadCount}
        onOpenCart={() => setShowCart(true)}
        onOpenNotifications={() => setShowNotifications(true)}
        onOpenAuth={() => setShowAuth(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Hyperlocal Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/60 p-6 sm:p-8 mb-6 shadow-2xl">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Real-Time Hyperlocal Inventory</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
              Shop Your Local Kirana With Live In-Stock Visibility
            </h1>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">
              Discover real-time inventory at neighborhood shops in{' '}
              <strong className="text-brand-300">{location.name}</strong>. Create curbside pickup lists or set restock alerts for out-of-stock essentials.
            </p>

            <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-slate-700/50 text-xs text-slate-400">
              <div className="flex items-center gap-1.5 font-medium text-slate-300">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Zero Delivery Markups</span>
              </div>
              <div className="flex items-center gap-1.5 font-medium text-slate-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Direct Kirana Prices</span>
              </div>
              <div className="flex items-center gap-1.5 font-medium text-slate-300">
                <MapPin className="w-4 h-4 text-brand-400" />
                <span>Catchment Radius: {(searchRadius / 1000).toFixed(0)} km</span>
              </div>
            </div>
          </div>
        </div>

        {/* Active Orders Tracker */}
        <OrderStatusTracker lastSubmittedOrder={lastOrder} />

        {/* Store Discovery Section */}
        <StoreDiscovery
          selectedStore={selectedStore}
          onSelectStore={setSelectedStore}
        />

        {/* Product Catalogue & Search Section */}
        <ProductSearch
          selectedStore={selectedStore}
          onAddToCart={handleAddToCart}
          onSubscribeRestock={setRestockProduct}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/50 py-8 text-center text-xs text-slate-500">
        <p>Stockali Hyperlocal Intelligence Platform • Powered by PostgreSQL + PostGIS & Supabase</p>
      </footer>

      {/* Modals */}
      <ShoppingListModal
        isOpen={showCart}
        onClose={() => setShowCart(false)}
        items={cartItems}
        selectedStore={selectedStore}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onOrderSubmitted={handleOrderSubmitted}
        onOpenAuth={() => {
          setShowCart(false);
          setShowAuth(true);
        }}
      />

      <RestockModal
        isOpen={!!restockProduct}
        onClose={() => setRestockProduct(null)}
        product={restockProduct}
        onOpenAuth={() => {
          setRestockProduct(null);
          setShowAuth(true);
        }}
      />

      <NotificationsDropdown
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        onUnreadChange={setUnreadCount}
      />

      <AuthModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
      />
    </div>
  );
}
