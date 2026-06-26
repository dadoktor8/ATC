const router = require('express').Router();
const db = require('../db/schema');
const { adminOnly } = require('../middleware/auth');

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM centers ORDER BY name').all());
});

// Must be before /:id to avoid collision
router.get('/by-code/:code', (req, res) => {
  const row = db.prepare('SELECT * FROM centers WHERE code=?').get(req.params.code);
  if (!row) return res.status(404).json({ error: 'Center not found' });
  res.json(row);
});

// Find existing center by code+teacher, or create it
router.post('/find-or-create', adminOnly, (req, res) => {
  const { code, incharge_name, name, address, state, district, co_name } = req.body;
  const existing = db.prepare(
    'SELECT * FROM centers WHERE code=? AND incharge_name=?'
  ).get(code, incharge_name);
  if (existing) return res.json(existing);

  const r = db.prepare(
    'INSERT INTO centers (name, district, incharge_name, code, address, state, co_name) VALUES (?,?,?,?,?,?,?)'
  ).run(
    name, district || '', incharge_name, code,
    address || '', state || 'Assam', co_name || ''
  );
  res.status(201).json({
    id: r.lastInsertRowid, code, incharge_name, name,
    address: address || '', state: state || 'Assam',
    district: district || '', co_name: co_name || '',
  });
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM centers WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Center not found' });
  res.json(row);
});

router.post('/', adminOnly, (req, res) => {
  const { name, district, incharge_name, incharge_title, code, address, state, co_name } = req.body;
  if (!name)
    return res.status(400).json({ error: 'Center name is required' });
  const r = db.prepare(
    'INSERT INTO centers (name, district, incharge_name, incharge_title, code, address, state, co_name) VALUES (?,?,?,?,?,?,?,?)'
  ).run(name, district, incharge_name, incharge_title || null, code || null, address || null, state || 'ASSAM', co_name || null);
  res.status(201).json({ id: r.lastInsertRowid });
});

router.put('/:id', adminOnly, (req, res) => {
  const { name, district, incharge_name, incharge_title, code, address, state, co_name } = req.body;
  db.prepare(
    'UPDATE centers SET name=?, district=?, incharge_name=?, incharge_title=?, code=?, address=?, state=?, co_name=? WHERE id=?'
  ).run(name, district, incharge_name, incharge_title || null, code || null, address || null, state || 'ASSAM', co_name || null, req.params.id);
  res.json({ success: true });
});

router.delete('/:id', adminOnly, (req, res) => {
  const count = db.prepare('SELECT COUNT(*) as c FROM students WHERE center_id=?').get(req.params.id);
  if (count.c > 0) return res.status(409).json({ error: 'Cannot delete center with registered students' });
  db.prepare('DELETE FROM centers WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
