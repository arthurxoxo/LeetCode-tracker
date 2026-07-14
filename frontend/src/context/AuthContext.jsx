import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const API = 'https://leetcode-tracker-domx.onrender.com/api';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const loadUser = async () => {
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          // Token expired or invalid
          handleLogout();
        }
      } catch (err) {
        console.error('Error fetching current user:', err);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [token]);

  const handleLogin = async (email, password) => {
    setMessage('');
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.message || 'Login failed. Please check credentials.');
        return false;
      }
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
      return true;
    } catch (err) {
      setMessage('Server connection failed.');
      console.error(err);
      return false;
    }
  };

  const handleRegister = async (name, email, password) => {
    setMessage('');
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.message || 'Registration failed.');
        return false;
      }
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
      return true;
    } catch (err) {
      setMessage('Server connection failed.');
      console.error(err);
      return false;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setMessage('Logged out successfully.');
  };

  const updateProfile = async (leetcodeUsername) => {
    setMessage('');
    try {
      const res = await authFetch('/auth/profile', {
        method: 'POST',
        body: JSON.stringify({ leetcodeUsername }),
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        return true;
      }
      setMessage(data.message || 'Failed to update profile.');
      return false;
    } catch (err) {
      setMessage('Connection to server failed.');
      console.error(err);
      return false;
    }
  };

  const authFetch = async (endpoint, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${API}${endpoint}`, {
      ...options,
      headers,
    });
    return response;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        message,
        setMessage,
        login: handleLogin,
        register: handleRegister,
        logout: handleLogout,
        updateProfile,
        authFetch,
        updateUser: setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
