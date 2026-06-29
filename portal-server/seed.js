import { v4 as uuid } from "uuid";
import db, { dbMode } from "./db.js";
import { hashPassword } from "./lib/password.js";
import { writeAudit } from "./lib/audit.js";
import { normalizeUsername } from "./lib/username.js";
import { isProductionEnv } from "./lib/env.js";

const DEV_DEFAULT_PASSWORD = "ChangeMe123!";

export async function seedAdmin() {
  const count = await db.prepare(`SELECT COUNT(*) AS count FROM users`).get();
  if (Number(count?.count || 0) > 0) return;

  const username = normalizeUsername(process.env.ADMIN_USERNAME || "محمود الجيار");
  const name = process.env.ADMIN_NAME || username;
  const configuredPassword = String(process.env.ADMIN_PASSWORD || "").trim();

  if (isProductionEnv() && !configuredPassword) {
    throw new Error(
      "[portal] ADMIN_PASSWORD must be set in production before the first admin account is created."
    );
  }

  const password = configuredPassword || DEV_DEFAULT_PASSWORD;
  if (!configuredPassword) {
    console.warn(
      `[portal] Dev-only default admin password (${DEV_DEFAULT_PASSWORD}). Set ADMIN_PASSWORD before deploying.`
    );
  }

  const id = uuid();
  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO users (id, username, name, role, status, password_hash, activated_at)
     VALUES (?, ?, ?, 'admin', 'active', ?, ?)`
    )
    .run(id, username, name, passwordHash, now);

  await writeAudit({ userId: id, action: "admin_seeded", entityType: "user", entityId: id });

  console.log(`[portal] Seeded admin user: ${username} (${dbMode})`);
}
