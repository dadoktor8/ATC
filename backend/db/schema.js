const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./client');

const FIRST_BOOT_CRED_FILE = path.join(__dirname, '..', '.superadmin-credentials.txt');

async function init() {
  // Create tables in dependency order (centers → batches → students → marks, users)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS centers (
      id        SERIAL PRIMARY KEY,
      name      TEXT NOT NULL,
      district  TEXT NOT NULL DEFAULT '',
      incharge_name  TEXT NOT NULL DEFAULT '',
      incharge_title TEXT,
      code      TEXT,
      address   TEXT,
      state     TEXT DEFAULT 'ASSAM',
      co_name   TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS batches (
      id         SERIAL PRIMARY KEY,
      batch_code TEXT UNIQUE NOT NULL,
      center_id  INTEGER NOT NULL REFERENCES centers(id),
      session    TEXT NOT NULL,
      year       TEXT,
      subject    TEXT,
      from_date  TEXT,
      to_date    TEXT,
      exam_time  TEXT,
      status     TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS students (
      id               SERIAL PRIMARY KEY,
      roll_no          TEXT UNIQUE NOT NULL,
      name             TEXT NOT NULL,
      father_name      TEXT,
      mother_name      TEXT,
      dob              TEXT,
      year             TEXT NOT NULL,
      subject          TEXT NOT NULL DEFAULT 'PAINTING',
      center_id        INTEGER REFERENCES centers(id),
      exam_date        TEXT,
      exam_venue       TEXT,
      exam_time        TEXT,
      photo_url        TEXT,
      session          TEXT,
      batch_id         INTEGER REFERENCES batches(id),
      gender           TEXT,
      nationality      TEXT DEFAULT 'Indian',
      edu_qualification TEXT,
      created_at       TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS marks (
      id               SERIAL PRIMARY KEY,
      student_id       INTEGER UNIQUE REFERENCES students(id),
      practical_paper1 REAL,
      practical_paper2 REAL,
      practical_fabric REAL,
      ia_composition   REAL,
      ia_illustration  REAL,
      ia_still_life    REAL,
      ia_press_layout  REAL,
      ia_landscape     REAL,
      ia_book_cover    REAL,
      ia_lettering     REAL,
      ia_sketch        REAL,
      ia_poster_design REAL,
      ia_total         REAL,
      oral             REAL,
      theory_paper1    REAL,
      theory_paper2    REAL,
      total_marks      REAL,
      division         TEXT,
      distinction      TEXT,
      certificate_no   TEXT,
      entered_by       TEXT,
      marksheet_date   TEXT,
      updated_at       TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      username      TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      role          TEXT NOT NULL DEFAULT 'maintainer'
                      CHECK(role IN ('super_admin','admin','maintainer')),
      created_at    TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // First-boot: create superadmin with a random password if no super_admin exists
  const hasSuperAdmin = await db.get(`SELECT id FROM users WHERE role='super_admin' LIMIT 1`);
  if (!hasSuperAdmin) {
    const rawPw = crypto.randomBytes(12).toString('hex');
    const hash = bcrypt.hashSync(rawPw, 12);
    await db.run(
      `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)`,
      ['superadmin', hash, 'super_admin']
    );

    // Written to a local, gitignored file rather than stdout — console/platform
    // logs are often retained or shipped elsewhere, which would otherwise leak
    // the initial super-admin credential indefinitely.
    const fileBody =
      `Super admin account created on first boot.\n` +
      `username: superadmin\n` +
      `password: ${rawPw}\n\n` +
      `Log in, change this password via Settings > Change Password, then delete this file.\n`;
    fs.writeFileSync(FIRST_BOOT_CRED_FILE, fileBody, { mode: 0o600 });

    console.log('\n================================================================');
    console.log('FIRST BOOT — Super admin account created.');
    console.log(`Credentials written to: ${FIRST_BOOT_CRED_FILE}`);
    console.log('Log in, change the password, then delete that file.');
    console.log('================================================================\n');
  }
}

module.exports = init;
