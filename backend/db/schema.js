const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../atc.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS centers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    district TEXT NOT NULL,
    incharge_name TEXT NOT NULL,
    incharge_title TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roll_no TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    father_name TEXT,
    mother_name TEXT,
    dob TEXT,
    year TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT 'PAINTING',
    center_id INTEGER REFERENCES centers(id),
    exam_date TEXT,
    exam_venue TEXT,
    exam_time TEXT,
    photo_url TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS marks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER UNIQUE REFERENCES students(id),
    practical_paper1 REAL,
    practical_paper2 REAL,
    practical_fabric REAL,
    ia_composition REAL,
    ia_illustration REAL,
    ia_still_life REAL,
    ia_press_layout REAL,
    ia_landscape REAL,
    ia_book_cover REAL,
    ia_lettering REAL,
    ia_sketch REAL,
    ia_poster_design REAL,
    ia_total REAL,
    oral REAL,
    theory_paper1 REAL,
    theory_paper2 REAL,
    total_marks REAL,
    division TEXT,
    distinction TEXT,
    certificate_no TEXT,
    entered_by TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT,
    password_hash TEXT,
    role TEXT NOT NULL CHECK(role IN ('admin','operator')),
    created_at TEXT DEFAULT (datetime('now'))
  );

  INSERT OR IGNORE INTO centers (id, name, district, incharge_name, incharge_title)
  VALUES (1, 'ANGKURAN CHITRAKALA NIKETAN, PUSHPAKPUR', 'NALBARI', 'SULTANA NAZMIN ALAM', 'Principal');
`);

// Batches table — groups students by time frame at the same center
db.exec(`
  CREATE TABLE IF NOT EXISTS batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_code TEXT UNIQUE NOT NULL,
    center_id INTEGER NOT NULL REFERENCES centers(id),
    session TEXT NOT NULL,
    year TEXT,
    subject TEXT,
    from_date TEXT,
    to_date TEXT,
    exam_time TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Migrations for columns added after initial schema
// Rebuild users table if it still has the old CHECK(role IN ('admin','operator')) constraint
try {
  const tbl = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='users'`).get();
  if (tbl?.sql?.includes("CHECK(role IN ('admin','operator'))")) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users_rebuilt (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT,
        password_hash TEXT,
        role TEXT NOT NULL DEFAULT 'maintainer'
          CHECK(role IN ('super_admin','admin','maintainer')),
        created_at TEXT DEFAULT (datetime('now'))
      );
      INSERT OR IGNORE INTO users_rebuilt
        SELECT id, username, password, password_hash,
          CASE role WHEN 'operator' THEN 'maintainer' ELSE role END,
          created_at FROM users;
      DROP TABLE users;
      ALTER TABLE users_rebuilt RENAME TO users;
    `);
  }
} catch (_) {}

// Upgrade existing roles to new hierarchy
try { db.exec(`UPDATE users SET role='super_admin' WHERE role='admin'`); } catch (_) {}

// L-4: Force-hash any remaining plaintext passwords so we can drop the plaintext fallback
try {
  const plainUsers = db.prepare(
    `SELECT id, password FROM users WHERE password_hash IS NULL AND password IS NOT NULL`
  ).all();
  for (const u of plainUsers) {
    const hash = bcrypt.hashSync(u.password, 12);
    db.prepare(`UPDATE users SET password_hash=?, password=NULL WHERE id=?`).run(hash, u.id);
  }
} catch (_) {}

// First-boot: create superadmin with a random password if no super_admin exists yet
try {
  const hasSuperAdmin = db.prepare(`SELECT id FROM users WHERE role='super_admin' LIMIT 1`).get();
  if (!hasSuperAdmin) {
    const rawPw = crypto.randomBytes(12).toString('hex');
    const hash = bcrypt.hashSync(rawPw, 12);
    db.prepare(`INSERT INTO users (username, password_hash, role) VALUES (?,?,?)`)
      .run('superadmin', hash, 'super_admin');
    console.log('\n================================================================');
    console.log('FIRST BOOT — Super admin account created:');
    console.log(`  username: superadmin`);
    console.log(`  password: ${rawPw}`);
    console.log('Change this password immediately via Settings > Change Password.');
    console.log('================================================================\n');
  }
} catch (_) {}

const migrations = [
  `ALTER TABLE students ADD COLUMN session TEXT`,
  `ALTER TABLE students ADD COLUMN batch_id INTEGER REFERENCES batches(id)`,
  `ALTER TABLE centers  ADD COLUMN code TEXT`,
  `ALTER TABLE centers  ADD COLUMN address TEXT`,
  `ALTER TABLE centers  ADD COLUMN state TEXT DEFAULT 'ASSAM'`,
  `ALTER TABLE centers  ADD COLUMN co_name TEXT`,
  `ALTER TABLE students ADD COLUMN gender TEXT`,
  `ALTER TABLE students ADD COLUMN nationality TEXT DEFAULT 'Indian'`,
  `ALTER TABLE students ADD COLUMN edu_qualification TEXT`,
  `ALTER TABLE marks ADD COLUMN marksheet_date TEXT`,
];
for (const sql of migrations) { try { db.exec(sql); } catch (_) {} }


module.exports = db;
