import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Button, TextField, MenuItem,
  Chip, IconButton, Tooltip, Stack, InputAdornment,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert
} from '@mui/material';
import {
  DataGrid, GridToolbarContainer, GridToolbarExport
} from '@mui/x-data-grid';
import {
  PersonAdd, UploadFile, Download, Edit, Delete,
  Search, FilterList, PeopleAlt, HowToReg, AssignmentTurnedIn
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import StudentForm from '../components/admin/StudentForm';
import BulkImport from '../components/admin/BulkImport';
import {
  getStudents, deleteStudent,
  downloadAdmitCard, triggerDownload
} from '../utils/api';
import { YEAR_NAMES } from '../utils/constants';

const YEARS = ['All', ...YEAR_NAMES];

const divisionColor = { FIRST: 'success', SECOND: 'info', THIRD: 'warning', FAIL: 'error' };

function StatCard({ label, value, icon, color }) {
  return (
    <Card sx={{ flex: 1 }}>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: '16px !important' }}>
        <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: `${color}.50`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {React.cloneElement(icon, { sx: { color: `${color}.700` } })}
        </Box>
        <Box>
          <Typography variant="h5" fontWeight={700}>{value}</Typography>
          <Typography variant="body2" color="text.secondary">{label}</Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

function CustomToolbar() {
  return (
    <GridToolbarContainer>
      <GridToolbarExport printOptions={{ disableToolbarButton: true }} />
    </GridToolbarContainer>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('All');
  const [editOpen, setEditOpen] = useState(false);
  const [editStudent, setEditStudent] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (yearFilter !== 'All') params.year = yearFilter;
      const { data } = await getStudents(params);
      setStudents(data);
    } finally {
      setLoading(false);
    }
  }, [yearFilter]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const filtered = students.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.roll_no.includes(search)
  );

  const withMarks = students.filter(s => s.total_marks != null).length;

  const handleDelete = async (id) => {
    await deleteStudent(id);
    setDeleteConfirm(null);
    fetchStudents();
  };

  const handleDownloadAdmit = async (id, roll_no) => {
    const { data } = await downloadAdmitCard(id);
    triggerDownload(data, `admit-card-${roll_no}.pdf`);
  };

  const columns = [
    { field: 'roll_no', headerName: 'Roll No.', width: 85 },
    { field: 'name', headerName: 'Name', flex: 2 },
    { field: 'year', headerName: 'Year', flex: 1 },
    { field: 'subject', headerName: 'Subject', flex: 1 },
    {
      field: 'division', headerName: 'Division', width: 100,
      renderCell: ({ value }) => value
        ? <Chip label={value} size="small" color={divisionColor[value] || 'default'} />
        : <Chip label="Pending" size="small" variant="outlined" />
    },
    { field: 'total_marks', headerName: 'Total', width: 70,
      renderCell: ({ value }) => value ?? '—'
    },
    {
      field: 'actions', headerName: 'Actions', width: 120, sortable: false,
      renderCell: ({ row }) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Edit"><IconButton size="small" onClick={() => { setEditStudent(row); setEditOpen(true); }}><Edit fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Admit Card (PDF)"><IconButton size="small" color="primary" onClick={() => handleDownloadAdmit(row.id, row.roll_no)}><Download fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => setDeleteConfirm(row)}><Delete fontSize="small" /></IconButton></Tooltip>
        </Stack>
      )
    }
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <StatCard label="Total Students" value={students.length} icon={<PeopleAlt />} color="primary" />
        <StatCard label="Results Entered" value={withMarks} icon={<HowToReg />} color="success" />
        <StatCard label="Pending Results" value={students.length - withMarks} icon={<AssignmentTurnedIn />} color="warning" />
      </Box>

      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Button variant="contained" startIcon={<PersonAdd />} onClick={() => navigate('/admin/register')}>
          Register Student
        </Button>
        <Button variant="outlined" startIcon={<UploadFile />} onClick={() => setBulkOpen(true)}>
          Bulk Import
        </Button>
      </Stack>

      <Card>
          <CardContent>
            <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
              <TextField
                size="small" placeholder="Search name or roll no…"
                value={search} onChange={e => setSearch(e.target.value)}
                sx={{ width: 260 }}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
              />
              <TextField
                size="small" select label="Year" value={yearFilter}
                onChange={e => setYearFilter(e.target.value)} sx={{ width: 150 }}
                InputProps={{ startAdornment: <InputAdornment position="start"><FilterList fontSize="small" /></InputAdornment> }}
              >
                {YEARS.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
              </TextField>
              <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto', alignSelf: 'center' }}>
                {filtered.length} student{filtered.length !== 1 ? 's' : ''}
              </Typography>
            </Box>

            <DataGrid
              rows={filtered}
              columns={columns}
              loading={loading}
              autoHeight
              pageSizeOptions={[25, 50, 100]}
              initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
              slots={{ toolbar: CustomToolbar }}
              disableRowSelectionOnClick
              sx={{
                border: 'none',
                '& .MuiDataGrid-columnHeader': { bgcolor: 'grey.50', fontWeight: 700 },
                '& .MuiDataGrid-virtualScroller': { overflowX: 'hidden' },
              }}
            />
          </CardContent>
        </Card>

      <StudentForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        student={editStudent}
        onSaved={fetchStudents}
      />

      <BulkImport
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onImported={fetchStudents}
      />

      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>Delete Student?</DialogTitle>
        <DialogContent>
          <Alert severity="warning">
            This will permanently delete <strong>{deleteConfirm?.name}</strong> (Roll: {deleteConfirm?.roll_no}) and all their marks.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => handleDelete(deleteConfirm.id)}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
