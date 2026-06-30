import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, CircularProgress, Alert, Stack, Paper,
} from '@mui/material';
import { ArrowBack, Save, CheckCircle } from '@mui/icons-material';
import { getBatchMarks, saveMarks } from '../utils/api';
import {
  computeMarks, isPaintingSubject, relevantKeysForYear,
  isCertEligible, generateCertificateNo, IA_PAINTING_KEYS,
} from '../utils/markRules';

// ── Year abbreviations (mirrors allocationSheetPdf.js) ───────────────────────
const YEAR_ABBR = {
  'Pre-preparatory 1st':  'P.P. I',
  'Pre-preparatory 2nd':  'P.P. II',
  'Pre-preparatory 3rd':  'P.P. III',
  'Beginner Class - I':   'B.C. I',
  'Beginner Class - II':  'B.C. II',
  'Beginner Class - III': 'B.C. III',
  'First Year':           'Yr. I',
  'Second Year':          'Yr. II',
  'Third Year':           'Yr. III',
  'Fourth Year':          'Yr. IV',
  'Fifth Year':           'Yr. V',
  'Sixth Year':           'Yr. VI',
  'Seventh Year':         'Yr. VII',
};
const abbrYear = (y) => YEAR_ABBR[y] || YEAR_ABBR[(y || '').trim()] || y || '—';

// ── Column definitions ────────────────────────────────────────────────────────
const PRACTICAL = [
  { key: 'practical_paper1', short: '1st Paper', max: 100, w: 62 },
  { key: 'practical_paper2', short: '2nd Paper', max: 100, w: 62 },
  { key: 'practical_fabric', short: 'Fabric',    max: 100, w: 56 },
];
const IA = [
  { key: 'ia_composition',   short: 'Comp.',     max: 20, w: 50 },
  { key: 'ia_illustration',  short: 'Illus.',    max: 20, w: 50 },
  { key: 'ia_still_life',    short: 'Still Life',max: 20, w: 56 },
  { key: 'ia_press_layout',  short: 'Press',     max: 20, w: 50 },
  { key: 'ia_landscape',     short: 'Land.',     max: 20, w: 50 },
  { key: 'ia_book_cover',    short: 'Book Cv.',  max: 20, w: 56 },
  { key: 'ia_lettering',     short: 'Letter.',   max: 20, w: 52 },
  { key: 'ia_sketch',        short: 'Sketch',    max: 20, w: 50 },
  { key: 'ia_poster_design', short: 'Poster',    max: 20, w: 50 },
];
const OT = [
  { key: 'oral',           short: 'Oral',     max: 50, w: 50 },
  { key: 'theory_paper1', short: 'Theory I',  max: 50, w: 58 },
  { key: 'theory_paper2', short: 'Theory II', max: 50, w: 58 },
];
const ALL_MARK_COLS = [...PRACTICAL, ...IA, ...OT];

// ── Helpers ───────────────────────────────────────────────────────────────────
// Calculation rules are year/subject-aware — see utils/markRules.js.
function computeRow(row) {
  return computeMarks(row.subject, row.year, row);
}

function buildSavePayload(row) {
  const { total, division, distinction, iaTotal } = computeRow(row);
  const nums = {};
  ALL_MARK_COLS.forEach(c => {
    const v = row[c.key];
    if (v === '' || v === null || v === undefined) nums[c.key] = null;
    else if (String(v).trim().toUpperCase() === 'AB') nums[c.key] = null;
    else nums[c.key] = Number(v);
  });
  return {
    ...nums,
    ia_total: typeof iaTotal === 'number' ? iaTotal : 0,
    total_marks: typeof total === 'number' ? total : null,
    division: division || null,
    certificate_no: row.certificate_no || null,
    distinction: distinction || null,
    entered_by: 'admin',
  };
}

function hasData(row) {
  return ALL_MARK_COLS.some(c => row[c.key] !== '' && row[c.key] != null);
}

// ── Style helpers ─────────────────────────────────────────────────────────────
const DIV_STYLE = {
  FIRST:  { bg: '#e8f5e9', color: '#2e7d32' },
  SECOND: { bg: '#e3f2fd', color: '#1565c0' },
  THIRD:  { bg: '#fff3e0', color: '#e65100' },
  FAIL:   { bg: '#ffebee', color: '#c62828' },
  AB:     { bg: '#f3e5f5', color: '#7b1fa2' },
};

const BASE_TH = {
  padding: '7px 4px', textAlign: 'center', fontWeight: 700, fontSize: 11,
  borderRight: '1px solid rgba(255,255,255,0.18)', whiteSpace: 'nowrap',
  color: '#fff',
};
const BASE_TD = {
  padding: '3px 3px', textAlign: 'center',
  borderBottom: '1px solid #e8e8e8', borderRight: '1px solid #e8e8e8',
  verticalAlign: 'middle', fontSize: 12,
};

function stickyTh(left, w, lastSticky = false) {
  return {
    ...BASE_TH, width: w, minWidth: w,
    position: 'sticky', left, zIndex: 5,
    background: '#1a237e',
    boxShadow: lastSticky ? '3px 0 5px -2px rgba(0,0,0,0.25)' : 'none',
  };
}
function stickyTd(left, w, bg, lastSticky = false) {
  return {
    ...BASE_TD, width: w, minWidth: w,
    position: 'sticky', left, zIndex: 2,
    background: bg,
    boxShadow: lastSticky ? '3px 0 5px -2px rgba(0,0,0,0.10)' : 'none',
    fontWeight: 600,
  };
}
function groupTh(extra = {}) {
  return {
    ...BASE_TH, ...extra,
    borderBottom: '1px solid rgba(255,255,255,0.22)',
  };
}

// ── Cell input ────────────────────────────────────────────────────────────────
function CellInput({ value, max, onChange, disabled }) {
  const v = String(value ?? '');
  const isAB = v.toUpperCase() === 'AB';
  const numV = parseFloat(v);
  const isOver = !isAB && v !== '' && !isNaN(numV) && numV > max;
  return (
    <input
      type="text"
      value={v}
      disabled={disabled}
      title={disabled ? 'Not used for this year' : undefined}
      onChange={e => {
        let val = e.target.value;
        if (val.toUpperCase() === 'AB') val = 'AB';
        onChange(val);
      }}
      style={{
        width: '100%', textAlign: 'center', fontSize: 12, fontWeight: 600,
        fontFamily: 'Inter, Roboto, sans-serif',
        border: `1px solid ${isOver ? '#ef5350' : '#ddd'}`,
        borderRadius: 3, padding: '3px 1px',
        background: disabled ? '#eeeeee' : isAB ? '#fff8e1' : isOver ? '#ffebee' : '#fff',
        color: disabled ? '#bbb' : isAB ? '#e65100' : isOver ? '#c62828' : '#222',
        outline: 'none', boxSizing: 'border-box',
        cursor: disabled ? 'not-allowed' : 'text',
      }}
    />
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ResultsEntryPage() {
  const { batchId } = useParams();
  const navigate = useNavigate();

  const [batch, setBatch] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null); // { type, text }
  const rowsRef = useRef([]);

  // keep ref in sync for save handlers
  useEffect(() => { rowsRef.current = rows; }, [rows]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await getBatchMarks(batchId);
        setBatch(data.batch);
        setRows(data.students.map(s => {
          const row = { ...s };
          ALL_MARK_COLS.forEach(c => { if (row[c.key] == null) row[c.key] = ''; });
          if (row.certificate_no == null) row.certificate_no = '';
          if (row.distinction == null) row.distinction = '';
          // Auto-fill certificate no. for years that require one (only if not already set)
          if (!row.certificate_no && isCertEligible(row.subject, row.year)) {
            const centerCode = row.center_code || data.batch?.center_code;
            const session = row.session || data.batch?.session;
            row.certificate_no = generateCertificateNo(centerCode, session, row.roll_no);
          }
          return row;
        }));
      } catch {
        setSaveMsg({ type: 'error', text: 'Failed to load batch data.' });
      } finally {
        setLoading(false);
      }
    })();
  }, [batchId]);

  const updateCell = useCallback((id, key, val) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [key]: val } : r));
  }, []);

  const doSave = useCallback(async (andGoBack = false) => {
    setSaving(true); setSaveMsg(null);
    const current = rowsRef.current;
    const toSave = current.filter(hasData);
    if (!toSave.length) {
      setSaving(false);
      setSaveMsg({ type: 'warning', text: 'No marks entered yet.' });
      return;
    }
    try {
      for (const row of toSave) {
        await saveMarks(row.id, buildSavePayload(row));
      }
      setSaveMsg({ type: 'success', text: `Saved marks for ${toSave.length} student${toSave.length !== 1 ? 's' : ''}.` });
      if (andGoBack) navigate('/admin/batches');
    } catch (e) {
      setSaveMsg({ type: 'error', text: e.response?.data?.error || 'Save failed.' });
    } finally {
      setSaving(false);
    }
  }, [navigate]);

  // ── Batch header info ─────────────────────────────────────────────────────
  const first = rows[0];
  const info = [
    ['Batch ID', batch?.batch_code || '—'],
    ['Year',     first?.year || batch?.year || '—'],
    ['Subject',  first?.subject || '—'],
    ['Center Code', batch?.center_code ? `C/${batch.center_code}` : (first?.center_code ? `C/${first.center_code}` : '—')],
    ['Center Name', batch?.center_name || first?.center_name || '—'],
    ['Session',  batch?.session || first?.session || '—'],
  ];

  const done = rows.filter(r => r.total_marks != null).length;

  // ── Painting-specific column set ──────────────────────────────────────────
  // "REST COLUMNS ARE NOT NEEDED" for Painting: Fabric + 4 of the 9 IA criteria
  // are dropped from the grid entirely. Other subjects keep the full column set.
  const isPainting = isPaintingSubject(first?.subject || batch?.subject);
  const PRACTICAL_COLS = isPainting ? PRACTICAL.filter(c => c.key !== 'practical_fabric') : PRACTICAL;
  const IA_COLS = isPainting ? IA.filter(c => IA_PAINTING_KEYS.includes(c.key)) : IA;
  const VISIBLE_MARK_COLS = [...PRACTICAL_COLS, ...IA_COLS, ...OT];

  // ── Sticky column left positions ──────────────────────────────────────────
  // S.(36) | Roll No.(95) | Name(170) ← last sticky
  const SL_W = 36, ROLL_W = 95, NAME_W = 170;
  const ROLL_LEFT = SL_W;
  const NAME_LEFT = SL_W + ROLL_W;

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
      <CircularProgress />
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 116px)', gap: 1.5 }}>

      {/* ── Top bar ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Button size="small" startIcon={<ArrowBack />} onClick={() => navigate('/admin/batches')}>
          Batches
        </Button>
        <Typography variant="h5" fontWeight={700}>Results Entry</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
          {done}/{rows.length} entered
        </Typography>
      </Box>

      {/* ── Batch info bar ── */}
      <Paper variant="outlined" sx={{ px: 2, py: 1.5 }}>
        <Stack direction="row" spacing={3} flexWrap="wrap" rowGap={0.5}>
          {info.map(([label, val]) => (
            <Box key={label}>
              <Typography variant="caption" color="text.secondary" display="block" lineHeight={1.2}>{label}</Typography>
              <Typography variant="body2" fontWeight={700}>{val}</Typography>
            </Box>
          ))}
        </Stack>
      </Paper>

      {/* ── Alerts ── */}
      {saveMsg && (
        <Alert severity={saveMsg.type} onClose={() => setSaveMsg(null)}
          icon={saveMsg.type === 'success' ? <CheckCircle /> : undefined}>
          {saveMsg.text}
        </Alert>
      )}

      {/* ── Table ── */}
      <Box sx={{ flex: 1, overflow: 'auto', border: '1px solid #e0e0e0', borderRadius: 1, minHeight: 0, minWidth: 0 }}>
        <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 1500 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            {/* Group header row */}
            <tr style={{ background: '#1a237e' }}>
              <th rowSpan={2} style={stickyTh(0,        SL_W)}>S.</th>
              <th rowSpan={2} style={stickyTh(ROLL_LEFT, ROLL_W)}>Roll No.</th>
              <th rowSpan={2} style={stickyTh(NAME_LEFT, NAME_W, true)}>Name of Examinee</th>
              <th rowSpan={2} style={{ ...BASE_TH, width: 75 }}>Year</th>
              <th colSpan={PRACTICAL_COLS.length} style={groupTh({ background: '#1565c0' })}>Practical Marks</th>
              <th colSpan={IA_COLS.length}        style={groupTh({ background: '#1b5e20' })}>Internal Assessment</th>
              <th colSpan={OT.length}        style={groupTh({ background: '#4a148c' })}>Oral &amp; Theoretical</th>
              <th rowSpan={2} style={{ ...BASE_TH, width: 62, background: '#37474f' }}>Total</th>
              <th rowSpan={2} style={{ ...BASE_TH, width: 78, background: '#37474f' }}>Division</th>
              <th rowSpan={2} style={{ ...BASE_TH, width: 90, background: '#37474f' }}>Distinction</th>
              <th rowSpan={2} style={{ ...BASE_TH, width: 130, background: '#37474f' }}>Cert. No.</th>
            </tr>
            {/* Sub-column header row */}
            <tr>
              {PRACTICAL_COLS.map(c => (
                <th key={c.key} style={{ ...BASE_TH, width: c.w, minWidth: c.w, background: '#1565c0', fontSize: 10 }}>{c.short}</th>
              ))}
              {IA_COLS.map(c => (
                <th key={c.key} style={{ ...BASE_TH, width: c.w, minWidth: c.w, background: '#1b5e20', fontSize: 10 }}>{c.short}</th>
              ))}
              {OT.map(c => (
                <th key={c.key} style={{ ...BASE_TH, width: c.w, minWidth: c.w, background: '#4a148c', fontSize: 10 }}>{c.short}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, idx) => {
              const { total, division, distinction } = computeRow(row);
              const rowBg = idx % 2 === 0 ? '#ffffff' : '#f5f7ff';
              const divStyle = division ? DIV_STYLE[division] : null;
              const relevantKeys = isPainting ? relevantKeysForYear(row.year) : null;
              const isDimmed = (key) => relevantKeys != null && !relevantKeys.includes(key);

              return (
                <tr key={row.id} style={{ background: rowBg }}>
                  {/* Sticky: S. */}
                  <td style={stickyTd(0,         SL_W,   rowBg)}>{idx + 1}</td>
                  {/* Sticky: Roll No. */}
                  <td style={stickyTd(ROLL_LEFT,  ROLL_W, rowBg)}>{row.roll_no}</td>
                  {/* Sticky: Name */}
                  <td style={{ ...stickyTd(NAME_LEFT, NAME_W, rowBg, true), textAlign: 'left', paddingLeft: 8, fontWeight: 500 }}>
                    {row.name}
                  </td>
                  {/* Year */}
                  <td style={{ ...BASE_TD, width: 75, fontSize: 11, fontWeight: 600 }}>{abbrYear(row.year)}</td>

                  {/* Practical cells */}
                  {PRACTICAL_COLS.map(col => (
                    <td key={col.key} style={{
                      ...BASE_TD, width: col.w, minWidth: col.w, padding: '3px 4px',
                      background: isDimmed(col.key) ? '#f0f0f0' : undefined,
                    }}>
                      <CellInput value={row[col.key]} max={col.max} disabled={isDimmed(col.key)}
                        onChange={v => updateCell(row.id, col.key, v)} />
                    </td>
                  ))}

                  {/* IA cells */}
                  {IA_COLS.map(col => (
                    <td key={col.key} style={{
                      ...BASE_TD, width: col.w, minWidth: col.w, padding: '3px 4px',
                      background: isDimmed(col.key) ? '#f0f0f0' : undefined,
                    }}>
                      <CellInput value={row[col.key]} max={col.max} disabled={isDimmed(col.key)}
                        onChange={v => updateCell(row.id, col.key, v)} />
                    </td>
                  ))}

                  {/* Oral & Theory cells */}
                  {OT.map(col => (
                    <td key={col.key} style={{
                      ...BASE_TD, width: col.w, minWidth: col.w, padding: '3px 4px',
                      background: isDimmed(col.key) ? '#f0f0f0' : undefined,
                    }}>
                      <CellInput value={row[col.key]} max={col.max} disabled={isDimmed(col.key)}
                        onChange={v => updateCell(row.id, col.key, v)} />
                    </td>
                  ))}

                  {/* Total (auto) */}
                  <td style={{ ...BASE_TD, width: 62, fontWeight: 700, color: '#1a237e', fontSize: 13 }}>
                    {total !== null ? total : <span style={{ color: '#ccc' }}>—</span>}
                  </td>

                  {/* Division (auto) */}
                  <td style={{ ...BASE_TD, width: 78 }}>
                    {divStyle ? (
                      <span style={{
                        display: 'inline-block', padding: '2px 7px', borderRadius: 4,
                        fontSize: 11, fontWeight: 700,
                        background: divStyle.bg, color: divStyle.color,
                      }}>{division}</span>
                    ) : <span style={{ color: '#ccc' }}>—</span>}
                  </td>

                  {/* Distinction (auto) */}
                  <td style={{ ...BASE_TD, width: 90, fontSize: 11, fontWeight: 700, color: '#6a1b9a' }}>
                    {distinction || <span style={{ color: '#ccc', fontWeight: 400 }}>—</span>}
                  </td>

                  {/* Cert. No. (manual) */}
                  <td style={{ ...BASE_TD, width: 130, padding: '3px 6px' }}>
                    <input
                      type="text"
                      value={row.certificate_no ?? ''}
                      onChange={e => updateCell(row.id, 'certificate_no', e.target.value)}
                      placeholder="e.g. ATC1-26/0001"
                      style={{
                        width: '100%', fontSize: 11, border: '1px solid #ddd',
                        borderRadius: 3, padding: '3px 5px',
                        fontFamily: 'Inter, Roboto, sans-serif',
                        outline: 'none', boxSizing: 'border-box',
                        color: '#333',
                      }}
                    />
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td colSpan={4 + VISIBLE_MARK_COLS.length + 4}
                  style={{ ...BASE_TD, textAlign: 'center', padding: 32, color: '#999' }}>
                  No students in this batch.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Box>

      {/* ── Footer buttons — sticky so they're always reachable ── */}
      <Box sx={{
        position: 'sticky', bottom: 0, zIndex: 20,
        display: 'flex', justifyContent: 'flex-end', gap: 1.5,
        py: 1, px: 0.5,
        background: 'background.paper',
        bgcolor: '#fff',
        borderTop: '1px solid #e0e0e0',
        mt: 'auto',
      }}>
        <Button
          variant="contained"
          size="large"
          startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <Save />}
          disabled={saving}
          onClick={() => doSave(false)}
          sx={{
            minWidth: 160, borderRadius: 2, fontWeight: 700,
            background: '#e87722',
            '&:hover': { background: '#cf6610' },
          }}
        >
          Save &amp; Next
        </Button>
        <Button
          variant="contained"
          color="success"
          size="large"
          disabled={saving}
          onClick={() => doSave(true)}
          sx={{ minWidth: 170, borderRadius: 2, fontWeight: 700 }}
        >
          Submit &amp; Finish
        </Button>
      </Box>
    </Box>
  );
}
