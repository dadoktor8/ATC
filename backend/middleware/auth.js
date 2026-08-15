const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'atc_dev_secret';

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

const ADMIN_ROLES = new Set(['admin', 'super_admin']);

function adminOnly(req, res, next) {
  if (!ADMIN_ROLES.has(req.user?.role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

function superAdminOnly(req, res, next) {
  if (req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super-admin access required' });
  }
  next();
}

module.exports = { authMiddleware, adminOnly, superAdminOnly, ADMIN_ROLES };
