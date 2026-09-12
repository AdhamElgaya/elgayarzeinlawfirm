import pg from "pg";

function normalizeConnectionString(raw) {
  let value = String(raw || "").trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }
  return value;
}

function assertDatabaseUrl(value) {
  const looksUnresolved =
    !value ||
    value.includes("${{") ||
    /PASSWORD@HOST/i.test(value) ||
    /@HOST:/i.test(value) ||
    value.includes(":PORT/");

  if (looksUnresolved) {
    throw new Error(
      "DATABASE_URL is not a real Postgres URL. In Railway, open the API service → Variables, delete DATABASE_URL, then Add Variable → insert a reference to Postgres DATABASE_URL (or paste DATABASE_URL from the Postgres service). Do not use the .env.example placeholder."
    );
  }

  try {
    // pg accepts postgres:// and postgresql://
    new URL(value.replace(/^postgresql:/i, "http:").replace(/^postgres:/i, "http:"));
  } catch {
    throw new Error(
      "DATABASE_URL is invalid. Copy postgres://... from the Postgres service Variables tab, with no quotes."
    );
  }
}

function pickDatabaseUrl() {
  const primary = String(process.env.DATABASE_URL || "").trim();
  const publicUrl = String(process.env.DATABASE_PUBLIC_URL || process.env.SUPABASE_DB_URL || "").trim();
  const onRailway = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);
  if (primary && !(/\.railway\.internal/i.test(primary) && !onRailway)) {
    return primary;
  }
  return publicUrl || primary;
}

const connectionString = normalizeConnectionString(pickDatabaseUrl());
if (!connectionString) {
  throw new Error("DATABASE_URL, DATABASE_PUBLIC_URL, or SUPABASE_DB_URL is required for PostgreSQL mode.");
}
assertDatabaseUrl(connectionString);

function pgSslConfig(url) {
  const value = String(url || "").toLowerCase();
  if (/localhost|127\.0\.0\.1/.test(value)) return undefined;
  if (value.includes(".railway.internal")) return undefined;
  if (value.includes("sslmode=disable")) return undefined;
  return { rejectUnauthorized: false };
}

const pool = new pg.Pool({
  connectionString,
  ssl: pgSslConfig(connectionString),
});

function databaseHostLabel(url) {
  try {
    return new URL(url.replace(/^postgresql:/i, "http:").replace(/^postgres:/i, "http:")).host;
  } catch {
    return "unknown-host";
  }
}

export const postgresHost = databaseHostLabel(connectionString);
console.log(`[portal] Using Postgres at ${postgresHost}`);

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
  for (const key of ["attachments", "metadata", "subscription", "section_ids", "poa_document", "id_document"]) {
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
