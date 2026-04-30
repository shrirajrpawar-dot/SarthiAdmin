import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase.js';
import Dashboard from './pages/Dashboard.jsx';
import KYCApprovals from './pages/KYCApprovals.jsx';
import Bookings from './pages/Bookings.jsx';
import Drivers from './pages/Drivers.jsx';
import Customers from './pages/Customers.jsx';
import Commission from './pages/Commission.jsx';
import Settings from './pages/Settings.jsx';

const ADMIN_PASSWORD = 'loadgo'; // Change this!

const navItems = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/kyc', label: 'KYC Approvals', icon: '📋' },
  { path: '/bookings', label: 'Bookings', icon: '📦' },
  { path: '/drivers', label: 'Drivers', icon: '🚗' },
  { path: '/customers', label: 'Customers', icon: '👥' },
  { path: '/commission', label: 'Commission', icon: '💰' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
];

function Login({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setLoading(true);
      try {
        // Sign in anonymously so Firestore rules see request.auth != null
        await signInAnonymously(auth);
        localStorage.setItem('admin_auth', 'true');
        onLogin();
      } catch (err) {
        setError('Firebase auth failed: ' + err.message);
      }
      setLoading(false);
    } else {
      setError('Incorrect password');
    }
  };

  return (
    <div style={loginStyles.container}>
      <div style={loginStyles.card}>
        <div style={loginStyles.logoBox}>
          <div style={loginStyles.logoIcon}>S</div>
        </div>
        <h1 style={loginStyles.title}>Sarthi Admin</h1>
        <p style={loginStyles.subtitle}>Sign in to manage your platform</p>
        <form onSubmit={handleLogin}>
          <input
            type="password"
            placeholder="Enter admin password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            style={loginStyles.input}
            autoFocus
          />
          {error && <p style={loginStyles.error}>{error}</p>}
          <button type="submit" style={loginStyles.btn} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p style={loginStyles.hint}>Contact admin if you need access</p>
      </div>
    </div>
  );
}

function Sidebar({ onLogout }) {
  return (
    <div style={sidebarStyles.sidebar}>
      <div style={sidebarStyles.brand}>
        <div style={sidebarStyles.brandLogo}>S</div>
        <div>
          <div style={sidebarStyles.brandName}>Sarthi</div>
          <div style={sidebarStyles.brandSub}>Admin Panel</div>
        </div>
      </div>
      <nav style={{ flex: 1, padding: '12px 0' }}>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            style={({ isActive }) => ({
              ...sidebarStyles.navItem,
              ...(isActive ? sidebarStyles.navItemActive : {}),
            })}
          >
            <span style={{ fontSize: 16, opacity: 0.85 }}>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <button onClick={onLogout} style={sidebarStyles.logoutBtn}>
        <span>↩</span> Sign Out
      </button>
    </div>
  );
}

export default function App() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // On mount: if localStorage says admin, re-establish Firebase anonymous auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user && localStorage.getItem('admin_auth') === 'true') {
        // Firebase session alive + localStorage valid
        setIsAuthed(true);
        setAuthLoading(false);
      } else if (!user && localStorage.getItem('admin_auth') === 'true') {
        // localStorage says logged in but Firebase session expired — re-auth
        try {
          await signInAnonymously(auth);
          setIsAuthed(true);
        } catch (e) {
          localStorage.removeItem('admin_auth');
          setIsAuthed(false);
        }
        setAuthLoading(false);
      } else {
        setIsAuthed(false);
        setAuthLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const handleLogout = async () => {
    localStorage.removeItem('admin_auth');
    try { await auth.signOut(); } catch (e) { /* ignore */ }
    setIsAuthed(false);
  };

  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#F3F4F6' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚙️</div>
          <div style={{ color: '#6B7280', fontSize: 14, fontWeight: 600 }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!isAuthed) return <Login onLogin={() => setIsAuthed(true)} />;

  return (
    <BrowserRouter>
      <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#F3F4F6' }}>
        <Sidebar onLogout={handleLogout} />
        <main style={{ flex: 1, padding: 28, overflowY: 'auto', maxHeight: '100vh', backgroundColor: '#F3F4F6' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/kyc" element={<KYCApprovals />} />
            <Route path="/bookings" element={<Bookings />} />
            <Route path="/drivers" element={<Drivers />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/commission" element={<Commission />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

// — — — Styles — — —

const loginStyles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  card: {
    background: '#FFFFFF',
    borderRadius: 20,
    padding: 40,
    width: 380,
    boxShadow: '0 6px 24px rgba(17, 24, 39, 0.06)',
    border: '1px solid #F3F4F6',
    textAlign: 'center',
  },
  logoBox: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 18,
  },
  logoIcon: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#111827',
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 900,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    letterSpacing: -1,
  },
  title: {
    fontSize: 24,
    fontWeight: 800,
    color: '#111827',
    margin: 0,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 26,
    margin: 0,
    marginBottom: 26,
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px 14px',
    fontSize: 14,
    border: '1px solid #F3F4F6',
    borderRadius: 12,
    marginBottom: 8,
    outline: 'none',
    backgroundColor: '#F9FAFB',
    color: '#111827',
    fontWeight: 500,
  },
  error: {
    color: '#EF4444',
    fontSize: 13,
    marginBottom: 8,
    fontWeight: 600,
  },
  btn: {
    width: '100%',
    padding: '13px',
    fontSize: 14,
    fontWeight: 800,
    color: '#FFFFFF',
    backgroundColor: '#111827',
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
    marginTop: 6,
    letterSpacing: 0.2,
  },
  hint: {
    marginTop: 18,
    fontSize: 12,
    color: '#9CA3AF',
  },
};

const sidebarStyles = {
  sidebar: {
    width: 230,
    backgroundColor: '#FFFFFF',
    display: 'flex',
    flexDirection: 'column',
    padding: '20px 0',
    minHeight: '100vh',
    position: 'sticky',
    top: 0,
    borderRight: '1px solid #F3F4F6',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '0 20px 20px',
    borderBottom: '1px solid #F3F4F6',
  },
  brandLogo: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#111827',
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 900,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    letterSpacing: -0.5,
  },
  brandName: {
    fontSize: 16,
    fontWeight: 800,
    color: '#111827',
    lineHeight: 1.1,
  },
  brandSub: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
    fontWeight: 600,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '11px 20px',
    margin: '2px 12px',
    borderRadius: 10,
    color: '#6B7280',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 600,
    transition: 'all 0.15s',
  },
  navItemActive: {
    color: '#111827',
    backgroundColor: '#F3F4F6',
    fontWeight: 700,
  },
  logoutBtn: {
    margin: '12px 16px 0',
    padding: '10px 14px',
    fontSize: 13,
    fontWeight: 700,
    color: '#EF4444',
    backgroundColor: '#FEF2F2',
    border: '1px solid #FECACA',
    borderRadius: 10,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
};