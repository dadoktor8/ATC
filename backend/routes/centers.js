const router = require('express').Router();
const db = require('../db/client');
const { adminOnly } = require('../middleware/auth');

router.get('/', async (req, res) => {
  res.json(await db.all('SELECT * FROM centers ORDER BY name'));
});

// Must be before /:id to avoid collision
router.get('/by-code/:code', async (req, res) => {
  const row = await db.get('SELECT * FROM centers WHERE code=$1', [req.params.code]);
  if (!row) return res.status(404).json({ error: 'Center not found' });
  res.json(row);
});

// Find existing center by code+teacher, or create it
router.post('/find-or-create', adminOnly, async (req, res) => {
  const { code, incharge_name, name, address, state, district, co_name } = req.body;
  const existing = await db.get(
    'SELECT * FROM centers WHERE code=$1 AND incharge_name=$2',
    [code, incharge_name]
  );
  if (existing) return res.json(existing);

  const r = await db.run(
    `INSERT INTO centers (name, district, incharge_name, code, address, state, co_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [name, district || '', incharge_name, code, address || '', state || 'Assam', co_name || '']
  );
  res.status(201).json({
    id: r.id, code, incharge_name, name,
    address: address || '', state: state || 'Assam',
    district: district || '', co_name: co_name || '',
  });
});

router.get('/:id', async (req, res) => {
  const row = await db.get('SELECT * FROM centers WHERE id=$1', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Center not found' });
  res.json(row);
});

router.post('/', adminOnly, async (req, res) => {
  const { name, district, incharge_name, incharge_title, code, address, state, co_name } = req.body;
  if (!name) return res.status(400).json({ error: 'Center name is required' });
  const r = await db.run(
    `INSERT INTO centers (name, district, incharge_name, incharge_title, code, address, state, co_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [name, district, incharge_name, incharge_title || null, code || null,
     address || null, state || 'ASSAM', co_name || null]
  );
  res.status(201).json({ id: r.id });
});

router.put('/:id', adminOnly, async (req, res) => {
  const { name, district, incharge_name, incharge_title, code, address, state, co_name } = req.body;
  await db.run(
    `UPDATE centers SET name=$1, district=$2, incharge_name=$3, incharge_title=$4,
     code=$5, address=$6, state=$7, co_name=$8 WHERE id=$9`,
    [name, district, incharge_name, incharge_title || null, code || null,
     address || null, state || 'ASSAM', co_name || null, req.params.id]
  );
  res.json({ success: true });
});

router.delete('/:id', adminOnly, async (req, res) => {
  const count = await db.get('SELECT COUNT(*) as c FROM students WHERE center_id=$1', [req.params.id]);
  if (Number(count.c) > 0)
    return res.status(409).json({ error: 'Cannot delete center with registered students' });
  await db.run('DELETE FROM centers WHERE id=$1', [req.params.id]);
  res.json({ success: true });
});

module.exports = router;
