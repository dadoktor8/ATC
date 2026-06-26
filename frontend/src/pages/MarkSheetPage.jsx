import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Card, CardContent, Typography, Button, TextField, Chip,
  Stack, Alert, CircularProgress, Dialog, DialogTitle, DialogContent,
  DialogActions, IconButton, Tooltip, InputAdornment, List, ListItem,
  ListItemButton, ListItemText
} from '@mui/material';
import {
  Search, Close, ChevronLeft, ChevronRight,
  SaveAlt, Print, Groups, CheckCircle, Cancel,
  RadioButtonChecked, RadioButtonUnchecked
} from '@mui/icons-material';
import {
  getBatches, getBatchStudents,
  downloadMarkSheetPdf, getStudentMarkSheetPdf, triggerDownload
} from '../utils/api';
import CenterPicker from '../components/admin/CenterPicker';

function PreviewDialog({ open, onClose, batch, students }) {
  const [search, setSearch]       = useState('');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [pdfUrl, setPdfUrl]       = useState('');
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [missingWarn, setMissingWarn] = useState('');
  const prevUrlRef = useRef('');

  const withMarks    = students.filter(s => s.total_marks != null);
  const missingMarks = students.filter(s => s.total_marks == null);

  const filtered = students.filter(s =>
    !search ||
    s.roll_no?.toLowerCase().includes(search.toLowerCase()) ||
    s.name?.toLowerCase().includes(search.toLowerCase())
  );

  const loadPdf = async (student) => {
    if (!student) { setPdfUrl(''); return; }
    if (student.total_marks == null) { setPdfUrl(''); return; }
    setLoadingPdf(true);
    try {
      const { data } = await getStudentMarkSheetPdf(student.id);
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
      setMissingWarn('');
      loadPdf(students[0]);
    }
    return () => {
      if (prevUrlRef.current) { URL.revokeObjectURL(prevUrlRef.current); prevUrlRef.current = ''; }
    };
  }, [open, students]);

  const goTo = (idx) => {
    setCurrentIdx(idx);
    loadPdf(students[idx]);
  };

  const handleSave = async () => {
    if (withMarks.length === 0) return;
    setDownloading(true);
    setMissingWarn('');
    try {
      const { data } = await downloadMarkSheetPdf(batch?.id);
      triggerDownload(data, `mark-sheets-${batch?.batch_code}.pdf`);
      if (missingMarks.length > 0) {
        setMissingWarn(
          `Skipped ${missingMarks.length} student(s) with no marks: ` +
          missingMarks.map(s => s.roll_no).join(', ')
        );
      }
    } catch (e) {
      const msg = e.response?.data?.error || 'Failed to generate mark sheets.';
      setMissingWarn(msg);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    if (!pdfUrl) return;
    const win = window.open(pdfUrl, '_blank');
    if (win) setTimeout(() => win.print(), 800);
  };

  const currentStudent = students[currentIdx];
  const hasMarks = currentStudent?.total_marks != null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth
      PaperProps={{ sx: { height: '90vh' } }}>
      <DialogTitle sx={{ fontWeight: 700, pb: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            Preview Window — Mark Sheets
            {batch && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                (Batch: {batch.batch_code} · {withMarks.length}/{students.length} with marks)
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
              Students ({students.length})
            </Typography>
            <TextField
              size="small" fullWidth placeholder="Search Roll No / Name"
              value={search} onChange={e => setSearch(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
            />
          </Box>

          {missingMarks.length > 0 && (
            <Alert severity="warning" sx={{ m: 1, py: 0.5, fontSize: 11 }}>
              {missingMarks.length} student(s) missing marks — go to Results Entry to fill them in.
            </Alert>
          )}

          <List dense sx={{ flex: 1, overflowY: 'auto', py: 0 }}>
            {filtered.map((s) => {
              const realIdx = students.findIndex(x => x.id === s.id);
              const selected = realIdx === currentIdx;
              const marked   = s.total_marks != null;
              return (
                <ListItem key={s.id} disablePadding>
                  <ListItemButton selected={selected} onClick={() => goTo(realIdx)}
                    sx={{ py: 0.75, borderBottom: '1px solid', borderColor: 'divider',
                          opacity: marked ? 1 : 0.55 }}>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {marked
                            ? <CheckCircle sx={{ fontSize: 13, color: 'success.main' }} />
                            : <Cancel sx={{ fontSize: 13, color: 'warning.main' }} />}
                          <Typography variant="caption" fontWeight={selected ? 700 : 400}>
                            {s.roll_no}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <>
                          <span>{s.name}</span>
                          {!marked && (
                            <Typography component="span" variant="caption"
                              sx={{ display: 'block', color: 'warning.main', fontSize: 10 }}>
                              No marks entered
                            </Typography>
                          )}
                        </>
                      }
                      secondaryTypographyProps={{ fontSize: 11 }}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>

          <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">
              {currentIdx + 1} of {students.length}
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
            <iframe src={pdfUrl} title="Mark Sheet Preview"
              style={{ flex: 1, border: 'none', width: '100%' }} />
          ) : (
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 1.5, color: 'text.secondary' }}>
              {!hasMarks ? (
                <>
                  <Cancel sx={{ fontSize: 48, color: 'warning.main', opacity: 0.6 }} />
                  <Typography variant="body2" fontWeight={600} color="warning.main">
                    Marks not entered for {currentStudent?.name}
                  </Typography>
                  <Typography variant="caption" textAlign="center">
                    Go to Batches → Enter Results to fill in this student's marks,<br />
                    then come back to generate the mark sheet.
                  </Typography>
                </>
              ) : (
                <>
                  <Groups sx={{ fontSize: 48, opacity: 0.3 }} />
                  <Typography variant="body2">
                    Upload the mark_sheet template image in Documents to enable preview.
                  </Typography>
                </>
              )}
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ borderTop: 1, borderColor: 'divider', px: 2, py: 1.5,
        display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>

        {missingWarn && (
          <Alert severity="warning" sx={{ flex: 1, py: 0.5, fontSize: 11 }}>{missingWarn}</Alert>
        )}

        {/* Page navigation */}
        <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: 'auto' }}>
          <Typography variant="caption">Page {currentIdx + 1} of {students.length}</Typography>
          <IconButton size="small" onClick={() => goTo(Math.max(0, currentIdx - 1))}
            disabled={currentIdx === 0}><ChevronLeft /></IconButton>
          <IconButton size="small" onClick={() => goTo(Math.min(students.length - 1, currentIdx + 1))}
            disabled={currentIdx >= students.length - 1}><ChevronRight /></IconButton>
        </Stack>

        <Stack direction="row" spacing={1}>
          <Tooltip title={withMarks.length === 0 ? 'No students have marks yet' : `Save ${withMarks.length} mark sheet(s)`}>
            <span>
              <Button variant="outlined" startIcon={<SaveAlt />}
                onClick={handleSave} disabled={downloading || withMarks.length === 0}>
                {downloading ? 'Saving…' : `Save (${withMarks.length})`}
              </Button>
            </span>
          </Tooltip>
          <Button variant="contained" color="success" startIcon={<Print />}
            onClick={handlePrint} disabled={!pdfUrl}>
            Print
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}

export default function MarkSheetPage() {
  const [selectedCenter, setSelectedCenter] = useState(null);
  const [batches, setBatches]               = useState([]);
  const [batchLoading, setBatchLoading]     = useState(false);
  const [searched, setSearched]             = useState(false);
  const [selectedBatch, setSelectedBatch]   = useState(null);
  const [previewOpen, setPreviewOpen]       = useState(false);
  const [previewBatch, setPreviewBatch]     = useState(null);
  const [batchStudents, setBatchStudents]   = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const handleSearch = async () => {
    if (!selectedCenter?.id) return;
    setBatchLoading(true);
    setSearched(true);
    setBatches([]);
    setSelectedBatch(null);
    try {
      const { data } = await getBatches({ center_id: selectedCenter.id });
      setBatches(data);
    } finally { setBatchLoading(false); }
  };

  const handleGenerate = async (batch) => {
    setLoadingStudents(true);
    setPreviewBatch(batch);
    setBatchStudents([]);
    try {
      const { data } = await getBatchStudents(batch.id);
      setBatchStudents(data);
    } finally { setLoadingStudents(false); }
    setPreviewOpen(true);
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>Generate Mark Sheets</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Search by center, select a batch, preview and print individual mark sheets
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <Chip label="1" color="primary" size="small" sx={{ fontWeight: 700, width: 26, height: 26 }} />
            <Typography variant="subtitle1" fontWeight={700}>Search by Center</Typography>
          </Stack>

          <CenterPicker
            value={selectedCenter}
            onChange={(c) => { setSelectedCenter(c); setSearched(false); setBatches([]); }}
            readOnly={true}
            showDetails={true}
          />

          <Box sx={{ mt: 2 }}>
            <Button variant="contained" startIcon={<Search />}
              onClick={handleSearch} disabled={!selectedCenter?.id || batchLoading}
              sx={{ minWidth: 120 }}>
              {batchLoading ? <CircularProgress size={18} /> : 'Search Batches'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {searched && (
        <Card>
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <Chip label="2" color="primary" size="small" sx={{ fontWeight: 700, width: 26, height: 26 }} />
              <Typography variant="subtitle1" fontWeight={700}>Select a Batch</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto !important' }}>
                {batches.length} batch{batches.length !== 1 ? 'es' : ''} found
              </Typography>
            </Stack>

            {batches.length === 0 ? (
              <Alert severity="info">
                No batches found for this center. Create batches in the Batches page first.
              </Alert>
            ) : (
              <Box sx={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5' }}>
                      {['Select','Batch ID','Session','Year','Students','Status','Action']
                        .map(h => (
                          <th key={h} style={{ padding: '10px 12px', textAlign: 'left',
                            fontWeight: 700, fontSize: 13, borderBottom: '1px solid #e0e0e0' }}>
                            {h}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map(b => {
                      const isSelected = selectedBatch?.id === b.id;
                      return (
                        <tr key={b.id} onClick={() => setSelectedBatch(b)}
                          style={{ cursor: 'pointer',
                            background: isSelected ? '#e3f2fd' : 'transparent',
                            borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '10px 12px' }}>
                            {isSelected
                              ? <RadioButtonChecked color="primary" fontSize="small" />
                              : <RadioButtonUnchecked fontSize="small" color="disabled" />}
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 600, fontSize: 13 }}>{b.batch_code}</td>
                          <td style={{ padding: '10px 12px', fontSize: 13 }}>{b.session}</td>
                          <td style={{ padding: '10px 12px', fontSize: 13 }}>{b.year || '—'}</td>
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
                              startIcon={loadingStudents && previewBatch?.id === b.id
                                ? <CircularProgress size={12} /> : null}
                              onClick={e => { e.stopPropagation(); handleGenerate(b); }}>
                              Generate
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Box>
            )}

            {selectedBatch && (
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="contained" color="primary"
                  disabled={loadingStudents}
                  startIcon={loadingStudents ? <CircularProgress size={16} /> : null}
                  onClick={() => handleGenerate(selectedBatch)}>
                  Generate Mark Sheets for {selectedBatch.batch_code}
                </Button>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      <PreviewDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        batch={previewBatch}
        students={batchStudents}
      />
    </Box>
  );
}
