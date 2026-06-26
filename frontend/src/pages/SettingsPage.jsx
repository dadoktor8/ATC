import React, { useState } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button,
  Alert, CircularProgress, Divider, Chip, Stack
} from '@mui/material';
import { Lock, Info } from '@mui/icons-material';
import { changePassword } from '../utils/api';
import { useAuth } from '../hooks/useAuth';

export default function SettingsPage() {
  const { user } = useAuth();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleChange = async () => {
    setError(''); setSuccess(false);
    if (form.next !== form.confirm) { setError('New passwords do not match.'); return; }
    if (form.next.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      await changePassword(form.current, form.next);
      setSuccess(true);
      setForm({ current: '', next: '', confirm: '' });
    } catch (e) {
      setError(e.response?.data?.error || 'Password change failed');
    } finally { setLoading(false); }
  };

  return (
    <Box sx={{ maxWidth: 600 }}>
      <Typography variant="h5" fontWeight={700} mb={3}>Settings</Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Info color="primary" />
            <Typography fontWeight={600}>Account Info</Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Box>
              <Typography variant="caption" color="text.secondary">Username</Typography>
              <Typography fontWeight={600}>{user?.username}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Role</Typography>
              <Box><Chip label={user?.role} size="small" color={user?.role === 'admin' ? 'primary' : 'default'} sx={{ textTransform: 'capitalize' }} /></Box>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Lock color="primary" />
            <Typography fontWeight={600}>Change Password</Typography>
          </Box>
          <Divider sx={{ mb: 2 }} />
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>Password changed successfully!</Alert>}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Current Password" type="password" fullWidth
              value={form.current} onChange={e => setForm(p => ({ ...p, current: e.target.value }))}
            />
            <TextField
              label="New Password" type="password" fullWidth
              value={form.next} onChange={e => setForm(p => ({ ...p, next: e.target.value }))}
              helperText="At least 6 characters"
            />
            <TextField
              label="Confirm New Password" type="password" fullWidth
              value={form.confirm} onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))}
              error={form.confirm.length > 0 && form.confirm !== form.next}
              helperText={form.confirm.length > 0 && form.confirm !== form.next ? 'Passwords do not match' : ''}
            />
            <Button
              variant="contained" onClick={handleChange}
              disabled={loading || !form.current || !form.next || !form.confirm}
              sx={{ alignSelf: 'flex-start', px: 4 }}
            >
              {loading ? <CircularProgress size={20} /> : 'Change Password'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
