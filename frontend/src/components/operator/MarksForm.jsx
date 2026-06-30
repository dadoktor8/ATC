import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Grid, Typography, Divider,
  Alert, CircularProgress, Box, Chip, Paper
} from '@mui/material';
import { getMarks, saveMarks } from '../../utils/api';
import {
  computeMarks, isPaintingSubject, relevantKeysForYear,
  isCertEligible, generateCertificateNo,
} from '../../utils/markRules';

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

const divColor = { FIRST: 'success', SECOND: 'info', THIRD: 'warning', FAIL: 'error', AB: 'secondary' };

// Cell that accepts a number or the literal text "AB" (absent for that paper).
function MarkField({ field, value, onChange, hidden }) {
  if (hidden) return null;
  const v = String(value ?? '');
  const isAB = v.trim().toUpperCase() === 'AB';
  const numV = parseFloat(v);
  const isOver = !isAB && v !== '' && !isNaN(numV) && numV > field.max;
  return (
    <Grid item xs={6} sm={4} key={field.key}>
      <TextField
        label={`${field.label} (/${field.max})`}
        size="small" fullWidth
        value={v}
        onChange={e => {
          let val = e.target.value;
          if (val.trim().toUpperCase() === 'AB') val = 'AB';
          onChange(field.key, val);
        }}
        error={isOver}
        helperText={isOver ? `Max ${field.max}` : isAB ? 'Marked absent' : ''}
        sx={isAB ? { '& .MuiInputBase-input': { color: '#e65100', fontWeight: 700 } } : undefined}
      />
    </Grid>
  );
}

function Section({ title, color, fields, values, onChange, isVisible }) {
  const visibleFields = fields.filter(f => isVisible(f.key));
  if (!visibleFields.length) return null;
  return (
    <Paper variant="outlined" sx={{ p: 2, borderColor: `${color}.200` }}>
      <Typography variant="overline" color={`${color}.800`} fontWeight={700} sx={{ mb: 1.5, display: 'block' }}>
        {title}
      </Typography>
      <Grid container spacing={1.5}>
        {visibleFields.map(f => (
          <MarkField key={f.key} field={f} value={values[f.key]} onChange={onChange} />
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
        let certNo = data.certificate_no || '';
        if (!certNo && isCertEligible(student.subject, student.year)) {
          certNo = generateCertificateNo(student.center_code, student.session, student.roll_no);
        }
        setExtra({ distinction: data.distinction || '', certificate_no: certNo });
      } else {
        setMarks(EMPTY_MARKS);
        let certNo = '';
        if (isCertEligible(student.subject, student.year)) {
          certNo = generateCertificateNo(student.center_code, student.session, student.roll_no);
        }
        setExtra({ distinction: '', certificate_no: certNo });
      }
    }).catch(() => {}).finally(() => setFetchLoading(false));
  }, [open, student]);

  const handleChange = (key, val) => {
    setMarks(p => ({ ...p, [key]: val }));
  };

  const isPainting = isPaintingSubject(student?.subject);
  const relevant = isPainting ? relevantKeysForYear(student?.year) : null;
  const isVisible = (key) => !relevant || relevant.includes(key);

  const calc = computeMarks(student?.subject, student?.year, marks);
  const hasAnyMark = Object.values(marks).some(v => v !== '' && v != null);
  const grandTotal = calc.total;
  const division = calc.division;
  const distinctionValue = isPainting ? (calc.distinction || '') : extra.distinction;

  const handleSave = async () => {
    setError('');
    setLoading(true);
    try {
      const nums = {};
      [...PRACTICAL, ...INTERNAL, ...ORAL_THEORY].forEach(f => {
        const v = marks[f.key];
        if (v === '' || v === null || v === undefined) nums[f.key] = null;
        else if (String(v).trim().toUpperCase() === 'AB') nums[f.key] = null;
        else nums[f.key] = Number(v);
      });
      await saveMarks(student.id, {
        ...nums,
        ia_total: typeof calc.iaTotal === 'number' ? calc.iaTotal : 0,
        total_marks: typeof grandTotal === 'number' ? grandTotal : null,
        division: division || null,
        distinction: distinctionValue || null,
        certificate_no: extra.certificate_no || null,
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
            {isPainting && (
              <Alert severity="info" sx={{ py: 0 }}>
                Painting rules applied for {student?.year}. Type <strong>AB</strong> in a field to mark that paper absent.
              </Alert>
            )}
            <Section title="Practical" color="primary" fields={PRACTICAL} values={marks} onChange={handleChange} isVisible={isVisible} />
            <Section title="Internal Assessment" color="success" fields={INTERNAL} values={marks} onChange={handleChange} isVisible={isVisible} />
            <Section title="Oral & Theoretical" color="warning" fields={ORAL_THEORY} values={marks} onChange={handleChange} isVisible={isVisible} />

            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={3}>
                  <Typography variant="body2" color="text.secondary">IA Total</Typography>
                  <Typography variant="h6" fontWeight={700}>
                    {typeof calc.iaTotal === 'number' ? calc.iaTotal : '—'}
                    {' '}<Typography component="span" variant="body2" color="text.secondary">/100</Typography>
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Typography variant="body2" color="text.secondary">Grand Total</Typography>
                  <Typography variant="h5" fontWeight={700} color="primary">
                    {typeof grandTotal === 'number' ? grandTotal : (grandTotal === 'AB' ? 'AB' : '—')}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={3}>
                  {division && <Chip label={division} color={divColor[division] || 'default'} size="medium" sx={{ fontWeight: 700, fontSize: 14 }} />}
                </Grid>
                <Grid item xs={12} sm={3}>
                  {distinctionValue && <Chip label={distinctionValue} variant="outlined" color="secondary" size="medium" sx={{ fontWeight: 700, fontSize: 13 }} />}
                </Grid>
              </Grid>
            </Paper>

            <Divider />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Distinction" fullWidth size="small"
                  value={distinctionValue}
                  onChange={e => setExtra(p => ({ ...p, distinction: e.target.value }))}
                  placeholder="e.g. PCL"
                  disabled={isPainting}
                  helperText={isPainting ? 'Auto-computed from Painting rules' : ''}
                />
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
