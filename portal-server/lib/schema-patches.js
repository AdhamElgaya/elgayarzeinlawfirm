import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import db, { dbMode } from "../db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(__dirname, "..", "schema.supabase.sql");

function sqlStatements(sql) {
  return sql
    .replace(/--[^\n]*/g, "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
}

async function ensureLegacyColumns() {
  const statements = [
    `ALTER TABLE cases ADD COLUMN IF NOT EXISTS section_id TEXT`,
    `ALTER TABLE cases ADD COLUMN IF NOT EXISTS subsection_id TEXT`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS section_id TEXT`,
  ];
  for (const statement of statements) {
    try {
      await db.prepare(statement).run();
    } catch {
      /* table may not exist yet */
    }
  }
}

async function ensureBaseSchema() {
  await ensureLegacyColumns();
  const sql = fs.readFileSync(SCHEMA_PATH, "utf8");
  for (const statement of sqlStatements(sql)) {
    await db.prepare(statement).run();
  }
}

export async function applySchemaPatches() {
  if (dbMode !== "postgres") return;

  try {
    await db.ping();
    await ensureBaseSchema();
    console.log("[portal] postgres schema ready");
  } catch (error) {
    const hint =
      /railway\.internal|ENOTFOUND|ECONNREFUSED/i.test(error.message || "")
        ? " Locally use DATABASE_PUBLIC_URL from Railway → Postgres → Variables (not the .railway.internal URL)."
        : "";
    console.error(`[portal] postgres schema init failed: ${error.message}.${hint}`);
    throw error;
  }

  const patches = [
    {
      name: "tasks.assigned_at",
      sql: `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ`,
    },
    {
      name: "tasks.assigned_at_backfill",
      sql: `UPDATE tasks SET assigned_at = created_at WHERE assigned_at IS NULL`,
    },
    {
      name: "tasks.status_default",
      sql: `ALTER TABLE tasks ALTER COLUMN status SET DEFAULT 'open'`,
    },
    {
      name: "tasks.reminder_sent_at",
      sql: `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ`,
    },
    {
      name: "push_subscriptions",
      sql: `CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`,
    },
    {
      name: "push_subscriptions_user_idx",
      sql: `CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id)`,
    },
    {
      name: "users.role_section_manager",
      sql: `ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`,
    },
    {
      name: "users.role_section_manager_add",
      sql: `ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'lawyer', 'assistant', 'section_manager'))`,
    },
    {
      name: "sections",
      sql: `CREATE TABLE IF NOT EXISTS sections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  manager_id TEXT REFERENCES users(id) ON DELETE SET NULL
)`,
    },
    {
      name: "section_members",
      sql: `CREATE TABLE IF NOT EXISTS section_members (
  section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (section_id, user_id),
  UNIQUE (user_id)
)`,
    },
    {
      name: "cases.section_id",
      sql: `ALTER TABLE cases ADD COLUMN IF NOT EXISTS section_id TEXT`,
    },
    {
      name: "tasks.section_id",
      sql: `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS section_id TEXT`,
    },
    {
      name: "idx_cases_section",
      sql: `CREATE INDEX IF NOT EXISTS idx_cases_section ON cases(section_id)`,
    },
    {
      name: "idx_tasks_section",
      sql: `CREATE INDEX IF NOT EXISTS idx_tasks_section ON tasks(section_id)`,
    },
    {
      name: "cases.subsection_id",
      sql: `ALTER TABLE cases ADD COLUMN IF NOT EXISTS subsection_id TEXT`,
    },
    {
      name: "library_attachments",
      sql: `CREATE TABLE IF NOT EXISTS library_attachments (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  filename TEXT NOT NULL,
  original_name TEXT,
  mime_type TEXT,
  size INTEGER,
  section_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`,
    },
    {
      name: "subsection_leads",
      sql: `CREATE TABLE IF NOT EXISTS subsection_leads (
  section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  subsection_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (section_id, subsection_id)
)`,
    },
    {
      name: "section_members.subsection_id",
      sql: `ALTER TABLE section_members ADD COLUMN IF NOT EXISTS subsection_id TEXT`,
    },
    {
      name: "tasks.incomplete_reason",
      sql: `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS incomplete_reason TEXT`,
    },
    {
      name: "tasks.status_missed_drop",
      sql: `ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check`,
    },
    {
      name: "tasks.status_missed_add",
      sql: `ALTER TABLE tasks ADD CONSTRAINT tasks_status_check CHECK (status IN ('open', 'done', 'missed'))`,
    },
    {
      name: "cases.opponent_name",
      sql: `ALTER TABLE cases ADD COLUMN IF NOT EXISTS opponent_name TEXT`,
    },
    {
      name: "cases.case_number",
      sql: `ALTER TABLE cases ADD COLUMN IF NOT EXISTS case_number TEXT`,
    },
    {
      name: "clients.email",
      sql: `ALTER TABLE clients ADD COLUMN IF NOT EXISTS email TEXT`,
    },
    {
      name: "clients.address",
      sql: `ALTER TABLE clients ADD COLUMN IF NOT EXISTS address TEXT`,
    },
    {
      name: "clients.poa_document",
      sql: `ALTER TABLE clients ADD COLUMN IF NOT EXISTS poa_document JSONB`,
    },
    {
      name: "clients.id_document",
      sql: `ALTER TABLE clients ADD COLUMN IF NOT EXISTS id_document JSONB`,
    },
  ];

  for (const patch of patches) {
    try {
      await db.prepare(patch.sql).run();
      console.log(`[portal] schema patch applied: ${patch.name}`);
    } catch (error) {
      console.error(`[portal] schema patch failed (${patch.name}):`, error.message);
    }
  }
}
