-- Run in Supabase SQL Editor if tasks table already exists without assigned_at.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
UPDATE tasks SET assigned_at = created_at WHERE assigned_at IS NULL;
ALTER TABLE tasks ALTER COLUMN assigned_at SET DEFAULT NOW();
ALTER TABLE tasks ALTER COLUMN assigned_at SET NOT NULL;
