import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Alert, Box, LinearProgress, Divider
} from '@mui/material';
import { UploadFile, CheckCircle } from '@mui/icons-material';
import { bulkCreateStudents } from '../../utils/api';

function parseCsv(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  }).filter(r => r.roll_no && r.name);
}

export default function BulkImport({ open, onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    setError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const rows = parseCsv(ev.target.result);
        setPreview(rows.slice(0, 5));
      } catch {
        setError('Could not parse CSV. Check the format.');
      }
    };
    reader.readAsText(f);
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const rows = parseCsv(ev.target.result);
          const { data } = await bulkCreateStudents(rows);
          setResult(data);
          onImported?.();
        } catch (e) {
          setError(e.response?.data?.error || 'Import failed');
        } finally {
          setLoading(false);
        }
      };
      reader.readAsText(file);
    } catch {
      setLoading(false);
      setError('File read failed');
    }
  };

  const handleClose = () => {
    setFile(null); setPreview([]); setResult(null); setError('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Bulk Import Students</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Upload a CSV with columns: <code>roll_no, name, father_name, mother_name, dob, year, subject, exam_date, exam_venue, exam_time</code>
        </Typography>

        <Box sx={{
          border: '2px dashed', borderColor: 'divider', borderRadius: 2,
          p: 3, textAlign: 'center', bgcolor: 'grey.50', mb: 2,
          cursor: 'pointer', '&:hover': { borderColor: 'primary.main' }
        }} component="label">
          <input type="file" accept=".csv" hidden onChange={handleFile} />
          <UploadFile sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
          <Typography variant="body2">
            {file ? file.name : 'Click to choose a .csv file'}
          </Typography>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {loading && <LinearProgress sx={{ mb: 2 }} />}

        {result && (
          <Alert severity="success" icon={<CheckCircle />} sx={{ mb: 2 }}>
            Imported <strong>{result.inserted}</strong> students.
            {result.skipped > 0 && ` (${result.skipped} skipped — duplicate roll numbers)`}
          </Alert>
        )}

        {preview.length > 0 && !result && (
          <>
            <Divider sx={{ mb: 1.5 }} />
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              Preview (first {preview.length} rows):
            </Typography>
            {preview.map((r, i) => (
              <Typography key={i} variant="caption" display="block" sx={{ mt: 0.5 }}>
                {r.roll_no} — {r.name} ({r.year})
              </Typography>
            ))}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose}>Close</Button>
        {!result && (
          <Button variant="contained" onClick={handleImport} disabled={!file || loading}>
            Import
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
