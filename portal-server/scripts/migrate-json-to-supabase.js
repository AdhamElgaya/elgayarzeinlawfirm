import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });
dotenv.config({ path: path.join(__dirname, ".env") });

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import db, { dbMode } from "../db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsonPath = process.env.DATABASE_PATH || path.join(__dirname, "..", "data", "portal.json");

if (dbMode !== "supabase") {
  console.error("Set DATABASE_URL (Supabase connection string) before running migration.");
  process.exit(1);
}

if (!fs.existsSync(jsonPath)) {
  console.error(`JSON database not found: ${jsonPath}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const tables = ["users", "sessions", "invitations", "clients", "cases", "tasks", "audit_logs"];

async function insertRows(table, rows, sql) {
  for (const row of rows) {
    const values = sql.columns.map((col) => row[col] ?? null);
    await db.prepare(sql.text).run(...values);
  }
  console.log(`  ${table}: ${rows.length} rows`);
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
    text: `INSERT INTO tasks (id, case_id, title, assigned_to, status, due_at, attachments, created_by, deleted_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    ],
  },
  audit_logs: {
    text: `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, ip, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO NOTHING`,
    columns: ["id", "user_id", "action", "entity_type", "entity_id", "metadata", "ip", "created_at"],
  },
};

console.log(`Migrating ${jsonPath} → Supabase...`);

for (const table of tables) {
  const rows = data[table] || [];
  if (!rows.length) continue;
  const normalized = rows.map((row) => ({
    ...row,
    attachments: row.attachments ?? [],
    metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata,
  }));
  await insertRows(table, normalized, inserts[table]);
}

console.log("Migration complete.");
await db.close?.();
