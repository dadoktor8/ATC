import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Button, TextField, MenuItem,
  Chip, IconButton, Tooltip, Stack, InputAdornment,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, Grid, Tab, Tabs, CircularProgress
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import {
  Add, Edit, Delete, FilterList, Groups,
  PersonAdd, PersonRemove, Search, TableChart, Grading, Assignment, Assessment,
} from '@mui/icons-material';
import {
  getCenters, getBatches, createBatch, updateBatch, deleteBatch,
  getBatchStudents, getStudents, assignStudentsToBatch, removeStudentFromBatch,
  downloadAllocationSheetPdf, downloadResultSheetPdf, downloadMarkSheetPdf, triggerDownload,
} from '../utils/api';
import CenterPicker from '../components/admin/CenterPicker';

import { YEAR_NAMES, SUBJECT_NAMES } from '../utils/constants';
const YEARS = YEAR_NAMES;
const SUBJECTS = SUBJECT_NAMES;

function buildSessions() {
  const cur = new Date().getFullYear();
  const list = [];
  for (let y = cur - 3; y <= cur + 3; y++) list.push(`${y}-${y + 1}`);
  return list;
}
const SESSIONS = buildSessions();

const EMPTY_FORM = {
  center_id: '', session: '', year: '', subject: '', status: 'active'
};

// ── Batch create/edit dialog ──────────────────────────────────────────────────
function BatchFormDialog({ open, onClose, onSaved, editBatch, centers }) {
  const [selectedCenter, setSelectedCenter] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setError('');
      if (editBatch) {
        setForm({ ...EMPTY_FORM, ...editBatch });
        const c = centers.find(c => String(c.id) === String(editBatch.center_id));
        setSelectedCenter(c || null);
      } else {
        setForm(EMPTY_FORM);
        setSelectedCenter(null);
      }
    }
  }, [editBatch, open, centers]);

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSave = async () => {
    setError('');
    if (!selectedCenter?.id || !form.session) {
      setError('Center and session are required.'); return;
    }
    setLoading(true);
    try {
      const payload = { ...form, center_id: selectedCenter.id };
      editBatch?.id ? await updateBatch(editBatch.id, payload) : await createBatch(payload);
      onSaved(); onClose();
    } catch (e) {
      setError(e.response?.data?.error || 'Save failed');
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{editBatch?.id ? 'Edit Batch' : 'Create New Batch'}</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Typography variant="overline" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>Center</Typography>
        <CenterPicker
          value={selectedCenter}
          onChange={setSelectedCenter}
          readOnly={true}
          showDetails={true}
        />
        <Typography variant="overline" color="text.secondary" sx={{ mt: 2.5, mb: 1, display: 'block' }}>Batch Details</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField label="Session *" select fullWidth value={form.session} onChange={set('session')}>
              {SESSIONS.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Year / Class" select fullWidth value={form.year} onChange={set('year')}>
              <MenuItem value="">— All years —</MenuItem>
              {YEARS.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Subject (optional)" select fullWidth value={form.subject} onChange={set('subject')}>
              <MenuItem value="">All Subjects</MenuItem>
              {SUBJECTS.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Status" select fullWidth value={form.status} onChange={set('status')}>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={loading} sx={{ minWidth: 110 }}>
          {loading ? 'Saving…' : editBatch?.id ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Manage students dialog ────────────────────────────────────────────────────
function BatchStudentsDialog({ open, onClose, batch, onChanged }) {
  const [tab, setTab] = useState(0);

  // enrolled tab state
  const [enrolled, setEnrolled] = useState([]);
  const [enrolledLoading, setEnrolledLoading] = useState(false);

  // add tab state
  const [available, setAvailable] = useState([]);
  const [availLoading, setAvailLoading] = useState(false);
  const [filterYear, setFilterYear] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState('');

  const fetchEnrolled = useCallback(async () => {
    if (!batch) return;
    setEnrolledLoading(true);
    try {
      const { data } = await getBatchStudents(batch.id);
      setEnrolled(data);
    } finally { setEnrolledLoading(false); }
  }, [batch]);

  const fetchAvailable = useCallback(async () => {
    if (!batch) return;
    setAvailLoading(true);
    try {
      const params = { unassigned: '1' };
      if (filterYear) params.year = filterYear;
      const { data } = await getStudents(params);
      setAvailable(data);
    } finally { setAvailLoading(false); }
  }, [batch, filterYear]);

  useEffect(() => {
    if (open && batch) { setTab(0); setMsg(''); setSelected([]); setFilterYear(''); setSearch(''); fetchEnrolled(); }
  }, [open, batch]);

  useEffect(() => { if (open && tab === 1) fetchAvailable(); }, [open, tab, fetchAvailable]);

  const handleRemove = async (studentId) => {
    await removeStudentFromBatch(batch.id, studentId);
    fetchEnrolled();
    onChanged();
  };

  const handleAdd = async () => {
    if (!selected.length) return;
    setAdding(true); setMsg('');
    try {
      await assignStudentsToBatch(batch.id, selected);
      setMsg(`${selected.length} student(s) added to batch.`);
      setSelected([]);
      fetchAvailable();
      fetchEnrolled();
      onChanged();
    } catch (e) {
      setMsg(e.response?.data?.error || 'Failed to add students.');
    } finally { setAdding(false); }
  };

  const filteredAvailable = available.filter(s =>
    !search ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.roll_no?.includes(search)
  );

  const enrolledCols = [
    { field: 'roll_no', headerName: 'Roll No.', width: 90 },
    { field: 'name', headerName: 'Name', flex: 2 },
    { field: 'year', headerName: 'Year', flex: 1 },
    { field: 'subject', headerName: 'Subject', flex: 1 },
    {
      field: 'remove', headerName: '', width: 60, sortable: false,
      renderCell: ({ row }) => (
        <Tooltip title="Remove from batch">
          <IconButton size="small" color="error" onClick={() => handleRemove(row.id)}>
            <PersonRemove fontSize="small" />
          </IconButton>
        </Tooltip>
      )
    }
  ];

  const availCols = [
    { field: 'roll_no', headerName: 'Roll No.', width: 90 },
    { field: 'name', headerName: 'Name', flex: 2 },
    { field: 'year', headerName: 'Year', flex: 1 },
    { field: 'subject', headerName: 'Subject', flex: 1 },
    { field: 'center_name', headerName: 'Center', flex: 1 },
  ];

  if (!batch) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, pb: 0 }}>
        Manage Students — <Chip label={batch.batch_code} size="small" color="primary" sx={{ ml: 1 }} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {batch.year} · {batch.session} · {batch.center_name}
        </Typography>
      </DialogTitle>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label={`Enrolled (${enrolled.length})`} />
          <Tab label="Add Students" />
        </Tabs>
      </Box>

      <DialogContent sx={{ p: 0, minHeight: 380 }}>
        {msg && (
          <Alert severity={msg.includes('Failed') ? 'error' : 'success'} sx={{ mx: 2, mt: 2 }}
            onClose={() => setMsg('')}>{msg}</Alert>
        )}

        {/* ── Enrolled tab ── */}
        {tab === 0 && (
          <Box sx={{ p: 2 }}>
            {enrolled.length === 0 && !enrolledLoading ? (
              <Alert severity="info">No students enrolled yet. Use the "Add Students" tab.</Alert>
            ) : (
              <DataGrid
                rows={enrolled}
                columns={enrolledCols}
                loading={enrolledLoading}
                autoHeight
                pageSizeOptions={[25, 50]}
                initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
                disableRowSelectionOnClick
                sx={{ border: 'none', '& .MuiDataGrid-columnHeader': { bgcolor: 'grey.50', fontWeight: 700 } }}
              />
            )}
          </Box>
        )}

        {/* ── Add students tab ── */}
        {tab === 1 && (
          <Box sx={{ p: 2 }}>
            <Stack direction="row" spacing={1.5} sx={{ mb: 2, flexWrap: 'wrap' }}>
              <TextField
                size="small" placeholder="Search name or roll no…"
                value={search} onChange={e => setSearch(e.target.value)}
                sx={{ width: 220 }}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
              />
              <TextField
                size="small" select label="Year" value={filterYear}
                onChange={e => setFilterYear(e.target.value)} sx={{ width: 150 }}
                InputProps={{ startAdornment: <InputAdornment position="start"><FilterList fontSize="small" /></InputAdornment> }}
              >
                <MenuItem value="">All Years</MenuItem>
                {YEARS.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
              </TextField>
              <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center', ml: 'auto !important' }}>
                {filteredAvailable.length} unassigned student{filteredAvailable.length !== 1 ? 's' : ''}
              </Typography>
            </Stack>

            <DataGrid
              rows={filteredAvailable}
              columns={availCols}
              loading={availLoading}
              autoHeight
              checkboxSelection
              rowSelectionModel={selected}
              onRowSelectionModelChange={setSelected}
              pageSizeOptions={[25, 50]}
              initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
              sx={{ border: 'none', '& .MuiDataGrid-columnHeader': { bgcolor: 'grey.50', fontWeight: 700 } }}
            />
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button onClick={onClose}>Close</Button>
        {tab === 1 && (
          <Button
            variant="contained" startIcon={adding ? <CircularProgress size={16} color="inherit" /> : <PersonAdd />}
            disabled={!selected.length || adding}
            onClick={handleAdd}
          >
            Add Selected ({selected.length})
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function BatchesPage() {
  const navigate = useNavigate();
  const [batches, setBatches] = useState([]);
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterCenter, setFilterCenter] = useState('');
  const [filterSession, setFilterSession] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editBatch, setEditBatch] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [manageBatch, setManageBatch] = useState(null);
  const [downloadingSheet, setDownloadingSheet] = useState(null);
  const [downloadingResultSheet, setDownloadingResultSheet] = useState(null);
  const [downloadingMarkSheet, setDownloadingMarkSheet] = useState(null);

  useEffect(() => {
    getCenters().then(({ data }) => setCenters(data)).catch(() => {});
  }, []);

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterCenter) params.center_id = filterCenter;
      if (filterSession) params.session = filterSession;
      const { data } = await getBatches(params);
      setBatches(data);
    } finally { setLoading(false); }
  }, [filterCenter, filterSession]);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);

  const handleDownloadSheet = async (batch) => {
    setDownloadingSheet(batch.id);
    try {
      const { data } = await downloadAllocationSheetPdf(batch.id);
      triggerDownload(data, `allocation-sheet-${batch.batch_code}.pdf`);
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to generate allocation sheet.');
    } finally { setDownloadingSheet(null); }
  };

  const handleDownloadResultSheet = async (batch) => {
    setDownloadingResultSheet(batch.id);
    try {
      const { data } = await downloadResultSheetPdf(batch.id);
      triggerDownload(data, `result-sheet-${batch.batch_code}.pdf`);
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to generate result sheet.');
    } finally { setDownloadingResultSheet(null); }
  };

  const handleDownloadMarkSheet = async (batch) => {
    setDownloadingMarkSheet(batch.id);
    try {
      const { data } = await downloadMarkSheetPdf(batch.id);
      triggerDownload(data, `mark-sheets-${batch.batch_code}.pdf`);
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to generate mark sheets.');
    } finally { setDownloadingMarkSheet(null); }
  };

  const handleDelete = async (id) => {
    setDeleteError('');
    try {
      await deleteBatch(id);
      setDeleteConfirm(null);
      fetchBatches();
    } catch (e) {
      setDeleteError(e.response?.data?.error || 'Delete failed');
    }
  };

  const columns = [
    { field: 'batch_code', headerName: 'Batch ID', width: 120 },
    { field: 'center_code', headerName: 'Center Code', width: 110,
      renderCell: ({ value }) => value || <Typography variant="caption" color="text.disabled">—</Typography>
    },
    { field: 'center_name', headerName: 'Center', flex: 2 },
    { field: 'center_teacher', headerName: 'Teacher', flex: 1.5,
      renderCell: ({ value }) => value || <Typography variant="caption" color="text.disabled">—</Typography>
    },
    { field: 'co_name', headerName: 'C/O', flex: 1.5,
      renderCell: ({ value }) => value || <Typography variant="caption" color="text.disabled">—</Typography>
    },
    { field: 'center_address', headerName: 'Address', flex: 2,
      renderCell: ({ value }) => value || <Typography variant="caption" color="text.disabled">—</Typography>
    },
    { field: 'session', headerName: 'Session', width: 95 },
    {
      field: 'student_count', headerName: 'Students', width: 80,
      renderCell: ({ value }) => (
        <Chip icon={<Groups sx={{ fontSize: '14px !important' }} />}
          label={value ?? 0} size="small" variant="outlined" />
      )
    },
    {
      field: 'status', headerName: 'Status', width: 90,
      renderCell: ({ value }) => (
        <Chip label={value} size="small" color={value === 'active' ? 'success' : 'default'} variant="outlined" />
      )
    },
    {
      field: 'actions', headerName: 'Actions', width: 200, sortable: false,
      renderCell: ({ row }) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Manage Students">
            <IconButton size="small" color="primary" onClick={() => setManageBatch(row)}>
              <Groups fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Enter Results">
            <span>
              <IconButton size="small" color="secondary"
                disabled={(row.student_count ?? 0) === 0}
                onClick={() => navigate(`/admin/results/${row.id}`)}>
                <Grading fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Download Allocation Sheet">
            <span>
              <IconButton size="small" color="success"
                disabled={downloadingSheet === row.id || (row.student_count ?? 0) === 0}
                onClick={() => handleDownloadSheet(row)}>
                {downloadingSheet === row.id
                  ? <CircularProgress size={16} />
                  : <TableChart fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Download Result Sheet">
            <span>
              <IconButton size="small" color="warning"
                disabled={downloadingResultSheet === row.id || (row.student_count ?? 0) === 0}
                onClick={() => handleDownloadResultSheet(row)}>
                {downloadingResultSheet === row.id
                  ? <CircularProgress size={16} />
                  : <Assessment fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Download Mark Sheets">
            <span>
              <IconButton size="small" color="info"
                disabled={downloadingMarkSheet === row.id || (row.student_count ?? 0) === 0}
                onClick={() => handleDownloadMarkSheet(row)}>
                {downloadingMarkSheet === row.id
                  ? <CircularProgress size={16} />
                  : <Assignment fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => { setEditBatch(row); setDialogOpen(true); }}>
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" color="error" onClick={() => { setDeleteConfirm(row); setDeleteError(''); }}>
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      )
    }
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Batches</Typography>
          <Typography variant="body2" color="text.secondary">
            Group students by exam time frame within the same center and session
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />}
          onClick={() => { setEditBatch(null); setDialogOpen(true); }}>
          New Batch
        </Button>
      </Box>

      <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small" select label="Center" value={filterCenter}
          onChange={e => setFilterCenter(e.target.value)} sx={{ minWidth: 220 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><FilterList fontSize="small" /></InputAdornment> }}
        >
          <MenuItem value="">All Centers</MenuItem>
          {centers.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
        </TextField>
        <TextField
          size="small" select label="Session" value={filterSession}
          onChange={e => setFilterSession(e.target.value)} sx={{ minWidth: 140 }}
        >
          <MenuItem value="">All Sessions</MenuItem>
          {SESSIONS.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </TextField>
        <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto !important', alignSelf: 'center' }}>
          {batches.length} batch{batches.length !== 1 ? 'es' : ''}
        </Typography>
      </Stack>

      <Card>
        <CardContent sx={{ p: '0 !important' }}>
          <DataGrid
            rows={batches}
            columns={columns}
            loading={loading}
            autoHeight
            pageSizeOptions={[25, 50]}
            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
            disableRowSelectionOnClick
            sx={{
              border: 'none',
              '& .MuiDataGrid-columnHeader': { bgcolor: 'grey.50', fontWeight: 700 },
              '& .MuiDataGrid-virtualScroller': { overflowX: 'hidden' },
            }}
          />
        </CardContent>
      </Card>

      <BatchFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={fetchBatches}
        editBatch={editBatch}
        centers={centers}
      />


      <BatchStudentsDialog
        open={!!manageBatch}
        onClose={() => setManageBatch(null)}
        batch={manageBatch}
        onChanged={fetchBatches}
      />

      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>Delete Batch?</DialogTitle>
        <DialogContent>
          {deleteError
            ? <Alert severity="error">{deleteError}</Alert>
            : <Alert severity="warning">
                Delete batch <strong>{deleteConfirm?.batch_code}</strong>?
                {deleteConfirm?.student_count > 0 && (
                  <><br />This batch has <strong>{deleteConfirm.student_count}</strong> students — unassign them first.</>
                )}
              </Alert>
          }
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          {!deleteError && (
            <Button color="error" variant="contained" onClick={() => handleDelete(deleteConfirm.id)}>Delete</Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
