import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('stockali_retailer_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth & Retailer
export const authService = {
  login: async (email_or_phone, password) => {
    const res = await api.post('/auth/login', { email_or_phone, password });
    return res.data;
  },
  register: async (userData) => {
    const res = await api.post('/auth/register', { ...userData, role: 'retailer_owner' });
    return res.data;
  },
  getMe: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  },
  getStores: async () => {
    const res = await api.get('/stores');
    return res.data;
  },
};

// Store Inventory Management
export const inventoryService = {
  getListings: async (storeId, params = {}) => {
    const res = await api.get(`/stores/${storeId}/inventory`, { params });
    return res.data;
  },
  getListingDetails: async (storeId, listingId) => {
    const res = await api.get(`/stores/${storeId}/inventory/${listingId}`);
    return res.data;
  },
  updateListing: async (storeId, listingId, updateData) => {
    const res = await api.patch(`/stores/${storeId}/inventory/${listingId}`, updateData);
    return res.data;
  },
  recordStockMovement: async (storeId, listingId, movementData) => {
    const res = await api.post(`/stores/${storeId}/inventory/${listingId}/movements`, movementData);
    return res.data;
  },
};

// Order Pickup Fulfillment
export const fulfillmentService = {
  getStoreOrders: async (storeId) => {
    const res = await api.get(`/stores/${storeId}/orders`);
    return res.data;
  },
  updateOrderStatus: async (orderId, newStatus) => {
    const res = await api.patch(`/shopping-lists/${orderId}/status`, { status: newStatus });
    return res.data;
  },
};

// Advanced ML & Supply Chain Insights
export const insightsService = {
  getForecasts: async (storeId) => {
    const res = await api.get(`/stores/${storeId}/insights/forecasts`);
    return res.data;
  },
  getRestockRecommendations: async (storeId, action = null) => {
    const params = action ? { action } : {};
    const res = await api.get(`/stores/${storeId}/insights/restock-recommendations`, { params });
    return res.data;
  },
  updateRestockAction: async (storeId, recId, action, adjustedQty = null) => {
    const body = { action };
    if (adjustedQty !== null) body.adjusted_quantity = adjustedQty;
    const res = await api.patch(`/stores/${storeId}/insights/restock-recommendations/${recId}/action`, body);
    return res.data;
  },
  getDiscountRecommendations: async (storeId, action = null) => {
    const params = action ? { action } : {};
    const res = await api.get(`/stores/${storeId}/insights/discount-recommendations`, { params });
    return res.data;
  },
  updateDiscountAction: async (storeId, recId, action) => {
    const res = await api.patch(`/stores/${storeId}/insights/discount-recommendations/${recId}/action`, { action });
    return res.data;
  },
  getInventoryHealth: async (storeId, serviceLevel = 0.95, leadTimeDays = 2.0) => {
    const res = await api.get(`/stores/${storeId}/insights/inventory-health`, {
      params: { service_level: serviceLevel, lead_time_days: leadTimeDays },
    });
    return res.data;
  },
  simulateScenario: async (storeId, scenarioData) => {
    const res = await api.post(`/stores/${storeId}/insights/simulate-scenario`, scenarioData);
    return res.data;
  },
  getModelEvaluations: async () => {
    const res = await api.get('/insights/model-evaluations');
    return res.data;
  },
};
