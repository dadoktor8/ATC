import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Button, TextField, MenuItem,
  Table, TableHead, TableBody, TableRow, TableCell,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, Chip, Tooltip, CircularProgress, Grid
} from '@mui/material';
import { Add, Edit, Delete, LocationCity } from '@mui/icons-material';
import { getCenters, createCenter, updateCenter, deleteCenter } from '../utils/api';
import { STATES, DISTRICTS_BY_STATE } from '../utils/constants';

const EMPTY = {
  code: '', incharge_name: '', co_name: '',
  name: '', address: '', state: 'Assam', district: '',
  incharge_title: '',
};

export default function CentersPage() {
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchCenters = async () => {
    setLoading(true);
    try { const { data } = await getCenters(); setCenters(data); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchCenters(); }, []);

  const openNew  = () => { setEditing(null); setForm(EMPTY); setError(''); setFormOpen(true); };
  const openEdit = (c) => { setEditing(c); setForm({ ...EMPTY, ...c }); setError(''); setFormOpen(true); };

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Center name is required.'); return; }
    setSaving(true);
    try {
      if (editing) await updateCenter(editing.id, form);
      else await createCenter(form);
      setFormOpen(false);
      fetchCenters();
    } catch (e) {
      setError(e.response?.data?.error || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this center?')) return;
    try { await deleteCenter(id); fetchCenters(); }
    catch (e) { alert(e.response?.data?.error || 'Delete failed'); }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Exam Centers</Typography>
          <Typography variant="body2" color="text.secondary">Manage centers and their incharge officers</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={openNew}>Add Center</Button>
      </Box>

      <Card>
        <CardContent sx={{ p: 0 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell sx={{ fontWeight: 700 }}>Code</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Teacher</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>C/O</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Center Name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Address</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>State</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>District</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} align="center"><CircularProgress size={24} /></TableCell></TableRow>
              ) : centers.length === 0 ? (
                <TableRow><TableCell colSpan={8} align="center">
                  <Typography color="text.secondary" py={2}>No centers yet</Typography>
                </TableCell></TableRow>
              ) : centers.map(c => (
                <TableRow key={c.id} hover>
                  <TableCell>
                    {c.code
                      ? <Chip label={c.code} size="small" color="primary" variant="outlined" />
                      : <Typography variant="caption" color="text.disabled">—</Typography>}
                  </TableCell>
                  <TableCell>{c.incharge_name || '—'}</TableCell>
                  <TableCell>{c.co_name || '—'}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LocationCity fontSize="small" color="primary" />
                      <Typography fontWeight={500}>{c.name}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{c.address || '—'}</TableCell>
                  <TableCell>{c.state || '—'}</TableCell>
                  <TableCell><Chip label={c.district || '—'} size="small" variant="outlined" /></TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEdit(c)}><Edit fontSize="small" /></IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => handleDelete(c.id)}><Delete fontSize="small" /></IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Add / Edit Dialog ── */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>{editing ? 'Edit Center' : 'Add New Center'}</DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField size="small" label="Center Code" fullWidth value={form.code} onChange={set('code')}
                helperText="Optional short identifier" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField size="small" label="Teacher's Name" fullWidth value={form.incharge_name} onChange={set('incharge_name')} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField size="small" label="C/O" fullWidth value={form.co_name} onChange={set('co_name')} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField size="small" label="Center Name *" fullWidth value={form.name} onChange={set('name')} />
            </Grid>
            <Grid item xs={12}>
              <TextField size="small" label="Address" fullWidth value={form.address} onChange={set('address')} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField size="small" label="State" select fullWidth value={form.state}
                onChange={e => setForm(p => ({ ...p, state: e.target.value, district: '' }))}>
                {STATES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              {DISTRICTS_BY_STATE[form.state] ? (
                <TextField size="small" label="District" select fullWidth value={form.district || ''} onChange={set('district')}>
                  <MenuItem value="">— Select District —</MenuItem>
                  {DISTRICTS_BY_STATE[form.state].map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                </TextField>
              ) : (
                <TextField size="small" label="District" fullWidth value={form.district || ''} onChange={set('district')} />
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setFormOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : editing ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
