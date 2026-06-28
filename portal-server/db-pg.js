import pg from "pg";

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL or SUPABASE_DB_URL is required for PostgreSQL mode.");
}

const isLocalDb = /localhost|127\.0\.0\.1/.test(connectionString);

const pool = new pg.Pool({
  connectionString,
  ssl: isLocalDb ? undefined : { rejectUnauthorized: false },
});

function toPgSql(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`).replace(/datetime\('now'\)/gi, "NOW()");
}

function normalizeValue(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    if (value.startsWith("[") || value.startsWith("{")) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
  }
  return value;
}

function normalizeRow(row) {
  if (!row) return row;
  const out = { ...row };
  if (out.count !== undefined) out.count = Number(out.count);
  for (const key of ["attachments", "metadata", "subscription"]) {
    out[key] = normalizeValue(out[key]);
  }
  if (out.attachments === null) out.attachments = [];
  return out;
}

function prepareParams(params) {
  return params.map((value) => {
    if (value !== null && typeof value === "object" && !(value instanceof Date)) {
      return JSON.stringify(value);
    }
    return value;
  });
}

class Statement {
  constructor(sql) {
    this.sql = sql;
  }

  async get(...params) {
    const rows = await this.all(...params);
    return rows[0];
  }

  async all(...params) {
    const result = await pool.query(toPgSql(this.sql), prepareParams(params));
    return result.rows.map(normalizeRow);
  }

  async run(...params) {
    await pool.query(toPgSql(this.sql), prepareParams(params));
    return { changes: 1 };
  }
}

const db = {
  prepare(sql) {
    return new Statement(sql);
  },
  async ping() {
    await pool.query("SELECT 1");
  },
  async transaction(fn) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await fn();
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
  async exec() {},
  async close() {
    await pool.end();
  },
};

export default db;
