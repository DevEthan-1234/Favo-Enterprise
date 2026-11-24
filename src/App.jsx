import { useCallback, useEffect, useState } from 'react';
import Storefront from './storefront/Storefront.jsx';
import AdminPortal from './admin/AdminPortal.jsx';
import AdminLogin from './storefront/AdminLogin.jsx';
import { Toast } from './components/ui.jsx';
import { useStore } from './store/StoreContext.jsx';

function readRoute() {
  return window.location.hash.startsWith('#/admin') ? 'admin' : 'store';
}

function readTheme() {
  try {
    return localStorage.getItem('favo:theme') || 'dark';
  } catch {
    return 'dark';
  }
}

export default function App() {
  const { isAdmin, authReady, logout } = useStore();
  const [route, setRoute] = useState(readRoute);
  const [theme, setTheme] = useState(readTheme);
  const [loginOpen, setLoginOpen] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('light', theme === 'light');
    root.classList.toggle('dark', theme !== 'light');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#F1F5F9' : '#0B1120');
    try { localStorage.setItem('favo:theme', theme); } catch { /* private mode */ }
  }, [theme]);

  // Someone opening #/admin without an admin session gets the login prompt instead.
  useEffect(() => {
    if (authReady && route === 'admin' && !isAdmin) {
      setLoginOpen(true);
      window.location.hash = '';
    }
  }, [route, isAdmin, authReady]);

  const notify = useCallback((text) => {
    const t = { id: Date.now(), text };
    setToast(t);
    setTimeout(() => setToast((cur) => (cur && cur.id === t.id ? null : cur)), 2600);
  }, []);

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));

  const onLoginSuccess = () => {
    setLoginOpen(false);
    window.location.hash = '#/admin';
  };

  const onLogout = async () => {
    await logout();
    window.location.hash = '';
    notify('Logged out of Admin Portal');
  };

  return (
    <>
      {route === 'admin' && isAdmin ? (
        <AdminPortal onLogout={onLogout} theme={theme} toggleTheme={toggleTheme} notify={notify} />
      ) : (
        <Storefront
          theme={theme}
          toggleTheme={toggleTheme}
          notify={notify}
          isAdmin={isAdmin}
          onAdminClick={() => (isAdmin ? (window.location.hash = '#/admin') : setLoginOpen(true))}
        />
      )}
      <AdminLogin open={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={onLoginSuccess} />
      <Toast toast={toast} />
    </>
  );
}
