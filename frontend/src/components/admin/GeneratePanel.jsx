import React, { useState, useEffect, useRef } from 'react';
import {
  Card, CardContent, Typography, Button, Grid, Divider,
  LinearProgress, Alert, Box, Chip, Select, MenuItem,
  FormControl, InputLabel, Tooltip, IconButton
} from '@mui/material';
import {
  Download, PictureAsPdf, TableChart, Assessment, Article,
  Verified, CheckCircle, Cancel, Upload, Refresh
} from '@mui/icons-material';
import api, {
  downloadAdmitCards, downloadAllocationSheet,
  downloadResultSheet, triggerDownload
} from '../../utils/api';
import { downloadMarkSheetPdf } from '../../utils/api';

const CERT_TYPES = [
  { value: 'admit_card',           label: 'Admit Card' },
  { value: 'allocation_sheet',     label: 'Allocation Sheet' },
  { value: 'result_sheet',          label: 'Result Sheet' },
  { value: 'mark_sheet',           label: 'Mark Sheet' },
  { value: 'senior_diploma_final', label: 'Senior Diploma Final' },
  { value: 'junior_diploma',       label: 'Junior Diploma / Pre-Prep 3rd' },
  { value: 'ankan_visharad',       label: 'Ankan Visharad' },
  { value: 'junior_diploma_final', label: 'Junior Diploma Final / Beginner III' },
  { value: 'ankan_ratna',          label: 'Ankan Ratna' },
];

const DocCard = ({ icon, title, desc, color, onDownload, loading, buttonLabel }) => (
  <Card variant="outlined" sx={{ height: '100%', borderColor: `${color}.200` }}>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
        <Box sx={{
          width: 44, height: 44, borderRadius: 2,
          bgcolor: `${color}.50`, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          {React.cloneElement(icon, { sx: { color: `${color}.700`, fontSize: 22 } })}
        </Box>
        <Box>
          <Typography fontWeight={700} fontSize={15}>{title}</Typography>
          <Typography variant="caption" color="text.secondary">{desc}</Typography>
        </Box>
      </Box>
      <Button
        variant="contained" fullWidth size="small"
        onClick={onDownload} disabled={loading}
        startIcon={<Download fontSize="small" />}
        sx={{ bgcolor: `${color}.700`, '&:hover': { bgcolor: `${color}.900` } }}
      >
        {loading ? 'Generating…' : (buttonLabel || 'Download .docx')}
      </Button>
    </CardContent>
  </Card>
);

export default function GeneratePanel({ centerId, filters }) {
  const [loadingMap, setLoadingMap]         = useState({});
  const [error, setError]                   = useState('');
  const [certType, setCertType]             = useState('senior_diploma_final');
  const [templateStatus, setTemplateStatus] = useState({});
  const [uploadMsg, setUploadMsg]           = useState('');
  const fileInputRef                        = useRef();

  const setLoading = (key, val) => setLoadingMap(p => ({ ...p, [key]: val }));
  const anyLoading = Object.values(loadingMap).some(Boolean);

  const fetchTemplateStatus = async () => {
    try {
      const { data } = await api.get('/generate/template-status');
      setTemplateStatus(data);
    } catch {}
  };

  useEffect(() => { fetchTemplateStatus(); }, []);

  const download = async (key, fn, filename) => {
    setError('');
    setLoading(key, true);
    try {
      const { data } = await fn({ center_id: centerId, ...filters });
      triggerDownload(data, filename);
    } catch {
      setError(`Failed to generate ${key}. Make sure students are registered.`);
    } finally {
      setLoading(key, false);
    }
  };

  const downloadCertsBulk = async () => {
    setError('');
    setLoading('certs', true);
    try {
      const params = new URLSearchParams({ cert_type: certType, ...(centerId && { center_id: centerId }), ...filters });
      const { data } = await api.get(`/generate/certificates-zip?${params}`, { responseType: 'blob' });
      triggerDownload(data, `certificates-${certType}.zip`);
    } catch {
      setError('Failed to generate certificates. Check that students exist and template image is uploaded.');
    } finally {
      setLoading('certs', false);
    }
  };

  const handleTemplateUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadMsg('');
    const form = new FormData();
    form.append('cert_type', certType);
    form.append('image', file);
    try {
      await api.post('/generate/upload-template', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadMsg('✓ Uploaded: ' + CERT_TYPES.find(c => c.value === certType)?.label);
      fetchTemplateStatus();
    } catch {
      setUploadMsg('✗ Upload failed');
    }
  };

  const hasTemplate = templateStatus[certType];

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" fontWeight={700}>Generate Documents</Typography>
          <Chip label="Bulk — all filtered students" size="small" />
        </Box>

        {anyLoading && <LinearProgress sx={{ mb: 2 }} />}
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <DocCard icon={<PictureAsPdf />} color="primary"
              title="Admit Cards" desc="One card per student"
              loading={loadingMap.admit}
              onDownload={() => download('admit', downloadAdmitCards, 'admit-cards.docx')} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <DocCard icon={<Verified />} color="secondary"
              title="Admit Cards (PDF)" desc="Image template overlay — bulk PDF"
              loading={loadingMap.admitPdf}
              buttonLabel="Download PDF"
              onDownload={async () => {
                setLoading('admitPdf', true); setError('');
                try {
                  const params = new URLSearchParams({ ...(centerId && { center_id: centerId }), ...filters });
                  const { data } = await api.get(`/generate/admit-cards-pdf?${params}`, { responseType: 'blob' });
                  triggerDownload(data, 'admit-cards.pdf');
                } catch { setError('Failed to generate admit card PDFs. Upload the admit_card template image first.'); }
                finally { setLoading('admitPdf', false); }
              }} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <DocCard icon={<TableChart />} color="success"
              title="Allocation Sheet" desc="Seating allocation table"
              loading={loadingMap.alloc}
              onDownload={() => download('alloc', downloadAllocationSheet, 'allocation-sheet.docx')} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <DocCard icon={<Assessment />} color="warning"
              title="Result Sheet" desc="Marks + division table"
              loading={loadingMap.result}
              onDownload={() => download('result', downloadResultSheet, 'result-sheet.docx')} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <DocCard icon={<Article />} color="error"
              title="All Marksheets" desc="Individual student marksheets"
              loading={loadingMap.marks}
              onDownload={() => download('marks', downloadResultSheet, 'marksheets.docx')} />
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Verified color="secondary" />
          <Typography fontWeight={700} fontSize={16}>Certificates (PDF)</Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 280 }}>
            <InputLabel>Certificate Type</InputLabel>
            <Select value={certType} label="Certificate Type" onChange={e => setCertType(e.target.value)}>
              {CERT_TYPES.map(c => (
                <MenuItem key={c.value} value={c.value}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {templateStatus[c.value]
                      ? <CheckCircle sx={{ fontSize: 14, color: 'success.main' }} />
                      : <Cancel sx={{ fontSize: 14, color: 'warning.main' }} />}
                    {c.label}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Chip
            icon={hasTemplate ? <CheckCircle /> : <Cancel />}
            label={hasTemplate ? 'Template image ✓' : 'No template image'}
            color={hasTemplate ? 'success' : 'warning'}
            size="small" variant="outlined"
          />

          <Tooltip title="Refresh template status">
            <IconButton size="small" onClick={fetchTemplateStatus}><Refresh fontSize="small" /></IconButton>
          </Tooltip>
        </Box>

        <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 2, border: '1px dashed', borderColor: 'grey.300' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Upload template image (PNG/JPEG) for <strong>{CERT_TYPES.find(c => c.value === certType)?.label}</strong>:
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button variant="outlined" size="small" startIcon={<Upload />}
              onClick={() => fileInputRef.current?.click()}>
              Upload Template Image
            </Button>
            <input ref={fileInputRef} type="file" accept="image/*"
              style={{ display: 'none' }} onChange={handleTemplateUpload} />
            {uploadMsg && (
              <Typography variant="caption"
                color={uploadMsg.startsWith('✓') ? 'success.main' : 'error.main'}>
                {uploadMsg}
              </Typography>
            )}
          </Box>
          {!hasTemplate && (
            <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
              Without a template image, certificates will be text-only placeholder PDFs.
            </Typography>
          )}
        </Box>

        <Button variant="contained" color="secondary"
          startIcon={<Download />}
          disabled={loadingMap.certs}
          onClick={downloadCertsBulk}
          sx={{ minWidth: 260 }}>
          {loadingMap.certs
            ? 'Generating PDFs…'
            : `Download — ${CERT_TYPES.find(c => c.value === certType)?.label}`}
        </Button>

      </CardContent>
    </Card>
  );
}
