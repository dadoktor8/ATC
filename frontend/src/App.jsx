import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { AuthProvider, useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import AdminLayout from './pages/AdminLayout';

const theme = createTheme({
  palette: {
    primary: { main: '#1a237e' },
    secondary: { main: '#b71c1c' },
    background: { default: '#f4f6f9' },
  },
  typography: { fontFamily: '"Inter", "Roboto", sans-serif' },
  components: {
    MuiButton: { styleOverrides: { root: { textTransform: 'none', borderRadius: 8 } } },
    MuiCard: { styleOverrides: { root: { borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' } } },
    MuiChip: { styleOverrides: { root: { borderRadius: 6 } } },
  }
});

const PORTAL_ROLES = new Set(['super_admin', 'admin', 'maintainer']);

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!PORTAL_ROLES.has(user.role)) return <Navigate to="/login" replace />;
  return children;
}

function RoleRouter() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (PORTAL_ROLES.has(user.role)) return <Navigate to="/admin" replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<RoleRouter />} />
            <Route path="/admin/*" element={
              <ProtectedRoute><AdminLayout /></ProtectedRoute>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
