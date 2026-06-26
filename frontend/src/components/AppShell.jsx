import React, { useState } from 'react';
import {
  Box, Drawer, AppBar, Toolbar, Typography, IconButton,
  List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Avatar, Tooltip, Divider, useMediaQuery, useTheme
} from '@mui/material';
import {
  Menu as MenuIcon, LogoutRounded, ChevronLeft
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const DRAWER_W = 240;

export default function AppShell({ navItems, children, title }) {
  const [open, setOpen] = useState(true);
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handleLogout = () => { logout(); nav('/login'); };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" elevation={0} sx={{
        zIndex: theme.zIndex.drawer + 1,
        bgcolor: 'primary.main',
        borderBottom: '1px solid rgba(255,255,255,0.12)'
      }}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={() => setOpen(p => !p)} sx={{ mr: 1 }}>
            {open && !isMobile ? <ChevronLeft /> : <MenuIcon />}
          </IconButton>
          <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1, letterSpacing: 0.5 }}>
            {title || 'ATC Exam Portal'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main', fontSize: 14 }}>
              {user?.username?.[0]?.toUpperCase()}
            </Avatar>
            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
              <Typography variant="body2" color="inherit" fontWeight={600}>{user?.username}</Typography>
              <Typography variant="caption" sx={{ opacity: 0.7, textTransform: 'capitalize' }}>{user?.role}</Typography>
            </Box>
            <Tooltip title="Sign out">
              <IconButton color="inherit" onClick={handleLogout} sx={{ ml: 1 }}>
                <LogoutRounded fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      <Drawer
        variant={isMobile ? 'temporary' : 'persistent'}
        open={open}
        onClose={() => setOpen(false)}
        sx={{
          width: (!isMobile && open) ? DRAWER_W : 0,
          flexShrink: 0,
          transition: theme.transitions.create('width'),
          '& .MuiDrawer-paper': {
            width: DRAWER_W, boxSizing: 'border-box',
            bgcolor: '#0d1540', color: 'white',
            border: 'none'
          }
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto', pt: 1 }}>
          <List>
            {navItems.map((item) => (
              <ListItem key={item.path} disablePadding>
                <ListItemButton
                  selected={loc.pathname === item.path}
                  onClick={() => { nav(item.path); if (isMobile) setOpen(false); }}
                  sx={{
                    mx: 1, borderRadius: 2, mb: 0.5,
                    '&.Mui-selected': { bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } },
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
                    color: 'white'
                  }}
                >
                  <ListItemIcon sx={{ color: 'rgba(255,255,255,0.7)', minWidth: 40 }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14, fontWeight: 500 }} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>

      <Box component="main" sx={{
        flexGrow: 1, minWidth: 0, overflow: 'hidden',
        p: { xs: 2, md: 3 },
        bgcolor: 'background.default', minHeight: '100vh',
        transition: theme.transitions.create('margin'),
      }}>
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
