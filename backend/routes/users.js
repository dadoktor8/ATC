const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db/schema');
const { adminOnly, superAdminOnly, ADMIN_ROLES } = require('../middleware/auth');

// GET /api/users — list all users (admin+)
router.get('/', adminOnly, (req, res) => {
  const users = db.prepare(
    `SELECT id, username, role, created_at FROM users ORDER BY created_at ASC`
  ).all();
  res.json(users);
});

// POST /api/users — create a user
// super_admin: any role; admin: maintainer only
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
    const result = db.prepare(
      `INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)`
    ).run(username.trim(), hash, role);
    res.json({ id: result.lastInsertRowid, username: username.trim(), role });
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Username already taken' });
    throw e;
  }
});

// PUT /api/users/:id/role — change role
router.put('/:id/role', adminOnly, (req, res) => {
  const { role } = req.body;
  const target = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
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

  db.prepare('UPDATE users SET role=? WHERE id=?').run(role, target.id);
  res.json({ success: true });
});

// PUT /api/users/:id/password — reset password
router.put('/:id/password', adminOnly, async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const target = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'Use change-password to update your own password' });

  const caller = req.user.role;
  if (caller !== 'super_admin' && ADMIN_ROLES.has(target.role))
    return res.status(403).json({ error: 'Only super-admin can reset an admin\'s password' });

  const hash = await bcrypt.hash(password, 12);
  db.prepare('UPDATE users SET password_hash=?, password=NULL WHERE id=?').run(hash, target.id);
  res.json({ success: true });
});

// DELETE /api/users/:id
router.delete('/:id', adminOnly, (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });

  const caller = req.user.role;
  if (caller !== 'super_admin' && ADMIN_ROLES.has(target.role))
    return res.status(403).json({ error: 'Only super-admin can delete an admin' });

  db.prepare('DELETE FROM users WHERE id=?').run(target.id);
  res.json({ success: true });
});

module.exports = router;
