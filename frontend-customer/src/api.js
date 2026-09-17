import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('stockali_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth Services
export const authService = {
  login: async (email_or_phone, password) => {
    const res = await api.post('/auth/login', { email_or_phone, password });
    return res.data;
  },
  register: async (userData) => {
    const res = await api.post('/auth/register', userData);
    return res.data;
  },
  getMe: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  },
  updateProfile: async (profileData) => {
    const res = await api.patch('/auth/profile', profileData);
    return res.data;
  },
};

// Geospatial Search & Discovery
export const searchService = {
  getNearbyStores: async (lat, lng, radius_m = 5000) => {
    const res = await api.get('/stores/nearby', {
      params: { latitude: lat, longitude: lng, radius_m },
    });
    return res.data;
  },
  searchProducts: async (params) => {
    const res = await api.get('/search/products', { params });
    return res.data;
  },
};

// Shopping Lists & Pickup Orders
export const shoppingService = {
  createList: async (store_id, title = 'Curbside Pickup') => {
    const res = await api.post('/shopping-lists', { store_id, title });
    return res.data;
  },
  getList: async (list_id) => {
    const res = await api.get(`/shopping-lists/${list_id}`);
    return res.data;
  },
  getUserLists: async () => {
    const res = await api.get('/shopping-lists');
    return res.data;
  },
  addItem: async (list_id, itemData) => {
    const res = await api.post(`/shopping-lists/${list_id}/items`, itemData);
    return res.data;
  },
  updateItem: async (list_id, item_id, updateData) => {
    const res = await api.patch(`/shopping-lists/${list_id}/items/${item_id}`, updateData);
    return res.data;
  },
  removeItem: async (list_id, item_id) => {
    const res = await api.delete(`/shopping-lists/${list_id}/items/${item_id}`);
    return res.data;
  },
  submitList: async (list_id) => {
    const res = await api.post(`/shopping-lists/${list_id}/submit`);
    return res.data;
  },
};

// Restock Subscriptions & Notifications
export const notificationService = {
  subscribeRestock: async (store_product_listing_id) => {
    const res = await api.post('/subscriptions/restock', { store_product_listing_id });
    return res.data;
  },
  getNotifications: async () => {
    const res = await api.get('/notifications');
    return res.data;
  },
  markAsRead: async (notification_id) => {
    const res = await api.patch(`/notifications/${notification_id}/read`);
    return res.data;
  },
  markAllRead: async () => {
    const res = await api.post('/notifications/mark-all-read');
    return res.data;
  },
};
