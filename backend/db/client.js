const { Pool } = require('pg');

// Render (and most managed Postgres hosts) require SSL for external connections;
// local Postgres on localhost does not use it.
const isLocalDb = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocalDb ? false : { rejectUnauthorized: false },
});

const db = {
  async get(sql, params = []) {
    const { rows } = await pool.query(sql, params);
    return rows[0] || null;
  },
  async all(sql, params = []) {
    const { rows } = await pool.query(sql, params);
    return rows;
  },
  // For INSERT/UPDATE/DELETE. Add RETURNING id automatically for plain INSERTs.
  async run(sql, params = []) {
    const s = /^\s*INSERT/i.test(sql) && !/RETURNING/i.test(sql)
      ? sql + ' RETURNING id'
      : sql;
    const { rows, rowCount } = await pool.query(s, params);
    return { changes: rowCount, id: rows[0]?.id };
  },
  async exec(sql) {
    await pool.query(sql);
  },
  async transaction(callback) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const txDb = {
        async get(sql, params = []) {
          const { rows } = await client.query(sql, params);
          return rows[0] || null;
        },
        async all(sql, params = []) {
          const { rows } = await client.query(sql, params);
          return rows;
        },
        async run(sql, params = []) {
          const s = /^\s*INSERT/i.test(sql) && !/RETURNING/i.test(sql)
            ? sql + ' RETURNING id'
            : sql;
          const { rows, rowCount } = await client.query(s, params);
          return { changes: rowCount, id: rows[0]?.id };
        },
      };
      const result = await callback(txDb);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },
};

module.exports = db;
