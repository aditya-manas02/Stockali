import React, { useState, useEffect } from 'react';
import {
  X,
  Bell,
  CheckCheck,
  Package,
  ShoppingBag,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { notificationService } from '../api';
import { useAuth } from '../context/AuthContext';

export const NotificationsDropdown = ({ isOpen, onClose, onUnreadChange }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && isOpen) {
      fetchNotifications();
    }
  }, [user, isOpen]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const data = await notificationService.getNotifications();
      setNotifications(data.items || []);
      if (onUnreadChange) {
        onUnreadChange(data.unread_count || 0);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      if (onUnreadChange) {
        onUnreadChange((cnt) => Math.max(0, cnt - 1));
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      if (onUnreadChange) {
        onUnreadChange(0);
      }
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center sm:items-start sm:justify-end p-4 sm:p-6 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[80vh] sm:mt-12">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-brand-400" />
            <h3 className="text-sm font-bold text-white">Notifications</h3>
          </div>
          <div className="flex items-center gap-2">
            {notifications.some((n) => !n.is_read) && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {!user ? (
            <div className="p-6 text-center text-slate-400 text-xs">
              Please sign in to view your in-app restock alerts and pickup notifications.
            </div>
          ) : loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 rounded-xl bg-slate-800/40 animate-pulse"
                />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              <Sparkles className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              No notifications yet.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => !n.is_read && handleMarkAsRead(n.id)}
                className={`p-3 rounded-2xl border text-xs transition cursor-pointer ${
                  n.is_read
                    ? 'bg-slate-800/30 border-slate-800 text-slate-400'
                    : 'bg-slate-800/80 border-brand-500/40 text-slate-200 shadow-md shadow-brand-500/5'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold text-white">{n.title}</span>
                  {!n.is_read && (
                    <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0 mt-1" />
                  )}
                </div>
                <p className="mt-1 text-[11px] leading-relaxed">{n.message}</p>
                <span className="text-[10px] text-slate-500 mt-2 block">
                  {new Date(n.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
