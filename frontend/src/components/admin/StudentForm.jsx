import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Grid, MenuItem, CircularProgress,
  Alert, Divider, Typography, Chip, Box,
  Radio, RadioGroup, FormControlLabel, FormLabel
} from '@mui/material';
import { Lock, LockOpen } from '@mui/icons-material';
import { createStudent, updateStudent, getCenters, previewRollNumber, getBatches } from '../../utils/api';
import { YEAR_OPTIONS, SUBJECT_OPTIONS } from '../../utils/constants';

const QUALIFICATIONS = [
  'Below Class V', 'Class V', 'Class VIII', 'Class X',
  'Class XII', 'Graduate', 'Post Graduate', 'Other',
];

function buildSessions() {
  const cur = new Date().getFullYear();
  const list = [];
  for (let y = cur - 3; y <= cur + 3; y++) list.push(`${y}-${y + 1}`);
  return list;
}
const SESSIONS = buildSessions();

function calcAge(dob) {
  if (!dob) return '';
  const today = new Date(), birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age > 0 ? String(age) : '';
}

const EMPTY_EXAM = {
  center_id: '', session: '',
  batch_id: '', exam_date: '', exam_venue: '', exam_time: '',
};

const EMPTY_STUDENT = {
  name: '', father_name: '', mother_name: '', dob: '', gender: '',
  nationality: 'Indian', edu_qualification: '',
  year: 'Pre-preparatory 1st', year_code: '01',
  subject: 'Painting', subject_code: '15',
};

function SectionHeader({ title, locked, onToggleLock }) {
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      bgcolor: 'grey.100', px: 1.5, py: 0.75, borderRadius: 1, mb: 2,
    }}>
      <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1 }}>{title}</Typography>
      {onToggleLock !== undefined && (
        <Button size="small" variant={locked ? 'contained' : 'outlined'} disableElevation
          startIcon={locked ? <Lock fontSize="small" /> : <LockOpen fontSize="small" />}
          color={locked ? 'primary' : 'inherit'}
          onClick={onToggleLock}
          sx={{ minWidth: 120, textTransform: 'none', fontSize: 12 }}
        >
          {locked ? 'Locked' : 'Section Lock'}
        </Button>
      )}
    </Box>
  );
}

export default function StudentForm({ open, onClose, onSaved, student }) {
  const [examForm, setExamForm] = useState(EMPTY_EXAM);
  const [studentForm, setStudentForm] = useState(EMPTY_STUDENT);
  const [centerLocked, setCenterLocked] = useState(false);

  const [centers, setCenters] = useState([]);
  const [batches, setBatches] = useState([]);
  const [previewRoll, setPreviewRoll] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successRoll, setSuccessRoll] = useState('');

  const isNew = !student?.id;

  useEffect(() => {
    getCenters().then(({ data }) => setCenters(data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    setError(''); setSuccessRoll(''); setPreviewRoll('');
    if (student) {
      const yOpt = YEAR_OPTIONS.find(y => y.name === student.year);
      const sOpt = SUBJECT_OPTIONS.find(s => s.name === student.subject);
      setStudentForm({
        name: student.name || '',
        father_name: student.father_name || '',
        mother_name: student.mother_name || '',
        dob: student.dob || '',
        gender: student.gender || '',
        nationality: student.nationality || 'Indian',
        edu_qualification: student.edu_qualification || '',
        year: student.year || 'Pre-preparatory 1st',
        year_code: yOpt?.code || '01',
        subject: student.subject || 'Painting',
        subject_code: sOpt?.code || '15',
      });
      setExamForm({
        center_id: student.center_id || '',
        session: student.session || '',
        batch_id: student.batch_id ?? '',
        exam_date: student.exam_date || '',
        exam_venue: student.exam_venue || '',
        exam_time: student.exam_time || '',
      });
    } else {
      setStudentForm(EMPTY_STUDENT);
      // keep center + session if locked
      if (!centerLocked) setExamForm(EMPTY_EXAM);
    }
  }, [student, open]);

  // Auto-calculate age
  const age = calcAge(studentForm.dob);

  // Roll number preview
  useEffect(() => {
    if (!isNew || !examForm.session || !examForm.center_id) { setPreviewRoll(''); return; }
    let cancelled = false;
    previewRollNumber(examForm.session, examForm.center_id)
      .then(({ data }) => { if (!cancelled) setPreviewRoll(data.roll_no); })
      .catch(() => { if (!cancelled) setPreviewRoll(''); });
    return () => { cancelled = true; };
  }, [examForm.session, examForm.center_id, isNew]);

  // Load batches
  useEffect(() => {
    if (!examForm.session || !examForm.center_id) { setBatches([]); return; }
    let cancelled = false;
    getBatches({ session: examForm.session, center_id: examForm.center_id, status: 'active' })
      .then(({ data }) => { if (!cancelled) setBatches(data); })
      .catch(() => { if (!cancelled) setBatches([]); });
    return () => { cancelled = true; };
  }, [examForm.session, examForm.center_id]);

  const setS = (k) => (e) => setStudentForm(p => ({ ...p, [k]: e.target.value }));
  const setE = (k) => (e) => setExamForm(p => ({ ...p, [k]: e.target.value }));

  const handleYearChange = (name) => {
    const opt = YEAR_OPTIONS.find(y => y.name === name);
    setStudentForm(p => ({ ...p, year: name, year_code: opt?.code || '' }));
  };
  const handleYearCodeChange = (code) => {
    const opt = YEAR_OPTIONS.find(y => y.code === code);
    setStudentForm(p => ({ ...p, year_code: code, year: opt?.name || p.year }));
  };
  const handleSubjectChange = (name) => {
    const opt = SUBJECT_OPTIONS.find(s => s.name === name);
    setStudentForm(p => ({ ...p, subject: name, subject_code: opt?.code || '' }));
  };
  const handleSubjectCodeChange = (code) => {
    const opt = SUBJECT_OPTIONS.find(s => s.code === code);
    setStudentForm(p => ({ ...p, subject_code: code, subject: opt?.name || p.subject }));
  };

  const buildPayload = () => ({
    ...studentForm,
    ...examForm,
    batch_id: examForm.batch_id || null,
  });

  const handleSave = async (addNew = false) => {
    setError('');
    if (!studentForm.name.trim()) { setError('Name is required.'); return; }
    if (!studentForm.year)        { setError('Year is required.'); return; }
    if (isNew && (!examForm.session || !examForm.center_id)) {
      setError('Session and center are required.'); return;
    }
    setLoading(true);
    try {
      if (student?.id) {
        await updateStudent(student.id, buildPayload());
        onSaved(); onClose();
      } else {
        const { data } = await createStudent(buildPayload());
        onSaved();
        if (addNew) {
          // Reset student fields, keep center + session locked
          setStudentForm(EMPTY_STUDENT);
          setExamForm(p => ({ ...EMPTY_EXAM, center_id: p.center_id, session: p.session }));
          setCenterLocked(true);
          setPreviewRoll('');
          setSuccessRoll('');
          setError('');
        } else {
          setSuccessRoll(data.roll_no);
        }
      }
    } catch (e) {
      setError(e.response?.data?.error || 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => { setSuccessRoll(''); setCenterLocked(false); onClose(); };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {isNew ? 'Register New Student' : `Edit Student — ${student?.name}`}
      </DialogTitle>

      <DialogContent dividers>
        {error      && <Alert severity="error"   sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        {successRoll && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Registered! Roll Number: <strong>{successRoll}</strong>
          </Alert>
        )}

        {/* ── Center Details ── */}
        <SectionHeader
          title="Center Details"
          locked={centerLocked}
          onToggleLock={isNew ? () => setCenterLocked(p => !p) : undefined}
        />
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField label="Center *" select fullWidth value={examForm.center_id}
              onChange={setE('center_id')} disabled={!isNew || centerLocked}>
              {centers.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            {isNew ? (
              <TextField label="Session *" select fullWidth value={examForm.session}
                onChange={setE('session')} disabled={centerLocked}>
                {SESSIONS.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
            ) : (
              <TextField label="Session" fullWidth value={examForm.session} onChange={setE('session')} />
            )}
          </Grid>
          <Grid item xs={12} sm={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, height: '100%' }}>
              <Typography variant="body2" color="text.secondary" noWrap>Roll Number:</Typography>
              {student?.roll_no
                ? <Chip label={student.roll_no} color="primary" variant="outlined" size="small" />
                : previewRoll
                ? <Chip label={previewRoll} variant="outlined" size="small" sx={{ fontFamily: 'monospace' }} />
                : <Typography variant="body2" color="text.disabled" fontStyle="italic">auto-generated</Typography>
              }
            </Box>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2.5 }} />

        {/* ── Student Details ── */}
        <SectionHeader title="Student Details" />
        <Grid container spacing={2}>
          <Grid item xs={12} sm={8}>
            <TextField label="Full Name *" fullWidth value={studentForm.name} onChange={setS('name')} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField label="Date of Birth" type="date" fullWidth value={studentForm.dob}
              onChange={setS('dob')} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Father / Mother / Guardian" fullWidth value={studentForm.father_name}
              onChange={setS('father_name')} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Mother's Name" fullWidth value={studentForm.mother_name}
              onChange={setS('mother_name')} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <Box>
              <FormLabel sx={{ fontSize: 12, color: 'text.secondary' }}>Sex</FormLabel>
              <RadioGroup row value={studentForm.gender}
                onChange={e => setStudentForm(p => ({ ...p, gender: e.target.value }))}>
                <FormControlLabel value="Male"   control={<Radio size="small" />} label="Male" />
                <FormControlLabel value="Female" control={<Radio size="small" />} label="Female" />
              </RadioGroup>
            </Box>
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField label="Age" fullWidth value={age} disabled
              InputProps={{ sx: { color: 'text.secondary' } }} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField label="Nationality" select fullWidth value={studentForm.nationality}
              onChange={setS('nationality')}>
              <MenuItem value="Indian">Indian</MenuItem>
              <MenuItem value="Other">Other</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12}>
            <TextField label="Educational Qualification" select fullWidth value={studentForm.edu_qualification}
              onChange={setS('edu_qualification')}>
              <MenuItem value="">Select Qualification</MenuItem>
              {QUALIFICATIONS.map(q => <MenuItem key={q} value={q}>{q}</MenuItem>)}
            </TextField>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2.5 }} />

        {/* ── Examination Details ── */}
        <SectionHeader title="Examination Details" />
        <Grid container spacing={2}>
          <Grid item xs={3} sm={2}>
            <TextField label="Year Code" fullWidth value={studentForm.year_code}
              onChange={e => handleYearCodeChange(e.target.value)} />
          </Grid>
          <Grid item xs={9} sm={4}>
            <TextField label="Year / Class *" select fullWidth value={studentForm.year}
              onChange={e => handleYearChange(e.target.value)}>
              {YEAR_OPTIONS.map(y => <MenuItem key={y.code} value={y.name}>{y.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={3} sm={2}>
            <TextField label="Subject Code" fullWidth value={studentForm.subject_code}
              onChange={e => handleSubjectCodeChange(e.target.value)} />
          </Grid>
          <Grid item xs={9} sm={4}>
            <TextField label="Subject" select fullWidth value={studentForm.subject}
              onChange={e => handleSubjectChange(e.target.value)}>
              {SUBJECT_OPTIONS.map(s => <MenuItem key={s.code} value={s.name}>{s.name}</MenuItem>)}
            </TextField>
          </Grid>

          <Grid item xs={12}>
            <TextField label="Batch (optional)" select fullWidth value={examForm.batch_id}
              onChange={setE('batch_id')}
              disabled={!examForm.session || !examForm.center_id}
              helperText={
                !examForm.session || !examForm.center_id ? 'Select session and center first'
                : batches.length === 0 ? 'No active batches — create one in Batches page'
                : 'Assign to a batch'
              }>
              <MenuItem value="">No Batch (assign later)</MenuItem>
              {batches.map(b => (
                <MenuItem key={b.id} value={b.id}>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>{b.batch_code}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {b.year} · {b.from_date} → {b.to_date}{b.exam_time ? ` · ${b.exam_time}` : ''}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField label="Exam Date" type="date" fullWidth value={examForm.exam_date}
              onChange={setE('exam_date')} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField label="Exam Time" fullWidth value={examForm.exam_time}
              onChange={setE('exam_time')} placeholder="e.g. 10:00 AM" />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField label="Exam Venue" fullWidth value={examForm.exam_venue}
              onChange={setE('exam_venue')} />
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={handleClose}>{successRoll ? 'Close' : 'Cancel'}</Button>
        {!successRoll && (
          <>
            {isNew && (
              <Button variant="outlined" onClick={() => handleSave(true)} disabled={loading}>
                {loading ? <CircularProgress size={18} /> : 'Save & Add New'}
              </Button>
            )}
            <Button variant="contained" onClick={() => handleSave(false)} disabled={loading}
              sx={{ minWidth: 110 }}>
              {loading ? <CircularProgress size={18} /> : isNew ? 'Register' : 'Update'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
