import React, { useState } from 'react';
import {
  MapPin,
  ShoppingBag,
  Bell,
  User,
  LogOut,
  ChevronDown,
  Navigation,
  Compass,
} from 'lucide-react';
import { useAuth, POPULAR_LOCATIONS } from '../context/AuthContext';

export const Navbar = ({
  cartCount,
  unreadCount,
  onOpenCart,
  onOpenNotifications,
  onOpenAuth,
}) => {
  const { user, location, updateLocation, logout } = useAuth();
  const [showLocMenu, setShowLocMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleSelectLocation = (loc) => {
    updateLocation(loc);
    setShowLocMenu(false);
  };

  const handleUseGPS = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          updateLocation({
            name: 'Current Device Location',
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          setShowLocMenu(false);
        },
        () => {
          alert('Could not retrieve current location. Using fallback.');
        }
      );
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo & Tagline */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <ShoppingBag className="w-5 h-5 text-slate-950 font-bold" />
          </div>
          <div>
            <span className="text-xl font-black tracking-tight text-white flex items-center gap-1.5">
              Stockali
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400 border border-brand-500/30">
                Kirana B2C
              </span>
            </span>
            <p className="text-xs text-slate-400 hidden sm:block">
              Hyperlocal grocery & neighbourhood pickup
            </p>
          </div>
        </div>

        {/* Location Selector Pill */}
        <div className="relative">
          <button
            onClick={() => setShowLocMenu(!showLocMenu)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 transition"
          >
            <MapPin className="w-4 h-4 text-brand-400 shrink-0" />
            <span className="truncate max-w-[140px] sm:max-w-[200px]">
              {location.name}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showLocMenu && (
            <div className="absolute left-0 mt-2 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Select Neighbourhood
              </div>
              <button
                onClick={handleUseGPS}
                className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 text-brand-400 hover:bg-slate-700/60 font-medium"
              >
                <Navigation className="w-4 h-4" />
                Use Current Device GPS
              </button>
              <div className="border-t border-slate-700/60 my-1"></div>
              {POPULAR_LOCATIONS.map((loc) => (
                <button
                  key={loc.name}
                  onClick={() => handleSelectLocation(loc)}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-700/60 transition ${
                    location.name === loc.name
                      ? 'text-brand-400 font-semibold bg-brand-500/10'
                      : 'text-slate-300'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Compass className="w-3.5 h-3.5 text-slate-400" />
                    {loc.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Actions: Cart, Notifications, Auth */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Notifications Bell */}
          <button
            onClick={onOpenNotifications}
            className="relative p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white transition"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-brand-500 rounded-full ring-2 ring-slate-900 animate-pulse" />
            )}
          </button>

          {/* Pickup Shopping List Cart */}
          <button
            onClick={onOpenCart}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-semibold text-xs transition shadow-lg shadow-brand-500/20"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden sm:inline">Pickup Cart</span>
            {cartCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-slate-950 text-brand-400 text-[11px] font-bold">
                {cartCount}
              </span>
            )}
          </button>

          {/* User Profile / Login */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-xs font-medium border border-slate-700"
              >
                <div className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center font-bold text-xs">
                  {user.full_name ? user.full_name[0].toUpperCase() : 'U'}
                </div>
                <span className="hidden md:inline truncate max-w-[100px]">
                  {user.full_name}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl py-1.5 z-50">
                  <div className="px-3 py-2 border-b border-slate-700">
                    <p className="text-xs font-semibold text-white truncate">
                      {user.full_name}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {user.email || user.phone}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      logout();
                      setShowUserMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-rose-400 hover:bg-slate-700/60 flex items-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
            >
              <User className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
