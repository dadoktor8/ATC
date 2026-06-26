import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Card, CardContent, Typography, Button, TextField, Chip,
  Stack, Alert, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, InputAdornment, List, ListItem,
  ListItemButton, ListItemText
} from '@mui/material';
import {
  Search, Close, ChevronLeft, ChevronRight,
  SaveAlt, Print, Groups, AccessTime
} from '@mui/icons-material';
import {
  getBatches, getBatchStudents,
  downloadBatchAdmitCardsPdf, getStudentAdmitCardPdf, triggerDownload
} from '../utils/api';
import CenterPicker from '../components/admin/CenterPicker';

// ── Shared batch table ────────────────────────────────────────────────────────
function BatchTable({ batches, onGenerate, loadingStudents, previewBatchId, showCenter }) {
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            {['Batch ID', 'Session', 'Year',
              ...(showCenter ? ['Center'] : []),
              'Students', 'Status', 'Action']
              .map(h => (
                <th key={h} style={{
                  padding: '10px 12px', textAlign: 'left',
                  fontWeight: 700, fontSize: 13, borderBottom: '1px solid #e0e0e0'
                }}>
                  {h}
                </th>
              ))}
          </tr>
        </thead>
        <tbody>
          {batches.map(b => {
            return (
              <tr key={b.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '10px 12px', fontWeight: 600, fontSize: 13 }}>{b.batch_code}</td>
                <td style={{ padding: '10px 12px', fontSize: 13 }}>{b.session}</td>
                <td style={{ padding: '10px 12px', fontSize: 13 }}>{b.year || '—'}</td>
                {showCenter && (
                  <td style={{ padding: '10px 12px', fontSize: 13 }}>
                    <Box>
                      <Typography variant="caption" fontWeight={600}>{b.center_name || '—'}</Typography>
                      {b.center_code && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {b.center_code}
                        </Typography>
                      )}
                    </Box>
                  </td>
                )}
                <td style={{ padding: '10px 12px' }}>
                  <Chip label={b.student_count ?? 0} size="small" variant="outlined" />
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <Chip label={b.status} size="small"
                    color={b.status === 'active' ? 'success' : 'default'} variant="outlined" />
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <Button size="small" variant="outlined" color="primary"
                    disabled={loadingStudents}
                    startIcon={loadingStudents && previewBatchId === b.id
                      ? <CircularProgress size={12} /> : null}
                    onClick={e => { e.stopPropagation(); onGenerate(b); }}>
                    Generate
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Box>
  );
}

// ── Admit Card Preview Dialog ─────────────────────────────────────────────────
function PreviewDialog({ open, onClose, batch, students }) {
  const [search, setSearch]         = useState('');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [pdfUrl, setPdfUrl]         = useState('');
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [topOffset, setTopOffset]   = useState(0);
  const [leftOffset, setLeftOffset] = useState(0);
  const prevUrlRef = useRef('');

  const filtered = students.filter(s =>
    !search ||
    s.roll_no?.toLowerCase().includes(search.toLowerCase()) ||
    s.name?.toLowerCase().includes(search.toLowerCase())
  );

  const loadPdf = async (studentId) => {
    if (!studentId) { setPdfUrl(''); return; }
    setLoadingPdf(true);
    try {
      const { data } = await getStudentAdmitCardPdf(studentId);
      const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
      prevUrlRef.current = url;
      setPdfUrl(url);
    } catch {
      setPdfUrl('');
    } finally {
      setLoadingPdf(false);
    }
  };

  useEffect(() => {
    if (open && students.length > 0) {
      setCurrentIdx(0);
      setSearch('');
      loadPdf(students[0]?.id);
    }
    return () => {
      if (prevUrlRef.current) { URL.revokeObjectURL(prevUrlRef.current); prevUrlRef.current = ''; }
    };
  }, [open, students]);

  const goTo = (idx) => {
    setCurrentIdx(idx);
    loadPdf(students[idx]?.id);
  };

  const handleSave = async () => {
    setDownloading(true);
    try {
      const { data } = await downloadBatchAdmitCardsPdf(batch?.id);
      triggerDownload(data, `admit-cards-${batch?.batch_code}.pdf`);
    } catch {
      alert('Failed to generate PDF. Make sure the admit_card template image is uploaded.');
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    if (!pdfUrl) return;
    const win = window.open(pdfUrl, '_blank');
    if (win) setTimeout(() => win.print(), 800);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth
      PaperProps={{ sx: { height: '90vh' } }}>
      <DialogTitle sx={{ fontWeight: 700, pb: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            Preview Window — Admit Cards
            {batch && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                (Batch: {batch.batch_code}, Total Students: {students.length})
              </Typography>
            )}
          </Box>
          <IconButton size="small" onClick={onClose}><Close /></IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: 'flex', overflow: 'hidden' }}>
        {/* Left: student list */}
        <Box sx={{ width: 260, borderRight: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
              Students in Batch ({students.length})
            </Typography>
            <TextField
              size="small" fullWidth placeholder="Search Roll No / Name"
              value={search} onChange={e => setSearch(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
            />
          </Box>
          <List dense sx={{ flex: 1, overflowY: 'auto', py: 0 }}>
            {filtered.map((s) => {
              const realIdx = students.findIndex(x => x.id === s.id);
              const selected = realIdx === currentIdx;
              return (
                <ListItem key={s.id} disablePadding>
                  <ListItemButton selected={selected} onClick={() => goTo(realIdx)}
                    sx={{ py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <ListItemText
                      primary={<Typography variant="caption" fontWeight={selected ? 700 : 400}>{s.roll_no}</Typography>}
                      secondary={s.name}
                      secondaryTypographyProps={{ fontSize: 11 }}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
          <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">
              Current: {currentIdx + 1} of {students.length}
            </Typography>
          </Box>
        </Box>

        {/* Right: PDF preview */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', bgcolor: 'grey.100' }}>
          {loadingPdf ? (
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CircularProgress />
            </Box>
          ) : pdfUrl ? (
            <iframe src={pdfUrl} title="Admit Card Preview"
              style={{ flex: 1, border: 'none', width: '100%' }} />
          ) : (
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 1, color: 'text.secondary' }}>
              <Groups sx={{ fontSize: 48, opacity: 0.3 }} />
              <Typography variant="body2">
                {students.length === 0
                  ? 'No students in this batch'
                  : 'Select a student to preview their admit card'}
              </Typography>
              <Typography variant="caption">
                Make sure the admit_card template image is uploaded in Documents
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ borderTop: 1, borderColor: 'divider', px: 2, py: 1.5,
        display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="caption" color="text.secondary">Print Offset (mm):</Typography>
          <Stack spacing={0.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" sx={{ width: 65 }}>Vertical:</Typography>
              <TextField type="number" size="small" value={topOffset}
                onChange={e => setTopOffset(+e.target.value)}
                inputProps={{ step: 0.5 }} sx={{ width: 80 }} />
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" sx={{ width: 65 }}>Horizontal:</Typography>
              <TextField type="number" size="small" value={leftOffset}
                onChange={e => setLeftOffset(+e.target.value)}
                inputProps={{ step: 0.5 }} sx={{ width: 80 }} />
            </Stack>
          </Stack>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="caption">Pages: {currentIdx + 1} of {students.length}</Typography>
          <IconButton size="small" onClick={() => goTo(Math.max(0, currentIdx - 1))}
            disabled={currentIdx === 0}><ChevronLeft /></IconButton>
          <IconButton size="small" onClick={() => goTo(Math.min(students.length - 1, currentIdx + 1))}
            disabled={currentIdx >= students.length - 1}><ChevronRight /></IconButton>
        </Stack>

        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<SaveAlt />} onClick={handleSave} disabled={downloading}>
            {downloading ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="contained" color="success" startIcon={<Print />}
            onClick={handlePrint} disabled={!pdfUrl}>
            Print
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const RECENT_LIMIT = 5;

export default function AdmitCardPage() {
  const [recentBatches, setRecentBatches]     = useState([]);
  const [recentLoading, setRecentLoading]     = useState(true);
  const [showAllRecent, setShowAllRecent]     = useState(false);

  const [selectedCenter, setSelectedCenter]   = useState(null);
  const [filteredBatches, setFilteredBatches] = useState([]);
  const [filterLoading, setFilterLoading]     = useState(false);
  const [filterSearched, setFilterSearched]   = useState(false);

  const [previewOpen, setPreviewOpen]         = useState(false);
  const [previewBatch, setPreviewBatch]       = useState(null);
  const [batchStudents, setBatchStudents]     = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  useEffect(() => {
    getBatches()
      .then(({ data }) => setRecentBatches(data))
      .catch(() => {})
      .finally(() => setRecentLoading(false));
  }, []);

  const handleFilterSearch = async () => {
    if (!selectedCenter?.id) return;
    setFilterLoading(true);
    setFilterSearched(true);
    setFilteredBatches([]);
    try {
      const { data } = await getBatches({ center_id: selectedCenter.id });
      setFilteredBatches(data);
    } finally {
      setFilterLoading(false);
    }
  };

  const handleGenerate = async (batch) => {
    setLoadingStudents(true);
    setPreviewBatch(batch);
    setBatchStudents([]);
    try {
      const { data } = await getBatchStudents(batch.id);
      setBatchStudents(data);
    } finally {
      setLoadingStudents(false);
    }
    setPreviewOpen(true);
  };

  const displayedRecent = showAllRecent ? recentBatches : recentBatches.slice(0, RECENT_LIMIT);

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>Generate Admit Cards</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Search by center or pick from recent batches below
      </Typography>

      {/* ── Filter by Center ── */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
            Search by Center
          </Typography>

          <CenterPicker
            value={selectedCenter}
            onChange={(c) => { setSelectedCenter(c); setFilterSearched(false); setFilteredBatches([]); }}
            readOnly={true}
            showDetails={true}
          />

          <Box sx={{ mt: 2 }}>
            <Button variant="contained" startIcon={<Search />}
              onClick={handleFilterSearch}
              disabled={!selectedCenter?.id || filterLoading}
              sx={{ minWidth: 140 }}>
              {filterLoading ? <CircularProgress size={18} /> : 'Search Batches'}
            </Button>
          </Box>

          {filterSearched && (
            <Box sx={{ mt: 3 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <Typography variant="subtitle2" fontWeight={700}>
                  Batches for {selectedCenter?.name}
                </Typography>
                <Chip label={filteredBatches.length} size="small" variant="outlined"
                  sx={{ ml: 'auto !important' }} />
              </Stack>
              {filteredBatches.length === 0 ? (
                <Alert severity="info">No batches found for this center.</Alert>
              ) : (
                <BatchTable
                  batches={filteredBatches}
                  onGenerate={handleGenerate}
                  loadingStudents={loadingStudents}
                  previewBatchId={previewBatch?.id}
                  showCenter={false}
                />
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* ── All / Recent Batches ── */}
      <Card>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <AccessTime color="action" fontSize="small" />
            <Typography variant="subtitle1" fontWeight={700}>All Batches</Typography>
            <Chip label={recentBatches.length} size="small" variant="outlined"
              sx={{ ml: 'auto !important' }} />
          </Stack>

          {recentLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={28} />
            </Box>
          ) : recentBatches.length === 0 ? (
            <Alert severity="info">No batches created yet. Go to the Batches page to create one.</Alert>
          ) : (
            <>
              <BatchTable
                batches={displayedRecent}
                onGenerate={handleGenerate}
                loadingStudents={loadingStudents}
                previewBatchId={previewBatch?.id}
                showCenter
              />
              {recentBatches.length > RECENT_LIMIT && (
                <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'center' }}>
                  <Button size="small" variant="text"
                    onClick={() => setShowAllRecent(v => !v)}>
                    {showAllRecent ? 'Show less' : `Show all ${recentBatches.length} batches`}
                  </Button>
                </Box>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <PreviewDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        batch={previewBatch}
        students={batchStudents}
      />
    </Box>
  );
}
