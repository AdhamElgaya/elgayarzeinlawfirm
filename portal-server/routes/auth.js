import { Router } from "express";
import { v4 as uuid } from "uuid";
import db from "../db.js";
import { verifyPassword } from "../lib/password.js";
import { writeAudit } from "../lib/audit.js";
import { sessionExpiry } from "../lib/crypto-utils.js";
import { normalizeUsername } from "../lib/username.js";
import {
  SESSION_COOKIE,
  SESSION_DAYS,
  getUserFromSession,
  publicUser,
  requireAuth,
} from "../middleware/auth.js";

const router = Router();

function sessionCookieOptions() {
  const crossOrigin = Boolean(process.env.ALLOWED_ORIGINS?.trim());
  return {
    httpOnly: true,
    sameSite: crossOrigin ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

function setSessionCookie(res, sessionId) {
  res.cookie(SESSION_COOKIE, sessionId, sessionCookieOptions());
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, { ...sessionCookieOptions(), maxAge: 0 });
}

router.get("/me", async (req, res) => {
  try {
    const user = await getUserFromSession(req.cookies[SESSION_COOKIE]);
    if (!user) {
      return res.status(401).json({ authenticated: false });
    }
    res.json({ authenticated: true, user: publicUser(user) });
  } catch (error) {
    console.error("[portal] auth/me error:", error);
    res.status(500).json({ error: "تعذر التحقق من الجلسة." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const username = normalizeUsername(req.body?.username);
    const password = String(req.body?.password || "");

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }

    const user = await db
      .prepare(`SELECT id, username, name, role, status, password_hash FROM users WHERE username = ?`)
      .get(username);

    if (!user || user.status !== "active") {
      await writeAudit({ action: "login_failed", metadata: { username }, ip: req.ip });
      return res.status(401).json({ error: "Invalid username or password." });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      await writeAudit({ action: "login_failed", metadata: { username }, ip: req.ip });
      return res.status(401).json({ error: "Invalid username or password." });
    }

    const sessionId = uuid();
    const expiresAt = sessionExpiry(SESSION_DAYS);
    await db.prepare(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`).run(
      sessionId,
      user.id,
      expiresAt
    );

    setSessionCookie(res, sessionId);
    await writeAudit({ userId: user.id, action: "login_success", ip: req.ip });

    res.json({
      user: publicUser(user),
    });
  } catch (error) {
    console.error("[portal] login error:", error);
    res.status(500).json({ error: "تعذر تسجيل الدخول. تحقق من إعدادات قاعدة البيانات على الخادم." });
  }
});

router.post("/logout", requireAuth, async (req, res) => {
  const sessionId = req.cookies[SESSION_COOKIE];
  if (sessionId) {
    await db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sessionId);
  }
  clearSessionCookie(res);
  await writeAudit({ userId: req.user.id, action: "logout", ip: req.ip });
  res.json({ ok: true });
});

export default router;
