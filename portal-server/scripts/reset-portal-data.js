import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import db, { dbMode } from "../db.js";
import { resetPortalData } from "../lib/entities.js";
import { normalizeUsername } from "../lib/username.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });
dotenv.config({ path: path.join(__dirname, ".env") });

const adminUsername = normalizeUsername(process.env.ADMIN_USERNAME || "محمود الجيار");

let admin = await db
  .prepare(`SELECT id, username, name, role, status FROM users WHERE username = ?`)
  .get(adminUsername);

if (!admin) {
  admin = await db
    .prepare(`SELECT id, username, name, role, status FROM users WHERE role = 'admin' AND status = 'active'`)
    .get();
}

if (!admin) {
  console.error("No admin account found to preserve. Aborting.");
  process.exit(1);
}

console.log(`Resetting portal data (${dbMode})...`);
console.log(`Keeping admin: ${admin.name} (${admin.username})`);

await resetPortalData(admin.id);

const remainingUsers = await db.prepare(`SELECT id, username, name, role FROM users`).all();
console.log(`Users remaining: ${remainingUsers.length}`);
for (const user of remainingUsers) {
  console.log(`  - ${user.name} (${user.username}) · ${user.role}`);
}

console.log("Reset complete.");
await db.close?.();
