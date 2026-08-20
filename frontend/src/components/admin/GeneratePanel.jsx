import React, { useState, useEffect, useRef } from 'react';
import {
  Card, CardContent, Typography, Button, Divider,
  LinearProgress, Alert, Box, Chip, Select, MenuItem,
  FormControl, InputLabel, Tooltip, IconButton
} from '@mui/material';
import {
  Download, Verified, CheckCircle, Cancel, Upload, Refresh
} from '@mui/icons-material';
import api, { triggerDownload } from '../../utils/api';

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
