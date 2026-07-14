import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Auth() {
  const { login, register, message, setMessage } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    let success = false;
    if (isLogin) {
      success = await login(formData.email, formData.password);
    } else {
      success = await register(formData.name, formData.email, formData.password);
    }
    setLoading(false);
    if (success) {
      setFormData({ name: '', email: '', password: '' });
    }
  };

  const handleToggle = (mode) => {
    setIsLogin(mode === 'login');
    setMessage('');
  };

  return (
    <div className="auth-shell">
      <div className="auth-container">
        {/* Animated Brand Header */}
        <div className="brand-header">
          <div className="brand-logo">
            <svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor">
              <path d="M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2zm1 14.5h-2v-2h2v2zm0-4h-2V7.5h2v5z" />
            </svg>
          </div>
          <h1>LeetCode Tracker</h1>
          <p>Practice smarter. Track your progress, consistency, and metrics in one beautiful space.</p>
        </div>

        {/* Auth Form Card */}
        <div className="auth-card">
          <div className="auth-tabs">
            <button
              type="button"
              className={isLogin ? 'active' : ''}
              onClick={() => handleToggle('login')}
            >
              Sign In
            </button>
            <button
              type="button"
              className={!isLogin ? 'active' : ''}
              onClick={() => handleToggle('register')}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {!isLogin && (
              <div className="form-group">
                <label htmlFor="name-input">Full Name</label>
                <input
                  id="name-input"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Doe"
                  required
                />
              </div>
            )}
            <div className="form-group">
              <label htmlFor="email-input">Email Address</label>
              <input
                id="email-input"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="name@example.com"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="password-input">Password</label>
              <input
                id="password-input"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                required
              />
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? (
                <span className="spinner"></span>
              ) : isLogin ? (
                'Sign Into Dashboard'
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {message && (
            <div className={`auth-message ${message.includes('success') ? 'success' : 'error'}`}>
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
