import React, { useState, useEffect } from 'react';
import {
  Store,
  MapPin,
  Clock,
  Phone,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { searchService } from '../api';
import { useAuth } from '../context/AuthContext';

export const StoreDiscovery = ({ selectedStore, onSelectStore }) => {
  const { location, searchRadius } = useAuth();
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStores();
  }, [location.lat, location.lng, searchRadius]);

  const fetchStores = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await searchService.getNearbyStores(location.lat, location.lng, searchRadius);
      setStores(data.items || []);
      if (!selectedStore && data.items && data.items.length > 0) {
        onSelectStore(data.items[0]);
      }
    } catch (err) {
      setError('Unable to load nearby stores. Please ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Store className="w-5 h-5 text-brand-400" />
            Neighbourhood Kirana & Grocery Stores
          </h2>
          <p className="text-xs text-slate-400">
            Within {(searchRadius / 1000).toFixed(1)} km of {location.name}
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
          {stores.length} {stores.length === 1 ? 'Store' : 'Stores'} Nearby
        </span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-36 rounded-2xl bg-slate-800/40 border border-slate-800 animate-pulse p-4"
            />
          ))}
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : stores.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-slate-800/30 border border-slate-800">
          <Store className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-300">
            No Kirana stores found in this {(searchRadius / 1000).toFixed(0)}km radius.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Try switching location to Indiranagar or Koramangala from the top bar.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stores.map((s) => {
            const isSelected = selectedStore?.id === s.id;
            const distKm = (s.distance_meters / 1000).toFixed(2);

            return (
              <div
                key={s.id}
                onClick={() => onSelectStore(s)}
                className={`group cursor-pointer rounded-2xl p-4 transition-all duration-200 relative border ${
                  isSelected
                    ? 'bg-slate-800/90 border-brand-500/80 shadow-lg shadow-brand-500/10 ring-1 ring-brand-500/50'
                    : 'bg-slate-800/40 hover:bg-slate-800/70 border-slate-700/60 hover:border-slate-600'
                }`}
              >
                {isSelected && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 text-[11px] font-bold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-full border border-brand-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Active Store
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-700/50 flex items-center justify-center shrink-0 group-hover:bg-brand-500/20 group-hover:text-brand-400 transition">
                    <Store className="w-5 h-5 text-slate-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-white truncate pr-20">
                      {s.name}
                    </h3>
                    <p className="text-xs text-slate-400 truncate flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                      {s.address || 'Local Neighborhood Store'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-700/40 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 font-semibold text-brand-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{distKm} km away</span>
                  </div>
                  {s.phone && (
                    <div className="text-slate-400 flex items-center gap-1 text-[11px]">
                      <Phone className="w-3 h-3 text-slate-500" />
                      <span>{s.phone}</span>
                    </div>
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
