import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { api, ApiUser, clearSession } from './lib/api';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(localStorage.getItem('token'));
  });

  const [user, setUser] = useState<ApiUser | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    const unauthorized = () => {
      setIsAuthenticated(false);
      setUser(null);
    };
    window.addEventListener('astrocore:unauthorized', unauthorized);
    if (localStorage.getItem('token')) {
      api.me()
        .then((me) => {
          setUser(me);
          localStorage.setItem('user', JSON.stringify(me));
          setIsAuthenticated(true);
        })
        .catch(() => unauthorized());
    }
    return () => window.removeEventListener('astrocore:unauthorized', unauthorized);
  }, []);

  const login = (token: string, userData: ApiUser) => {
    setIsAuthenticated(true);
    setUser(userData);
    localStorage.setItem('token', token);
    localStorage.setItem('auth', 'true');
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
    clearSession();
  };

  return (
    <Router>
      <Routes>
        <Route 
          path="/login" 
          element={!isAuthenticated ? <Login onLogin={login} /> : <Navigate to="/" />} 
        />
        <Route 
          path="/"
          element={isAuthenticated && user ? <Dashboard user={user} onLogout={logout} onUserUpdated={(nextUser) => {
            setUser(nextUser);
            localStorage.setItem('user', JSON.stringify(nextUser));
          }} /> : <Navigate to="/login" />}
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}
