import { v4 as uuid } from "uuid";
import db from "../db.js";

export async function writeAudit({ userId, action, entityType, entityId, metadata, ip }) {
  try {
    await db
      .prepare(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, ip)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        uuid(),
        userId || null,
        action,
        entityType || null,
        entityId || null,
        metadata || null,
        ip || null
      );
  } catch (error) {
    console.error("[portal] audit log failed:", error.message);
  }
}
