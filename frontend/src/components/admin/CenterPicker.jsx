import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, TextField, MenuItem, Button, Grid, Typography,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, Chip, List, ListItem, ListItemButton, ListItemText,
  CircularProgress,
} from '@mui/material';
import { Search, Add } from '@mui/icons-material';
import { getCenters, createCenter, findOrCreateCenter } from '../../utils/api';
import { STATES, DISTRICTS_BY_STATE } from '../../utils/constants';
import { CENTER_PRESETS } from '../../utils/centerPresets';

// ── New Center inline dialog ──────────────────────────────────────────────────
const EMPTY_NEW = { code: '', incharge_name: '', co_name: '', name: '', address: '', state: 'Assam', district: '' };

function NewCenterDialog({ open, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY_NEW);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (open) { setForm(EMPTY_NEW); setError(''); } }, [open]);

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Center name is required.'); return; }
    setSaving(true);
    try {
      const { data } = await createCenter(form);
      onCreated({ id: data.id, ...form });
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to create center.');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle fontWeight={700}>Add New Center</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Grid container spacing={2} sx={{ pt: 1 }}>
          <Grid item xs={12} sm={6}>
            <TextField size="small" label="Center Code" fullWidth value={form.code} onChange={set('code')} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField size="small" label="Teacher's Name" fullWidth value={form.incharge_name} onChange={set('incharge_name')} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField size="small" label="C/O" fullWidth value={form.co_name} onChange={set('co_name')} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField size="small" label="Center Name *" fullWidth value={form.name} onChange={set('name')} />
          </Grid>
          <Grid item xs={12}>
            <TextField size="small" label="Address" fullWidth value={form.address} onChange={set('address')} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField size="small" label="State" select fullWidth value={form.state}
              onChange={e => setForm(p => ({ ...p, state: e.target.value, district: '' }))}>
              {STATES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            {DISTRICTS_BY_STATE[form.state] ? (
              <TextField size="small" label="District" select fullWidth value={form.district} onChange={set('district')}>
                <MenuItem value="">— Select District —</MenuItem>
                {DISTRICTS_BY_STATE[form.state].map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
              </TextField>
            ) : (
              <TextField size="small" label="District" fullWidth value={form.district} onChange={set('district')} />
            )}
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Add Center'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Preset Teacher Picker Dialog ──────────────────────────────────────────────
function PresetPickerDialog({ open, onClose, code, options, onSelect, loading }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle fontWeight={700}>
        Select Teacher — Code {code}
        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
          ({options.length} entries)
        </Typography>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <List dense disablePadding>
            {options.map((opt, i) => (
              <ListItem key={i} disablePadding>
                <ListItemButton onClick={() => onSelect(opt)}
                  sx={{ borderBottom: '1px solid', borderColor: 'divider', py: 1 }}>
                  <ListItemText
                    primary={<Typography variant="body2" fontWeight={600}>{opt.teacher || opt.incharge_name}</Typography>}
                    secondary={`${opt.name} · ${opt.address} · ${opt.district}`}
                    secondaryTypographyProps={{ fontSize: 11 }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}

// ── CenterPicker ──────────────────────────────────────────────────────────────
export default function CenterPicker({
  value = null,
  onChange,
  disabled = false,
  readOnly = true,
  showDetails = true,
  onFieldChange,
}) {
  const [allCenters, setAllCenters] = useState([]);
  const [codeInput, setCodeInput] = useState('');
  const [codeMsg, setCodeMsg] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const [presetOptions, setPresetOptions] = useState([]);
  const [presetCode, setPresetCode] = useState('');
  const [presetLoading, setPresetLoading] = useState(false);

  const fetchCenters = useCallback(() =>
    getCenters().then(({ data }) => setAllCenters(data)).catch(() => {}),
  []);
  useEffect(() => { fetchCenters(); }, [fetchCenters]);

  const applyCenter = (c) => {
    setCodeMsg('');
    setPresetOpen(false);
    onChange && onChange(c);
  };

  const doFindOrCreate = async (code, opt) => {
    setPresetLoading(true);
    try {
      const { data } = await findOrCreateCenter({
        code,
        incharge_name: opt.teacher || opt.incharge_name,
        co_name: opt.co !== undefined ? opt.co : (opt.co_name || ''),
        name: opt.name,
        address: opt.address,
        state: opt.state,
        district: opt.district,
      });
      fetchCenters();
      applyCenter(data);
      setCodeMsg('✓ Center found.');
    } catch {
      setCodeMsg('Failed to load center. Try again.');
      setPresetOpen(false);
    } finally {
      setPresetLoading(false);
    }
  };

  const handleFindByCode = async () => {
    const code = codeInput.trim();
    if (!code) { setCodeMsg('Enter a center code first.'); return; }
    setCodeMsg('');

    const presets = CENTER_PRESETS[code];
    if (presets && presets.length > 0) {
      if (presets.length === 1) {
        await doFindOrCreate(code, presets[0]);
      } else {
        setPresetCode(code);
        setPresetOptions(presets);
        setPresetOpen(true);
      }
      return;
    }

    // Fall back: look in already-loaded centers list
    const matching = allCenters.filter(c => String(c.code) === String(code));
    if (matching.length === 1) {
      applyCenter(matching[0]);
      setCodeMsg('✓ Center found.');
    } else if (matching.length > 1) {
      setPresetCode(code);
      setPresetOptions(matching.map(c => ({
        teacher: c.incharge_name,
        incharge_name: c.incharge_name,
        name: c.name,
        address: c.address,
        state: c.state,
        district: c.district,
        _existing: c,
      })));
      setPresetOpen(true);
    } else {
      setCodeMsg('Code not found. Select from the list or add a new center.');
    }
  };

  const handleSelectOption = (opt) => {
    if (opt._existing) {
      applyCenter(opt._existing);
      setCodeMsg('✓ Center found.');
    } else {
      doFindOrCreate(presetCode, opt);
    }
  };

  const handleSelectCenter = (id) => {
    const c = allCenters.find(c => String(c.id) === String(id));
    if (c) applyCenter(c);
  };

  const handleCenterCreated = (newC) => {
    fetchCenters().then(() => applyCenter(newC));
  };

  const detailField = (label, fieldKey, fieldValue) => {
    if (readOnly) {
      return (
        <TextField size="small" label={label} fullWidth
          value={fieldValue || ''} InputProps={{ readOnly: true }}
          sx={{ bgcolor: 'grey.50' }} />
      );
    }
    return (
      <TextField size="small" label={label} fullWidth disabled={disabled}
        value={fieldValue || ''}
        onChange={e => onFieldChange && onFieldChange(fieldKey, e.target.value)} />
    );
  };

  return (
    <>
      <Grid container spacing={1.5}>
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField size="small" label="Center Code" disabled={disabled}
              value={codeInput} onChange={e => setCodeInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleFindByCode()}
              sx={{ width: 160 }} />
            <Button variant="contained" onClick={handleFindByCode}
              disabled={disabled || presetLoading}
              startIcon={presetLoading
                ? <CircularProgress size={14} color="inherit" />
                : <Search fontSize="small" />}
              sx={{ whiteSpace: 'nowrap' }}>
              Find
            </Button>
            <TextField size="small" label="Or select center" select disabled={disabled}
              value={value ? String(value.id) : ''}
              onChange={e => handleSelectCenter(e.target.value)}
              sx={{ flex: 1 }}>
              <MenuItem value="">— by name —</MenuItem>
              {allCenters.map(c => (
                <MenuItem key={c.id} value={String(c.id)}>
                  {c.code ? `[${c.code}] ` : ''}{c.name}
                </MenuItem>
              ))}
            </TextField>
            <Button variant="outlined" startIcon={<Add fontSize="small" />}
              disabled={disabled} onClick={() => setNewOpen(true)}
              sx={{ whiteSpace: 'nowrap' }}>
              New
            </Button>
          </Box>
          {codeMsg && (
            <Typography variant="caption"
              color={codeMsg.startsWith('✓') ? 'success.main' : 'warning.main'}
              sx={{ mt: 0.5, display: 'block' }}>
              {codeMsg}
            </Typography>
          )}
          {value?.code && (
            <Chip label={`Center Code: ${value.code}`} size="small" color="success"
              variant="outlined" sx={{ mt: 0.5 }} />
          )}
        </Grid>

        {showDetails && value && (
          <>
            <Grid item xs={12} sm={6}>
              {detailField("Center Teacher's Name", 'incharge_name', value.incharge_name)}
            </Grid>
            <Grid item xs={12} sm={6}>
              {detailField('C/O', 'co_name', value.co_name)}
            </Grid>
            <Grid item xs={12} sm={6}>
              {detailField('Center Name', 'name', value.name)}
            </Grid>
            <Grid item xs={12} sm={6}>
              {detailField('Center Address', 'address', value.address)}
            </Grid>
            <Grid item xs={12} sm={6}>
              {readOnly ? (
                <TextField size="small" label="State" fullWidth
                  value={value.state || ''} InputProps={{ readOnly: true }} sx={{ bgcolor: 'grey.50' }} />
              ) : (
                <TextField size="small" label="State" select fullWidth disabled={disabled}
                  value={value.state || 'Assam'}
                  onChange={e => { onFieldChange && onFieldChange('state', e.target.value); onFieldChange && onFieldChange('district', ''); }}>
                  {STATES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </TextField>
              )}
            </Grid>
            <Grid item xs={12} sm={6}>
              {readOnly ? (
                <TextField size="small" label="District" fullWidth
                  value={value.district || ''} InputProps={{ readOnly: true }} sx={{ bgcolor: 'grey.50' }} />
              ) : DISTRICTS_BY_STATE[value.state] ? (
                <TextField size="small" label="District" select fullWidth disabled={disabled}
                  value={value.district || ''}
                  onChange={e => onFieldChange && onFieldChange('district', e.target.value)}>
                  <MenuItem value="">— Select District —</MenuItem>
                  {DISTRICTS_BY_STATE[value.state].map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                </TextField>
              ) : (
                <TextField size="small" label="District" fullWidth disabled={disabled}
                  value={value.district || ''}
                  onChange={e => onFieldChange && onFieldChange('district', e.target.value)} />
              )}
            </Grid>
          </>
        )}
      </Grid>

      <PresetPickerDialog
        open={presetOpen}
        onClose={() => setPresetOpen(false)}
        code={presetCode}
        options={presetOptions}
        onSelect={handleSelectOption}
        loading={presetLoading}
      />

      <NewCenterDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={handleCenterCreated}
      />
    </>
  );
}
