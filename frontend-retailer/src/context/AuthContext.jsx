import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('stockali_retailer_token'));
  const [stores, setStores] = useState([]);
  const [activeStore, setActiveStore] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      loadProfileAndStores();
    } else {
      setLoading(false);
    }
  }, [token]);

  const loadProfileAndStores = async () => {
    setLoading(true);
    try {
      const userData = await authService.getMe();
      setUser(userData);
      const storeList = await authService.getStores();
      setStores(storeList || []);
      if (storeList && storeList.length > 0) {
        const savedId = localStorage.getItem('stockali_retailer_store_id');
        const found = storeList.find((s) => s.id === savedId) || storeList[0];
        setActiveStore(found);
      }
    } catch (err) {
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email_or_phone, password) => {
    const res = await authService.login(email_or_phone, password);
    localStorage.setItem('stockali_retailer_token', res.access_token);
    setToken(res.access_token);
    setUser(res.user);
    return res;
  };

  const register = async (userData) => {
    const res = await authService.register(userData);
    localStorage.setItem('stockali_retailer_token', res.access_token);
    setToken(res.access_token);
    setUser(res.user);
    return res;
  };

  const logout = () => {
    localStorage.removeItem('stockali_retailer_token');
    localStorage.removeItem('stockali_retailer_store_id');
    setToken(null);
    setUser(null);
    setStores([]);
    setActiveStore(null);
  };

  const selectStore = (store) => {
    setActiveStore(store);
    if (store) {
      localStorage.setItem('stockali_retailer_store_id', store.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        stores,
        activeStore,
        loading,
        login,
        register,
        logout,
        selectStore,
        refreshStores: loadProfileAndStores,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
