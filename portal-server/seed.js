import { v4 as uuid } from "uuid";
import db, { dbMode } from "./db.js";
import { hashPassword } from "./lib/password.js";
import { writeAudit } from "./lib/audit.js";
import { normalizeUsername } from "./lib/username.js";

export async function seedAdmin() {
  const count = await db.prepare(`SELECT COUNT(*) AS count FROM users`).get();
  if (Number(count?.count || 0) > 0) return;

  const username = normalizeUsername(process.env.ADMIN_USERNAME || "محمود الجيار");
  const password = process.env.ADMIN_PASSWORD || "ChangeMe123!";
  const name = process.env.ADMIN_NAME || username;

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
  if (!process.env.ADMIN_PASSWORD) {
    console.log("[portal] Default password: ChangeMe123! — set ADMIN_PASSWORD in production.");
  }
}
