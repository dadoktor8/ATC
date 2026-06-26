import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Grid, Typography, Divider,
  Alert, CircularProgress, Box, Chip, Paper
} from '@mui/material';
import { getMarks, saveMarks } from '../../utils/api';

const PRACTICAL = [
  { key: 'practical_paper1', label: '1st Paper', max: 100 },
  { key: 'practical_paper2', label: '2nd Paper', max: 100 },
  { key: 'practical_fabric', label: 'Fabric', max: 100 },
];

const INTERNAL = [
  { key: 'ia_composition',  label: 'Composition',  max: 20 },
  { key: 'ia_illustration', label: 'Illustration', max: 20 },
  { key: 'ia_still_life',   label: 'Still Life',   max: 20 },
  { key: 'ia_press_layout', label: 'Press Layout', max: 20 },
  { key: 'ia_landscape',    label: 'Landscape',    max: 20 },
  { key: 'ia_book_cover',   label: 'Book Cover',   max: 20 },
  { key: 'ia_lettering',    label: 'Lettering',    max: 20 },
  { key: 'ia_sketch',       label: 'Sketch',       max: 20 },
  { key: 'ia_poster_design',label: 'Poster Design',max: 20 },
];

const ORAL_THEORY = [
  { key: 'oral',           label: 'Oral',     max: 50 },
  { key: 'theory_paper1', label: 'Paper – I', max: 50 },
  { key: 'theory_paper2', label: 'Paper – II',max: 50 },
];

const EMPTY_MARKS = Object.fromEntries(
  [...PRACTICAL, ...INTERNAL, ...ORAL_THEORY].map(f => [f.key, ''])
);

function calcDivision(total) {
  const pct = (total / 500) * 100;
  if (pct >= 75) return 'FIRST';
  if (pct >= 55) return 'SECOND';
  if (pct >= 35) return 'THIRD';
  return 'FAIL';
}

const divColor = { FIRST: 'success', SECOND: 'info', THIRD: 'warning', FAIL: 'error' };

function Section({ title, color, fields, values, onChange }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderColor: `${color}.200` }}>
      <Typography variant="overline" color={`${color}.800`} fontWeight={700} sx={{ mb: 1.5, display: 'block' }}>
        {title}
      </Typography>
      <Grid container spacing={1.5}>
        {fields.map(f => (
          <Grid item xs={6} sm={4} key={f.key}>
            <TextField
              label={`${f.label} (/${f.max})`}
              size="small" fullWidth
              type="number"
              inputProps={{ min: 0, max: f.max, step: 1 }}
              value={values[f.key] ?? ''}
              onChange={e => onChange(f.key, e.target.value)}
              error={values[f.key] !== '' && (Number(values[f.key]) > f.max || Number(values[f.key]) < 0)}
              helperText={values[f.key] !== '' && Number(values[f.key]) > f.max ? `Max ${f.max}` : ''}
            />
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
}

export default function MarksForm({ open, onClose, student, onSaved }) {
  const [marks, setMarks] = useState(EMPTY_MARKS);
  const [extra, setExtra] = useState({ distinction: '', certificate_no: '' });
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open || !student) return;
    setSaved(false);
    setError('');
    setFetchLoading(true);
    getMarks(student.id).then(({ data }) => {
      if (data) {
        const m = {};
        [...PRACTICAL, ...INTERNAL, ...ORAL_THEORY].forEach(f => {
          m[f.key] = data[f.key] != null ? String(data[f.key]) : '';
        });
        setMarks(m);
        setExtra({ distinction: data.distinction || '', certificate_no: data.certificate_no || '' });
      } else {
        setMarks(EMPTY_MARKS);
        setExtra({ distinction: '', certificate_no: '' });
      }
    }).catch(() => {}).finally(() => setFetchLoading(false));
  }, [open, student]);

  const handleChange = (key, val) => {
    setMarks(p => ({ ...p, [key]: val }));
  };

  const nums = Object.fromEntries(
    Object.entries(marks).map(([k, v]) => [k, v === '' ? null : Number(v)])
  );

  const iaTotal = INTERNAL.reduce((s, f) => s + (nums[f.key] || 0), 0);
  const practicalTotal = PRACTICAL.reduce((s, f) => s + (nums[f.key] || 0), 0);
  const oralTotal = ORAL_THEORY.reduce((s, f) => s + (nums[f.key] || 0), 0);
  const grandTotal = practicalTotal + iaTotal + oralTotal;
  const hasAnyMark = Object.values(nums).some(v => v != null);
  const division = hasAnyMark ? calcDivision(grandTotal) : null;

  const handleSave = async () => {
    setError('');
    setLoading(true);
    try {
      await saveMarks(student.id, {
        ...nums,
        ia_total: iaTotal,
        total_marks: grandTotal,
        division,
        distinction: extra.distinction,
        certificate_no: extra.certificate_no,
        entered_by: 'operator'
      });
      setSaved(true);
      onSaved?.();
    } catch (e) {
      setError(e.response?.data?.error || 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        Marks Entry — {student?.name}
        <Typography variant="body2" color="text.secondary">
          Roll: {student?.roll_no} · Year: {student?.year} · Subject: {student?.subject}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        {fetchLoading && <Box sx={{ textAlign: 'center', py: 2 }}><CircularProgress size={28} /></Box>}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {saved && <Alert severity="success" sx={{ mb: 2 }}>Marks saved successfully!</Alert>}

        {!fetchLoading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Section title="Practical" color="primary" fields={PRACTICAL} values={marks} onChange={handleChange} />
            <Section title="Internal Assessment" color="success" fields={INTERNAL} values={marks} onChange={handleChange} />
            <Section title="Oral & Theoretical" color="warning" fields={ORAL_THEORY} values={marks} onChange={handleChange} />

            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={3}>
                  <Typography variant="body2" color="text.secondary">IA Total</Typography>
                  <Typography variant="h6" fontWeight={700}>{iaTotal} <Typography component="span" variant="body2" color="text.secondary">/100</Typography></Typography>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Typography variant="body2" color="text.secondary">Grand Total</Typography>
                  <Typography variant="h5" fontWeight={700} color="primary">{grandTotal} <Typography component="span" variant="body2" color="text.secondary">/500</Typography></Typography>
                </Grid>
                <Grid item xs={12} sm={3}>
                  {division && <Chip label={division} color={divColor[division]} size="medium" sx={{ fontWeight: 700, fontSize: 14 }} />}
                </Grid>
              </Grid>
            </Paper>

            <Divider />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField label="Distinction" fullWidth size="small" value={extra.distinction} onChange={e => setExtra(p => ({ ...p, distinction: e.target.value }))} placeholder="e.g. PCL" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="Certificate No." fullWidth size="small" value={extra.certificate_no} onChange={e => setExtra(p => ({ ...p, certificate_no: e.target.value }))} placeholder="e.g. ATC1-19/073" />
              </Grid>
            </Grid>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" onClick={handleSave} disabled={loading || fetchLoading || !hasAnyMark}>
          {loading ? <CircularProgress size={20} /> : 'Save Marks'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
