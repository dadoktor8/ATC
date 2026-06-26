import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Button, TextField, MenuItem,
  Grid, Alert, Radio, RadioGroup, FormControlLabel, FormLabel,
  Dialog, DialogTitle, DialogContent, DialogActions, Chip
} from '@mui/material';
import { Lock, LockOpen, PersonAdd, Visibility, CheckCircle } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { createStudent, previewRollNumber, autoCreateBatch, assignStudentsToBatch } from '../utils/api';
import { YEAR_OPTIONS, SUBJECT_OPTIONS } from '../utils/constants';
import CenterPicker from '../components/admin/CenterPicker';

function buildSessions() {
  const cur = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, i) => {
    const y = cur - 2 + i;
    return `${y}-${y + 1}`;
  });
}
const SESSIONS = buildSessions();
const DEFAULT_SESSION = SESSIONS[2];

const QUALIFICATIONS = [
  'Below Class V', 'Class V', 'Class VIII', 'Class X',
  'Class XII', 'Graduate', 'Post Graduate', 'Other',
];

function calcAge(dob) {
  if (!dob) return '';
  const today = new Date(), birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  if (
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  ) age--;
  return age > 0 ? String(age) : '';
}

const EMPTY_STUDENT = {
  name: '', guardian: '', gender: '', dob: '',
  nationality: 'Indian', edu_qualification: '',
  year_code: '01', year: YEAR_OPTIONS[0].name,
  subject_code: '15', subject: SUBJECT_OPTIONS[0].name,
};

function PreviewDialog({ open, onClose, saved }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle fontWeight={700}>Registered Students</DialogTitle>
      <DialogContent dividers>
        {saved.length === 0
          ? <Alert severity="info">No students saved yet.</Alert>
          : saved.map((s, i) => (
            <Box key={i} sx={{ mb: 1, p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography fontWeight={600}>{i + 1}. {s.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                Roll: {s.roll_no} · {s.year} · {s.subject}
              </Typography>
            </Box>
          ))
        }
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
    </Dialog>
  );
}

export default function RegistrationPage() {
  const navigate = useNavigate();
  const [selectedCenter, setSelectedCenter] = useState(null);
  const [centerFields, setCenterFields] = useState({});   // editable overrides
  const [session, setSession] = useState(DEFAULT_SESSION);
  const [locked, setLocked] = useState(false);
  const [student, setStudent] = useState(EMPTY_STUDENT);
  const [rollPreview, setRollPreview] = useState('');
  const [saved, setSaved] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  const centerId = selectedCenter?.id;

  // Merge center DB data with any editable overrides
  const center = selectedCenter ? { ...selectedCenter, ...centerFields } : null;

  // Auto roll preview
  useEffect(() => {
    if (!centerId || !session) { setRollPreview(''); return; }
    let cancelled = false;
    previewRollNumber(session, centerId)
      .then(({ data }) => { if (!cancelled) setRollPreview(data.roll_no); })
      .catch(() => { if (!cancelled) setRollPreview(''); });
    return () => { cancelled = true; };
  }, [centerId, session]);

  const setS = (k) => (e) => setStudent(p => ({ ...p, [k]: e.target.value }));

  const handleYearCode = (code) => {
    const opt = YEAR_OPTIONS.find(y => y.code === code);
    setStudent(p => ({ ...p, year_code: code, year: opt?.name ?? p.year }));
  };
  const handleYear = (name) => {
    const opt = YEAR_OPTIONS.find(y => y.name === name);
    setStudent(p => ({ ...p, year: name, year_code: opt?.code ?? p.year_code }));
  };
  const handleSubjectCode = (code) => {
    const opt = SUBJECT_OPTIONS.find(s => s.code === code);
    setStudent(p => ({ ...p, subject_code: code, subject: opt?.name ?? p.subject }));
  };
  const handleSubject = (name) => {
    const opt = SUBJECT_OPTIONS.find(s => s.name === name);
    setStudent(p => ({ ...p, subject: name, subject_code: opt?.code ?? p.subject_code }));
  };

  const saveCurrentStudent = async () => {
    if (!student.name.trim()) { setError('Name of Applicant is required.'); return null; }
    if (!centerId)             { setError('Please find or select a center first.'); return null; }
    if (!session)              { setError('Session is required.'); return null; }

    const { data } = await createStudent({
      name:              student.name.trim(),
      father_name:       student.guardian.trim(),
      dob:               student.dob,
      year:              student.year,
      subject:           student.subject,
      center_id:         centerId,
      session,
      gender:            student.gender,
      nationality:       student.nationality,
      edu_qualification: student.edu_qualification,
    });
    return { id: data.id, roll_no: data.roll_no, name: student.name.trim(), year: student.year, subject: student.subject };
  };

  const handleSaveAndAdd = async () => {
    setError('');
    setSaving(true);
    try {
      const result = await saveCurrentStudent();
      if (!result) return;
      setSaved(p => [...p, result]);
      setStudent(EMPTY_STUDENT);
      setRollPreview('');
      setLocked(true);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save student.');
    } finally { setSaving(false); }
  };

  const handleSubmitFinish = async () => {
    setError('');
    setSaving(true);
    try {
      let allSaved = [...saved];
      if (student.name.trim()) {
        const result = await saveCurrentStudent();
        if (!result) return;
        allSaved = [...allSaved, result];
      }
      if (allSaved.length === 0) { setError('Register at least one student first.'); return; }

      const { data: batch } = await autoCreateBatch({ center_id: centerId, session });
      await assignStudentsToBatch(batch.id, allSaved.map(s => s.id));
      navigate('/admin', { state: { registered: allSaved.length } });
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to finish registration.');
    } finally { setSaving(false); }
  };

  const sessionYear = session.split('-')[0] || new Date().getFullYear();
  const locCode = (center?.district || '').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
  const refLabel = locCode
    ? `#${sessionYear}-${locCode}-${student.subject_code}`
    : `#${sessionYear}-${student.subject_code}`;

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', pb: 4 }}>
      <Typography variant="h5" fontWeight={700} align="center" sx={{ mb: 3 }}>
        Registration Form
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* ── Center Details ─────────────────────────────────────── */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography fontWeight={700}>Center Details</Typography>
            <Button size="small" variant="outlined"
              startIcon={locked ? <Lock fontSize="small" /> : <LockOpen fontSize="small" />}
              onClick={() => setLocked(p => !p)}
              sx={{ textTransform: 'none', minWidth: 130 }}>
              {locked ? 'Locked' : 'Section Lock'}
            </Button>
          </Box>

          <CenterPicker
            value={center}
            onChange={(c) => { setSelectedCenter(c); setCenterFields({}); }}
            disabled={locked}
            readOnly={false}
            showDetails={true}
            onFieldChange={(k, v) => setCenterFields(p => ({ ...p, [k]: v }))}
          />

          <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField size="small" label="Session *" select fullWidth disabled={locked}
                value={session} onChange={e => setSession(e.target.value)}>
                {SESSIONS.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* ── Student Details ────────────────────────────────────── */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography fontWeight={700} sx={{ mb: 2 }}>Student Details</Typography>
          <Grid container spacing={1.5}>
            <Grid item xs={12}>
              <TextField size="small" label="Name of Applicant *" fullWidth
                value={student.name} onChange={setS('name')} />
            </Grid>
            <Grid item xs={12}>
              <TextField size="small" label="Father / Mother / Husband / Guardian" fullWidth
                value={student.guardian} onChange={setS('guardian')} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormLabel sx={{ fontSize: 13, color: 'text.secondary' }}>Sex</FormLabel>
              <RadioGroup row value={student.gender}
                onChange={e => setStudent(p => ({ ...p, gender: e.target.value }))}>
                <FormControlLabel value="Male"   control={<Radio size="small" />} label="Male" />
                <FormControlLabel value="Female" control={<Radio size="small" />} label="Female" />
              </RadioGroup>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField size="small" label="Date of Birth" type="date" fullWidth
                value={student.dob} onChange={setS('dob')} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField size="small" label="Age" fullWidth disabled value={calcAge(student.dob)} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField size="small" label="Nationality" select fullWidth
                value={student.nationality} onChange={setS('nationality')}>
                <MenuItem value="Indian">Indian</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField size="small" label="Educational Qualification" select fullWidth
                value={student.edu_qualification} onChange={setS('edu_qualification')}>
                <MenuItem value="">Select Qualification</MenuItem>
                {QUALIFICATIONS.map(q => <MenuItem key={q} value={q}>{q}</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* ── Examination Details ────────────────────────────────── */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography fontWeight={700} sx={{ mb: 2 }}>Examination Details</Typography>
          <Grid container spacing={1.5}>
            <Grid item xs={3} sm={2}>
              <TextField size="small" label="Year Code" fullWidth
                value={student.year_code} onChange={e => handleYearCode(e.target.value)} />
            </Grid>
            <Grid item xs={9} sm={4}>
              <TextField size="small" label="Year Name" select fullWidth
                value={student.year} onChange={e => handleYear(e.target.value)}>
                {YEAR_OPTIONS.map(y => <MenuItem key={y.code} value={y.name}>{y.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={3} sm={2}>
              <TextField size="small" label="Subject Code" fullWidth
                value={student.subject_code} onChange={e => handleSubjectCode(e.target.value)} />
            </Grid>
            <Grid item xs={9} sm={4}>
              <TextField size="small" label="Subject Name" select fullWidth
                value={student.subject} onChange={e => handleSubject(e.target.value)}>
                {SUBJECT_OPTIONS.map(s => <MenuItem key={s.code} value={s.name}>{s.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField size="small" label="Roll Number" fullWidth disabled
                value={rollPreview || 'auto-generated on save'}
                InputProps={{ sx: { fontFamily: 'monospace', fontSize: 13 } }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField size="small" label="Session" fullWidth disabled value={session} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* ── Bottom bar ─────────────────────────────────────────── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap',
        px: 2, py: 1.5, bgcolor: 'grey.50', borderRadius: 2,
        border: '1px solid', borderColor: 'divider',
      }}>
        <Typography variant="body2" fontWeight={700} color="text.secondary" sx={{ mr: 'auto' }}>
          {refLabel}
          {saved.length > 0 && (
            <Chip label={`${saved.length} saved`} size="small" color="success"
              variant="outlined" sx={{ ml: 1 }} />
          )}
        </Typography>
        <Button variant="outlined" startIcon={<PersonAdd fontSize="small" />}
          disabled={saving} onClick={handleSaveAndAdd}>
          Save & Add New
        </Button>
        <Button variant="outlined" startIcon={<Visibility fontSize="small" />}
          onClick={() => setPreviewOpen(true)}>
          Preview ({saved.length})
        </Button>
        <Button variant="contained" color="success" disabled={saving}
          startIcon={<CheckCircle fontSize="small" />}
          onClick={handleSubmitFinish}>
          {saving ? 'Finishing…' : 'Submit & Finish'}
        </Button>
      </Box>

      <PreviewDialog open={previewOpen} onClose={() => setPreviewOpen(false)} saved={saved} />
    </Box>
  );
}
