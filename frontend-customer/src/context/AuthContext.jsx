import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../api';

const AuthContext = createContext();

// Pre-set convenient neighbourhood locations for testing/switching
export const POPULAR_LOCATIONS = [
  { name: 'Indiranagar, Bengaluru', lat: 12.9716, lng: 77.6412 },
  { name: 'Koramangala, Bengaluru', lat: 12.9352, lng: 77.6245 },
  { name: 'Connaught Place, New Delhi', lat: 28.6315, lng: 77.2167 },
  { name: 'Bandra West, Mumbai', lat: 19.0596, lng: 72.8295 },
  { name: 'HSR Layout, Bengaluru', lat: 12.9121, lng: 77.6446 },
];

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('stockali_token'));
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState(() => {
    const saved = localStorage.getItem('stockali_location');
    return saved ? JSON.parse(saved) : POPULAR_LOCATIONS[0];
  });
  const [searchRadius, setSearchRadius] = useState(5000);

  useEffect(() => {
    if (token) {
      authService.getMe()
        .then((userData) => {
          setUser(userData);
          if (userData.customer_profile?.latitude && userData.customer_profile?.longitude) {
            setLocation((prev) => ({
              ...prev,
              lat: userData.customer_profile.latitude,
              lng: userData.customer_profile.longitude,
            }));
          }
        })
        .catch(() => {
          logout();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email_or_phone, password) => {
    const res = await authService.login(email_or_phone, password);
    localStorage.setItem('stockali_token', res.access_token);
    setToken(res.access_token);
    setUser(res.user);
    return res;
  };

  const register = async (userData) => {
    const res = await authService.register({
      ...userData,
      latitude: location.lat,
      longitude: location.lng,
      search_radius_m: searchRadius,
      role: 'customer',
    });
    localStorage.setItem('stockali_token', res.access_token);
    setToken(res.access_token);
    setUser(res.user);
    return res;
  };

  const logout = () => {
    localStorage.removeItem('stockali_token');
    setToken(null);
    setUser(null);
  };

  const updateLocation = (newLoc) => {
    setLocation(newLoc);
    localStorage.setItem('stockali_location', JSON.stringify(newLoc));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        location,
        searchRadius,
        setSearchRadius,
        login,
        register,
        logout,
        updateLocation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
