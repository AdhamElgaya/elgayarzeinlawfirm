import db from "../db.js";
import { isExpired } from "../lib/crypto-utils.js";

const SESSION_COOKIE = "gz_portal_session";
const SESSION_DAYS = 30;

export { SESSION_COOKIE, SESSION_DAYS };

export async function getUserFromSession(sessionId) {
  if (!sessionId) return null;

  const row = await db
    .prepare(
      `SELECT u.id, u.username, u.name, u.role, u.status
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`
    )
    .get(sessionId);

  if (!row) return null;

  const session = await db.prepare(`SELECT expires_at FROM sessions WHERE id = ?`).get(sessionId);
  if (!session || isExpired(session.expires_at)) {
    await db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sessionId);
    return null;
  }

  if (row.status !== "active") return null;

  return {
    id: row.id,
    username: row.username,
    name: row.name,
    role: row.role,
  };
}

export async function requireAuth(req, res, next) {
  try {
    const user = await getUserFromSession(req.cookies[SESSION_COOKIE]);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required." });
  }
  next();
}

export function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
  };
}
