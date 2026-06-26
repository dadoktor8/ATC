require('dotenv').config();
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('../db/schema');

const JWT_SECRET = process.env.JWT_SECRET || 'atc_dev_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' }
});

router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password required' });

  const user = db.prepare('SELECT * FROM users WHERE username=?').get(username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = user.password_hash
    ? await bcrypt.compare(password, user.password_hash)
    : password === user.password;

  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  // If user still has plaintext password, upgrade it
  if (!user.password_hash) {
    const hash = await bcrypt.hash(password, 12);
    db.prepare('UPDATE users SET password_hash=?, password=NULL WHERE id=?').run(hash, user.id);
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  res.json({
    success: true,
    token,
    user: { id: user.id, username: user.username, role: user.role }
  });
});

router.post('/change-password', async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Auth required' });

  let payload;
  try { payload = jwt.verify(header.slice(7), JWT_SECRET); }
  catch { return res.status(401).json({ error: 'Invalid token' }); }

  const { current_password, new_password } = req.body;
  if (!current_password || !new_password || new_password.length < 6)
    return res.status(400).json({ error: 'new_password must be at least 6 characters' });

  const user = db.prepare('SELECT * FROM users WHERE id=?').get(payload.id);
  const valid = user.password_hash
    ? await bcrypt.compare(current_password, user.password_hash)
    : current_password === user.password;

  if (!valid) return res.status(401).json({ error: 'Current password incorrect' });

  const hash = await bcrypt.hash(new_password, 12);
  db.prepare('UPDATE users SET password_hash=?, password=NULL WHERE id=?').run(hash, user.id);
  res.json({ success: true });
});

module.exports = router;
