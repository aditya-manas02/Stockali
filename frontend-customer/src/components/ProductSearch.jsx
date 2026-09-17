import React, { useState, useEffect } from 'react';
import {
  Search,
  SlidersHorizontal,
  Package,
  Plus,
  BellRing,
  Check,
  Sparkles,
  Layers,
  Milk,
  Wheat,
  Coffee,
  Cookie,
  Flame,
} from 'lucide-react';
import { searchService } from '../api';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = [
  { id: 'all', label: 'All Items', icon: Layers },
  { id: 'dairy', label: 'Dairy & Milk', query: 'milk', icon: Milk },
  { id: 'staples', label: 'Atta, Dal & Rice', query: 'atta', icon: Wheat },
  { id: 'beverages', label: 'Tea & Coffee', query: 'tea', icon: Coffee },
  { id: 'snacks', label: 'Snacks & Biscuits', query: 'biscuit', icon: Cookie },
];

export const ProductSearch = ({
  selectedStore,
  onAddToCart,
  onSubscribeRestock,
}) => {
  const { location, searchRadius } = useAuth();
  const [queryText, setQueryText] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addedIds, setAddedIds] = useState(new Set());

  useEffect(() => {
    fetchProducts();
  }, [location.lat, location.lng, selectedStore?.id, activeCategory, onlyInStock]);

  const fetchProducts = async (overrideQuery) => {
    setLoading(true);
    try {
      const q = overrideQuery !== undefined ? overrideQuery : queryText;
      const catObj = CATEGORIES.find((c) => c.id === activeCategory);
      const effectiveQ = q || (catObj?.query || '');

      const params = {
        latitude: location.lat,
        longitude: location.lng,
        radius_m: searchRadius,
        in_stock_only: onlyInStock,
      };
      if (effectiveQ) params.q = effectiveQ;
      if (selectedStore?.id) params.store_id = selectedStore.id;

      const data = await searchService.searchProducts(params);
      setProducts(data.items || []);
    } catch (err) {
      console.error('Error searching products:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchProducts();
  };

  const handleCategoryClick = (catId) => {
    setActiveCategory(catId);
    const catObj = CATEGORIES.find((c) => c.id === catId);
    fetchProducts(catObj?.query || '');
  };

  const handleAdd = (item) => {
    onAddToCart(item);
    setAddedIds((prev) => new Set(prev).add(item.store_product_listing_id));
    setTimeout(() => {
      setAddedIds((prev) => {
        const next = new Set(prev);
        next.delete(item.store_product_listing_id);
        return next;
      });
    }, 1500);
  };

  return (
    <section className="py-6">
      {/* Search Bar & Filter Controls */}
      <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/60 shadow-xl mb-6">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="Search atta, milk, oil, biscuits in neighbourhood stores..."
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-xs rounded-xl transition shrink-0 shadow-lg shadow-brand-500/20"
          >
            Search
          </button>
        </form>

        {/* Quick Category Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pt-4 pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
                  isActive
                    ? 'bg-brand-500 text-slate-950 font-semibold shadow-md shadow-brand-500/20'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700/80'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}

          <div className="h-4 w-px bg-slate-700 mx-1 shrink-0" />

          <button
            onClick={() => setOnlyInStock(!onlyInStock)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
              onlyInStock
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/80'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>In-Stock Only</span>
          </button>
        </div>
      </div>

      {/* Product Results Grid */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Package className="w-4 h-4 text-brand-400" />
          {selectedStore ? `Catalogue from ${selectedStore.name}` : 'Neighbourhood Available Products'}
        </h3>
        <span className="text-xs text-slate-400">
          {products.length} products listed
        </span>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="h-52 rounded-2xl bg-slate-800/40 border border-slate-800 animate-pulse p-4"
            />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-800/30 border border-slate-800">
          <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h4 className="text-sm font-semibold text-slate-300">
            No matching grocery items found.
          </h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Your search query has been logged to our demand engine. We alert nearby retailers about unfulfilled demand!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((item) => {
            const inStock = item.in_stock && item.quantity_on_hand > 0;
            const isAdded = addedIds.has(item.store_product_listing_id);

            return (
              <div
                key={item.store_product_listing_id}
                className="group rounded-2xl bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700/60 hover:border-slate-600 p-4 flex flex-col justify-between transition-all duration-200"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md bg-slate-700 text-slate-300 truncate max-w-[100px]">
                      {item.brand || 'Groceries'}
                    </span>
                    {inStock ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        {item.quantity_on_hand} in stock
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/30">
                        Out of Stock
                      </span>
                    )}
                  </div>

                  {/* Title & Variant */}
                  <h4 className="text-sm font-bold text-white group-hover:text-brand-300 transition line-clamp-2">
                    {item.product_name}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {item.variant_label || 'Standard Pack'}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate mt-1">
                    Store: {item.store_name}
                  </p>
                </div>

                {/* Price & Action Button */}
                <div className="mt-4 pt-3 border-t border-slate-700/50 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400">Price</span>
                    <div className="text-base font-black text-white">
                      ₹{item.price.toFixed(2)}
                    </div>
                  </div>

                  {inStock ? (
                    <button
                      onClick={() => handleAdd(item)}
                      disabled={isAdded}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-md ${
                        isAdded
                          ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/20'
                          : 'bg-brand-500 hover:bg-brand-400 text-slate-950 shadow-brand-500/20'
                      }`}
                    >
                      {isAdded ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Added</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => onSubscribeRestock(item)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 text-xs font-semibold transition"
                      title="Notify me when restocked"
                    >
                      <BellRing className="w-3.5 h-3.5" />
                      <span>Notify</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
