import React, { useState } from 'react';
import {
  Store,
  Lock,
  Mail,
  User,
  Sparkles,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AuthPage = () => {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [emailOrPhone, setEmailOrPhone] = useState('kirana.ramesh@stockali.local');
  const [password, setPassword] = useState('RetailerPassword123!');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isRegister) {
        await register({
          email: emailOrPhone.includes('@') ? emailOrPhone : undefined,
          phone: !emailOrPhone.includes('@') ? emailOrPhone : undefined,
          password,
          full_name: fullName,
        });
      } else {
        await login(emailOrPhone, password);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Authentication failed. Please verify retailer credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoCreds = () => {
    setEmailOrPhone('kirana.ramesh@stockali.local');
    setPassword('RetailerPassword123!');
    setIsRegister(false);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-teal-500/20">
            <Store className="w-6 h-6 text-slate-950 font-bold" />
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">
            Stockali Retailer Portal
          </h1>
          <p className="text-xs text-slate-400">
            B2B Store Inventory, Order Fulfillment & Supply Chain AI
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Full Name / Owner Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ramesh Patel"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Retailer Email or Phone
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={emailOrPhone}
                onChange={(e) => setEmailOrPhone(e.target.value)}
                placeholder="kirana.ramesh@stockali.local"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500 font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-teal-500/20 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : isRegister ? (
              'Register Retailer Account'
            ) : (
              'Sign In to Store Dashboard'
            )}
          </button>
        </form>

        <div className="space-y-2 pt-2 border-t border-slate-800">
          <button
            onClick={fillDemoCreds}
            className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-teal-300 border border-teal-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Use Pre-Configured Kirana Demo Account</span>
          </button>

          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
            }}
            className="w-full text-center text-xs text-slate-400 hover:text-white transition pt-2"
          >
            {isRegister
              ? 'Already registered? Sign In'
              : "Don't have a retailer account? Register"}
          </button>
        </div>
      </div>
    </div>
  );
};
