import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, MenuItem,
  Chip, IconButton, Tooltip, Stack, InputAdornment,
  LinearProgress, Button, Alert
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import {
  Search, Edit, CheckCircle, RadioButtonUnchecked,
  FilterList, Assessment
} from '@mui/icons-material';
import { EditNote, DescriptionOutlined } from '@mui/icons-material';
import AppShell from '../components/AppShell';
import MarksForm from '../components/operator/MarksForm';
import { getStudents, downloadMarksheet, triggerDownload } from '../utils/api';

const YEARS = ['All','P.P.- 1st','P.P.- 2nd','P.P.- 3rd','B.C. - I','B.C. - II','FIRST','SECOND','THIRD','FOURTH','FIFTH'];
const divColor = { FIRST: 'success', SECOND: 'info', THIRD: 'warning', FAIL: 'error' };

const NAV = [
  { path: '/operator', label: 'Marks Entry', icon: <EditNote /> },
];

export default function OperatorDashboard() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

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

  const filtered = students.filter(s => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.roll_no.includes(search);
    const matchStatus = statusFilter === 'all' ||
      (statusFilter === 'done' && s.total_marks != null) ||
      (statusFilter === 'pending' && s.total_marks == null);
    return matchSearch && matchStatus;
  });

  const done = students.filter(s => s.total_marks != null).length;
  const pending = students.length - done;
  const pct = students.length ? Math.round((done / students.length) * 100) : 0;

  const handleEdit = (student) => {
    setSelectedStudent(student);
    setFormOpen(true);
  };

  const handleDownloadMarksheet = async (id, roll_no) => {
    try {
      const { data } = await downloadMarksheet(id);
      triggerDownload(data, `marksheet-${roll_no}.docx`);
    } catch {
      alert('Could not generate marksheet. Make sure marks are saved.');
    }
  };

  const columns = [
    {
      field: 'status', headerName: '', width: 40, sortable: false,
      renderCell: ({ row }) => row.total_marks != null
        ? <CheckCircle sx={{ color: 'success.main', fontSize: 20 }} />
        : <RadioButtonUnchecked sx={{ color: 'grey.400', fontSize: 20 }} />
    },
    { field: 'roll_no', headerName: 'Roll No.', width: 100 },
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 200 },
    { field: 'year', headerName: 'Year', width: 120 },
    { field: 'subject', headerName: 'Subject', width: 110 },
    {
      field: 'total_marks', headerName: 'Total', width: 80,
      renderCell: ({ value }) => value != null ? <Typography fontWeight={700}>{value}</Typography> : <Typography color="text.disabled">—</Typography>
    },
    {
      field: 'division', headerName: 'Division', width: 110,
      renderCell: ({ value }) => value
        ? <Chip label={value} size="small" color={divColor[value] || 'default'} />
        : <Chip label="Not entered" size="small" variant="outlined" color="default" />
    },
    {
      field: 'actions', headerName: 'Actions', width: 140, sortable: false,
      renderCell: ({ row }) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title={row.total_marks != null ? 'Edit Marks' : 'Enter Marks'}>
            <IconButton size="small" color="primary" onClick={() => handleEdit(row)}>
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          {row.total_marks != null && (
            <Tooltip title="Download Marksheet">
              <IconButton size="small" color="secondary" onClick={() => handleDownloadMarksheet(row.id, row.roll_no)}>
                <Assessment fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      )
    }
  ];

  return (
    <AppShell navItems={NAV} title="Operator — Marks Entry">
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" fontWeight={600}>
              Entry Progress — {done} of {students.length} students
            </Typography>
            <Typography variant="body2" color="text.secondary">{pct}%</Typography>
          </Box>
          <LinearProgress
            variant="determinate" value={pct}
            sx={{ height: 8, borderRadius: 4 }}
            color={pct === 100 ? 'success' : 'primary'}
          />
          <Stack direction="row" spacing={2} sx={{ mt: 1.5 }}>
            <Chip size="small" icon={<CheckCircle sx={{ fontSize: '14px !important' }} />} label={`${done} done`} color="success" variant="outlined" />
            <Chip size="small" icon={<RadioButtonUnchecked sx={{ fontSize: '14px !important' }} />} label={`${pending} pending`} color="warning" variant="outlined" />
          </Stack>
        </CardContent>
      </Card>

      {pending === 0 && students.length > 0 && (
        <Alert severity="success" sx={{ mb: 2 }} icon={<CheckCircle />}>
          All marks have been entered! You can now ask the admin to generate result sheets.
        </Alert>
      )}

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
            >
              {YEARS.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
            </TextField>
            <TextField
              size="small" select label="Status" value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)} sx={{ width: 150 }}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="done">Entered</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
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
            onRowDoubleClick={({ row }) => handleEdit(row)}
            disableRowSelectionOnClick
            sx={{
              border: 'none',
              '& .MuiDataGrid-columnHeader': { bgcolor: 'grey.50', fontWeight: 700 },
              '& .MuiDataGrid-row': { cursor: 'pointer' },
              '& .MuiDataGrid-row:hover': { bgcolor: 'primary.50' }
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Double-click any row to enter marks
          </Typography>
        </CardContent>
      </Card>

      <MarksForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        student={selectedStudent}
        onSaved={fetchStudents}
      />
    </AppShell>
  );
}
