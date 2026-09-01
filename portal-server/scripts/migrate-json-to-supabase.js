import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import db, { dbMode } from "../db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });
dotenv.config({ path: path.join(__dirname, ".env") });

const jsonPath = process.env.DATABASE_PATH || path.join(__dirname, "..", "data", "portal.json");

const USER_ID_FIELDS = ["user_id", "assigned_to", "created_by"];
const JSONB_FIELDS = new Set(["attachments", "metadata"]);

if (dbMode !== "postgres") {
  console.error("Set DATABASE_URL (Railway Postgres connection string) before running migration.");
  process.exit(1);
}

if (!fs.existsSync(jsonPath)) {
  console.error(`JSON database not found: ${jsonPath}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const tables = ["users", "sessions", "invitations", "clients", "cases", "tasks", "audit_logs"];

function remapUserIds(row, idMap) {
  const out = { ...row };
  for (const field of USER_ID_FIELDS) {
    if (out[field] && idMap[out[field]]) {
      out[field] = idMap[out[field]];
    }
  }
  return out;
}

async function buildUserIdMap(jsonUsers = []) {
  const existing = await db.prepare(`SELECT id, username FROM users`).all();
  const byUsername = new Map(existing.map((user) => [user.username, user.id]));
  const idMap = {};

  for (const user of jsonUsers) {
    const existingId = byUsername.get(user.username);
    if (existingId && existingId !== user.id) {
      idMap[user.id] = existingId;
      console.log(`  users: map ${user.username} ${user.id} → ${existingId}`);
    }
  }

  return idMap;
}

async function insertRows(table, rows, sql, idMap = {}) {
  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const mapped = table === "users" ? row : remapUserIds(row, idMap);
    const values = sql.columns.map((col) => {
      const value = mapped[col] ?? null;
      if (JSONB_FIELDS.has(col) && value !== null && typeof value === "object") {
        return JSON.stringify(value);
      }
      return value;
    });

    try {
      await db.prepare(sql.text).run(...values);
      inserted += 1;
    } catch (error) {
      if (error.code === "23505") {
        skipped += 1;
        continue;
      }
      throw error;
    }
  }

  console.log(`  ${table}: ${inserted} inserted${skipped ? `, ${skipped} skipped (already exist)` : ""}`);
}

const inserts = {
  users: {
    text: `INSERT INTO users (id, username, name, role, status, password_hash, created_at, activated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO NOTHING`,
    columns: ["id", "username", "name", "role", "status", "password_hash", "created_at", "activated_at"],
  },
  sessions: {
    text: `INSERT INTO sessions (id, user_id, expires_at, created_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT (id) DO NOTHING`,
    columns: ["id", "user_id", "expires_at", "created_at"],
  },
  invitations: {
    text: `INSERT INTO invitations (id, user_id, token_hash, expires_at, used_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO NOTHING`,
    columns: ["id", "user_id", "token_hash", "expires_at", "used_at", "created_at"],
  },
  clients: {
    text: `INSERT INTO clients (id, name, phone, created_by, deleted_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO NOTHING`,
    columns: ["id", "name", "phone", "created_by", "deleted_at", "created_at"],
  },
  cases: {
    text: `INSERT INTO cases (id, title, client_id, client_ref, notes, attachments, status, assigned_to, opened_at, finished_at, archived_at, created_by, deleted_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO NOTHING`,
    columns: [
      "id",
      "title",
      "client_id",
      "client_ref",
      "notes",
      "attachments",
      "status",
      "assigned_to",
      "opened_at",
      "finished_at",
      "archived_at",
      "created_by",
      "deleted_at",
      "created_at",
    ],
  },
  tasks: {
    text: `INSERT INTO tasks (id, case_id, title, assigned_to, status, due_at, attachments, created_by, deleted_at, created_at, assigned_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO NOTHING`,
    columns: [
      "id",
      "case_id",
      "title",
      "assigned_to",
      "status",
      "due_at",
      "attachments",
      "created_by",
      "deleted_at",
      "created_at",
      "assigned_at",
    ],
  },
  audit_logs: {
    text: `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, ip, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO NOTHING`,
    columns: ["id", "user_id", "action", "entity_type", "entity_id", "metadata", "ip", "created_at"],
  },
};

console.log(`Migrating ${jsonPath} → PostgreSQL...`);

const userIdMap = await buildUserIdMap(data.users || []);

for (const table of tables) {
  const rows = data[table] || [];
  if (!rows.length) continue;
  const normalized = rows.map((row) => ({
    ...row,
    attachments: row.attachments ?? [],
    assigned_at: table === "tasks" ? row.assigned_at || row.created_at : row.assigned_at,
    metadata:
      row.metadata === undefined || row.metadata === null
        ? null
        : typeof row.metadata === "string"
          ? JSON.parse(row.metadata)
          : row.metadata,
  }));
  await insertRows(table, normalized, inserts[table], userIdMap);
}

console.log("Migration complete.");
await db.close?.();
