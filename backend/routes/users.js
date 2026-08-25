const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db/client');
const { adminOnly, ADMIN_ROLES } = require('../middleware/auth');

// GET /api/users
router.get('/', adminOnly, async (req, res) => {
  const users = await db.all(
    `SELECT id, username, role, created_at FROM users ORDER BY created_at ASC`
  );
  res.json(users);
});

// POST /api/users — create a user
router.post('/', adminOnly, async (req, res) => {
  const { username, password, role } = req.body;
  if (!username?.trim() || !password || !role)
    return res.status(400).json({ error: 'username, password and role are required' });

  const caller = req.user.role;
  const allowed = caller === 'super_admin'
    ? ['super_admin', 'admin', 'maintainer']
    : ['maintainer'];
  if (!allowed.includes(role))
    return res.status(403).json({ error: `You cannot create a user with role "${role}"` });

  const hash = await bcrypt.hash(password, 12);
  try {
    const r = await db.run(
      `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id`,
      [username.trim(), hash, role]
    );
    res.json({ id: r.id, username: username.trim(), role });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Username already taken' });
    throw e;
  }
});

// PUT /api/users/:id/role
router.put('/:id/role', adminOnly, async (req, res) => {
  const { role } = req.body;
  const target = await db.get('SELECT * FROM users WHERE id=$1', [req.params.id]);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'Cannot change your own role' });

  const caller = req.user.role;
  const allowed = caller === 'super_admin'
    ? ['super_admin', 'admin', 'maintainer']
    : ['maintainer'];
  if (!allowed.includes(role))
    return res.status(403).json({ error: `You cannot assign role "${role}"` });
  if (caller !== 'super_admin' && ADMIN_ROLES.has(target.role))
    return res.status(403).json({ error: 'Only super-admin can change an admin\'s role' });

  await db.run('UPDATE users SET role=$1 WHERE id=$2', [role, target.id]);
  res.json({ success: true });
});

// PUT /api/users/:id/password — admin reset
router.put('/:id/password', adminOnly, async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 10)
    return res.status(400).json({ error: 'Password must be at least 10 characters' });

  const target = await db.get('SELECT * FROM users WHERE id=$1', [req.params.id]);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'Use change-password to update your own password' });

  const caller = req.user.role;
  if (caller !== 'super_admin' && ADMIN_ROLES.has(target.role))
    return res.status(403).json({ error: 'Only super-admin can reset an admin\'s password' });

  const hash = await bcrypt.hash(password, 12);
  await db.run('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, target.id]);
  res.json({ success: true });
});

// DELETE /api/users/:id
router.delete('/:id', adminOnly, async (req, res) => {
  const target = await db.get('SELECT * FROM users WHERE id=$1', [req.params.id]);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });

  const caller = req.user.role;
  if (caller !== 'super_admin' && ADMIN_ROLES.has(target.role))
    return res.status(403).json({ error: 'Only super-admin can delete an admin' });

  await db.run('DELETE FROM users WHERE id=$1', [target.id]);
  res.json({ success: true });
});

module.exports = router;
