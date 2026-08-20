import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Button, TextField, MenuItem,
  Chip, IconButton, Tooltip, Stack, Dialog, DialogTitle,
  DialogContent, DialogActions, Alert, CircularProgress,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { Add, Edit, Delete, Lock } from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { getUsers, createUser, updateUserRole, resetUserPassword, deleteUser } from '../utils/api';

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  admin:       'Admin',
  maintainer:  'Maintainer',
};
const ROLE_COLORS = {
  super_admin: 'error',
  admin:       'primary',
  maintainer:  'default',
};

function RoleChip({ role }) {
  return <Chip label={ROLE_LABELS[role] || role} size="small"
    color={ROLE_COLORS[role] || 'default'} variant="outlined" />;
}

// ── Add User Dialog ───────────────────────────────────────────────
function AddUserDialog({ open, onClose, onSaved, callerRole }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole]         = useState('maintainer');
  const [error, setError]       = useState('');
  const [saving, setSaving]     = useState(false);

  const roleOptions = callerRole === 'super_admin'
    ? ['super_admin', 'admin', 'maintainer']
    : ['maintainer'];

  useEffect(() => {
    if (open) { setUsername(''); setPassword(''); setRole('maintainer'); setError(''); }
  }, [open]);

  const handleSave = async () => {
    if (!username.trim() || !password) { setError('All fields required.'); return; }
    if (password.length < 10) { setError('Password must be at least 10 characters.'); return; }
    setSaving(true);
    try {
      await createUser({ username: username.trim(), password, role });
      onSaved();
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to create user.');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle fontWeight={700}>Add User</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <TextField size="small" label="Username" fullWidth
            value={username} onChange={e => setUsername(e.target.value)} />
          <TextField size="small" label="Password" type="password" fullWidth
            value={password} onChange={e => setPassword(e.target.value)} />
          <TextField size="small" label="Role" select fullWidth
            value={role} onChange={e => setRole(e.target.value)}>
            {roleOptions.map(r => (
              <MenuItem key={r} value={r}>{ROLE_LABELS[r]}</MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Creating…' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Change Role Dialog ────────────────────────────────────────────
function ChangeRoleDialog({ open, onClose, onSaved, target, callerRole }) {
  const [role, setRole]     = useState('');
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);

  const roleOptions = callerRole === 'super_admin'
    ? ['super_admin', 'admin', 'maintainer']
    : ['maintainer'];

  useEffect(() => {
    if (open && target) { setRole(target.role); setError(''); }
  }, [open, target]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateUserRole(target.id, role);
      onSaved();
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to update role.');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle fontWeight={700}>Change Role — {target?.username}</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField size="small" label="Role" select fullWidth sx={{ mt: 0.5 }}
          value={role} onChange={e => setRole(e.target.value)}>
          {roleOptions.map(r => (
            <MenuItem key={r} value={r}>{ROLE_LABELS[r]}</MenuItem>
          ))}
        </TextField>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || role === target?.role}>
          {saving ? 'Saving…' : 'Update'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Reset Password Dialog ─────────────────────────────────────────
function ResetPasswordDialog({ open, onClose, target }) {
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [done, setDone]         = useState(false);

  useEffect(() => {
    if (open) { setPassword(''); setError(''); setDone(false); }
  }, [open]);

  const handleSave = async () => {
    if (password.length < 10) { setError('Password must be at least 10 characters.'); return; }
    setSaving(true);
    try {
      await resetUserPassword(target.id, password);
      setDone(true);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to reset password.');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle fontWeight={700}>Reset Password — {target?.username}</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {done
          ? <Alert severity="success">Password updated successfully.</Alert>
          : <TextField size="small" label="New Password" type="password" fullWidth sx={{ mt: 0.5 }}
              value={password} onChange={e => setPassword(e.target.value)} />
        }
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>{done ? 'Close' : 'Cancel'}</Button>
        {!done && (
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Reset'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers]           = useState([]);
  const [loading, setLoading]       = useState(false);
  const [addOpen, setAddOpen]       = useState(false);
  const [roleTarget, setRoleTarget] = useState(null);
  const [pwTarget, setPwTarget]     = useState(null);
  const [delTarget, setDelTarget]   = useState(null);
  const [delError, setDelError]     = useState('');

  const fetch = useCallback(async () => {
    setLoading(true);
    try { const { data } = await getUsers(); setUsers(data); }
    catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const handleDelete = async () => {
    setDelError('');
    try {
      await deleteUser(delTarget.id);
      setDelTarget(null);
      fetch();
    } catch (e) {
      setDelError(e.response?.data?.error || 'Delete failed.');
    }
  };

  const canManage = (target) => {
    if (target.id === me.id) return false;
    if (me.role === 'super_admin') return true;
    if (me.role === 'admin') return target.role === 'maintainer';
    return false;
  };

  const columns = [
    { field: 'username', headerName: 'Username', flex: 1, fontWeight: 600 },
    {
      field: 'role', headerName: 'Role', width: 150,
      renderCell: ({ value }) => <RoleChip role={value} />,
    },
    { field: 'created_at', headerName: 'Created', flex: 1,
      renderCell: ({ value }) => value ? new Date(value).toLocaleDateString() : '—' },
    {
      field: 'actions', headerName: 'Actions', width: 140, sortable: false,
      renderCell: ({ row }) => canManage(row) ? (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Change Role">
            <IconButton size="small" color="primary" onClick={() => setRoleTarget(row)}>
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Reset Password">
            <IconButton size="small" color="warning" onClick={() => setPwTarget(row)}>
              <Lock fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" color="error"
              onClick={() => { setDelTarget(row); setDelError(''); }}>
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ) : (
        <Typography variant="caption" color="text.disabled">
          {row.id === me.id ? 'You' : '—'}
        </Typography>
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Users</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage portal access — Super Admin, Admin, and Maintainer accounts
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setAddOpen(true)}>
          Add User
        </Button>
      </Box>

      <Card>
        <CardContent sx={{ p: '0 !important' }}>
          <DataGrid
            rows={users}
            columns={columns}
            loading={loading}
            autoHeight
            disableRowSelectionOnClick
            pageSizeOptions={[25]}
            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
            sx={{ border: 'none', '& .MuiDataGrid-columnHeader': { bgcolor: 'grey.50', fontWeight: 700 } }}
          />
        </CardContent>
      </Card>

      <AddUserDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={fetch}
        callerRole={me.role}
      />
      <ChangeRoleDialog
        open={!!roleTarget}
        onClose={() => setRoleTarget(null)}
        onSaved={fetch}
        target={roleTarget}
        callerRole={me.role}
      />
      <ResetPasswordDialog
        open={!!pwTarget}
        onClose={() => setPwTarget(null)}
        target={pwTarget}
      />

      <Dialog open={!!delTarget} onClose={() => setDelTarget(null)}>
        <DialogTitle>Delete User?</DialogTitle>
        <DialogContent>
          {delError
            ? <Alert severity="error">{delError}</Alert>
            : <Alert severity="warning">
                Delete <strong>{delTarget?.username}</strong>? This cannot be undone.
              </Alert>
          }
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDelTarget(null)}>Cancel</Button>
          {!delError && (
            <Button color="error" variant="contained" onClick={handleDelete}>Delete</Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
