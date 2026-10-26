import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService, extractErrorMessage } from '../services/authService';
import { getStoredToken, onUnauthorized } from '../services/api';
import { getRoleHomePath } from '../utils/roles';

const AuthContext = createContext(null);

export { getRoleHomePath };

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(getStoredToken());
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Logout handler
  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
    setToken(null);
    setAuthError(null);
  }, []);

  // Validate session on initial app mount
  useEffect(() => {
    const initializeAuth = async () => {
      const activeToken = getStoredToken();
      if (!activeToken) {
        setLoading(false);
        return;
      }

      try {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
        setToken(activeToken);
      } catch (err) {
        console.warn('[Auth Initialization] Session expired or invalid. Clearing session.');
        logout();
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for unauthorized 401 events emitted by Axios interceptor
    const unsubscribe = onUnauthorized(() => {
      console.warn('[Auth Event] Unauthorized 401 intercepted. Logging out.');
      logout();
    });

    return () => unsubscribe();
  }, [logout]);

  // Login handler
  const login = async ({ email, password }) => {
    setSubmitting(true);
    setAuthError(null);
    try {
      const result = await authService.login({ email, password });
      setUser(result.user);
      setToken(result.token);
      return { success: true, user: result.user };
    } catch (err) {
      const message = extractErrorMessage(err, 'Failed to sign in. Please verify your credentials.');
      setAuthError(message);
      return { success: false, error: message };
    } finally {
      setSubmitting(false);
    }
  };

  // Registration handler
  const register = async (userData) => {
    setSubmitting(true);
    setAuthError(null);
    try {
      const result = await authService.register(userData);
      setUser(result.user);
      setToken(result.token);
      return { success: true, user: result.user };
    } catch (err) {
      const message = extractErrorMessage(err, 'Registration failed. Please check your inputs.');
      setAuthError(message);
      return { success: false, error: message };
    } finally {
      setSubmitting(false);
    }
  };

  const clearError = () => setAuthError(null);

  const value = {
    user,
    token,
    loading,
    submitting,
    authError,
    isAuthenticated: Boolean(user && token),
    role: user?.role || null,
    isAdmin: user?.role === 'administrator',
    isOrganizer: user?.role === 'organizer',
    isParticipant: user?.role === 'participant',
    isVendor: user?.role === 'vendor',
    hasRole: (roles) => {
      if (!user || !user.role) return false;
      return Array.isArray(roles) ? roles.includes(user.role) : user.role === roles;
    },
    login,
    register,
    logout,
    clearError,
    getHomePath: () => getRoleHomePath(user?.role),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
