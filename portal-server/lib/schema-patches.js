import db, { dbMode } from "../db.js";

const PUSH_SUBSCRIPTIONS_SQL = `
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
`;

export async function applySchemaPatches() {
  if (dbMode !== "supabase") return;

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
      sql: PUSH_SUBSCRIPTIONS_SQL,
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
