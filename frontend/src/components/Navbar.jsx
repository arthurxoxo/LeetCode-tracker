import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = () => setMenuOpen(!menuOpen);
  const closeMenu = () => setMenuOpen(false);

  if (!user) return null;

  return (
    <nav className="top-nav">
      <div className="nav-logo">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
          <path d="M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2zm1 14.5h-2v-2h2v2zm0-4h-2V7.5h2v5z" />
        </svg>
        <span>LeetCode Tracker</span>
      </div>

      {/* Hamburger icon for mobile */}
      <button className="mobile-menu-toggle" onClick={toggleMenu} aria-label="Toggle menu">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {menuOpen ? (
            <path d="M18 6L6 18M6 6l12 12" />
          ) : (
            <path d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      <div className={`nav-links-container ${menuOpen ? 'mobile-show' : ''}`}>
        <div className="nav-links">
          <NavLink to="/" end onClick={closeMenu}>
            <svg className="nav-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Dashboard
          </NavLink>
          <NavLink to="/tracker" onClick={closeMenu}>
            <svg className="nav-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            Tracker
          </NavLink>
          <NavLink to="/analytics" onClick={closeMenu}>
            <svg className="nav-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            Analytics
          </NavLink>
        </div>

        <div className="nav-user">
          <div className="user-profile">
            <span className="user-avatar">{user.name?.charAt(0).toUpperCase()}</span>
            <span className="user-name">{user.name}</span>
          </div>
          <button onClick={() => { logout(); closeMenu(); }} className="btn-logout">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
