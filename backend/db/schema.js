const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../atc.db');
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

  INSERT OR IGNORE INTO users (username, password, role)
  VALUES ('admin', 'admin123', 'admin'),
         ('operator', 'op123', 'operator');

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
];
for (const sql of migrations) { try { db.exec(sql); } catch (_) {} }


module.exports = db;
