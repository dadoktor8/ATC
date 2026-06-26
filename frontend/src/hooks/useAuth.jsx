import React, { createContext, useContext, useState } from 'react';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('atc_user')); } catch { return null; }
  });

  const login = (u, token) => {
    setUser(u);
    localStorage.setItem('atc_user', JSON.stringify(u));
    if (token) localStorage.setItem('atc_token', token);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('atc_user');
    localStorage.removeItem('atc_token');
  };

  return <AuthCtx.Provider value={{ user, login, logout }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
