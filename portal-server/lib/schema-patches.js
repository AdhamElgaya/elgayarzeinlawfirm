import db, { dbMode } from "../db.js";

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
