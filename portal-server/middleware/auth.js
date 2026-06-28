import db from "../db.js";
import { isExpired, sessionExpiry } from "../lib/crypto-utils.js";

const SESSION_COOKIE = "gz_portal_session";
const SESSION_DAYS = Number(process.env.SESSION_DAYS || 30);
const SESSION_REMEMBER_DAYS = Number(process.env.SESSION_REMEMBER_DAYS || 365);

export { SESSION_COOKIE, SESSION_DAYS, SESSION_REMEMBER_DAYS };

export function sessionCookieOptions(maxAgeDays = SESSION_DAYS) {
  const crossOrigin = process.env.CROSS_ORIGIN_COOKIES === "true";
  return {
    httpOnly: true,
    sameSite: crossOrigin ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: maxAgeDays * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

export function setSessionCookie(res, sessionId, maxAgeDays = SESSION_DAYS) {
  res.cookie(SESSION_COOKIE, sessionId, sessionCookieOptions(maxAgeDays));
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, { ...sessionCookieOptions(SESSION_DAYS), maxAge: 0 });
}

function sessionDurationDays(expiresAtIso) {
  const remainingMs = new Date(expiresAtIso).getTime() - Date.now();
  return remainingMs > 90 * 24 * 60 * 60 * 1000 ? SESSION_REMEMBER_DAYS : SESSION_DAYS;
}

export async function refreshSession(sessionId, res = null) {
  if (!sessionId) return false;

  const session = await db.prepare(`SELECT expires_at FROM sessions WHERE id = ?`).get(sessionId);
  if (!session || isExpired(session.expires_at)) {
    if (session) await db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sessionId);
    return false;
  }

  const days = sessionDurationDays(session.expires_at);
  const newExpiry = sessionExpiry(days);
  await db.prepare(`UPDATE sessions SET expires_at = ? WHERE id = ?`).run(newExpiry, sessionId);

  if (res) {
    setSessionCookie(res, sessionId, days);
  }

  return true;
}

export async function getUserFromSession(sessionId, options = {}) {
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

  if (options.refresh) {
    await refreshSession(sessionId, options.res || null);
  }

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
