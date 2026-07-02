import { Router } from "express";
import rateLimit from "express-rate-limit";
import { v4 as uuid } from "uuid";
import db from "../db.js";
import { verifyPassword, hashPassword } from "../lib/password.js";
import { writeAudit } from "../lib/audit.js";
import { sessionExpiry } from "../lib/crypto-utils.js";
import { normalizeUsername } from "../lib/username.js";
import {
  SESSION_COOKIE,
  SESSION_DAYS,
  SESSION_REMEMBER_DAYS,
  getUserFromSession,
  publicUser,
  requireAuth,
  setSessionCookie,
  clearSessionCookie,
} from "../middleware/auth.js";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: "محاولات كثيرة. حاول مرة أخرى لاحقاً." });
  },
});

router.get("/me", async (req, res) => {
  try {
    const sessionId = req.cookies[SESSION_COOKIE];
    const user = await getUserFromSession(sessionId, { refresh: true, res });
    if (!user) {
      return res.status(401).json({ authenticated: false });
    }
    res.json({ authenticated: true, user: publicUser(user) });
  } catch (error) {
    console.error("[portal] auth/me error:", error);
    res.status(500).json({ error: "تعذر التحقق من الجلسة." });
  }
});

router.post("/login", loginLimiter, async (req, res) => {
  try {
    const username = normalizeUsername(req.body?.username);
    const password = String(req.body?.password || "");
    const rememberMe = Boolean(req.body?.remember_me);

    if (!username || !password) {
      return res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان." });
    }

    const user = await db
      .prepare(`SELECT id, username, name, role, status, password_hash FROM users WHERE username = ?`)
      .get(username);

    if (!user || user.status !== "active") {
      await writeAudit({ action: "login_failed", metadata: { username }, ip: req.ip });
      return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة." });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      await writeAudit({ action: "login_failed", metadata: { username }, ip: req.ip });
      return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة." });
    }

    const sessionDays = rememberMe ? SESSION_REMEMBER_DAYS : SESSION_DAYS;
    const sessionId = uuid();
    const expiresAt = sessionExpiry(sessionDays);
    await db.prepare(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`).run(
      sessionId,
      user.id,
      expiresAt
    );

    setSessionCookie(res, sessionId, sessionDays);
    await writeAudit({
      userId: user.id,
      action: "login_success",
      metadata: { remember_me: rememberMe },
      ip: req.ip,
    });

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

router.post("/change-password", requireAuth, async (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = String(req.body?.newPassword || "");
    const confirmPassword = String(req.body?.confirmPassword || "");

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: "جميع الحقول مطلوبة." });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل." });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: "كلمتا المرور غير متطابقتين." });
    }

    const user = await db
      .prepare(`SELECT id, username, password_hash FROM users WHERE id = ?`)
      .get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: "المستخدم غير موجود." });
    }

    const validCurrentPassword = await verifyPassword(currentPassword, user.password_hash);
    if (!validCurrentPassword) {
      return res.status(401).json({ error: "كلمة المرور الحالية غير صحيحة." });
    }

    const newPasswordHash = await hashPassword(newPassword);
    await db
      .prepare(`UPDATE users SET password_hash = ? WHERE id = ?`)
      .run(newPasswordHash, user.id);

    await db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(user.id);

    await writeAudit({
      userId: req.user.id,
      action: "password_changed",
      entityType: "user",
      entityId: user.id,
      metadata: { self_change: true },
      ip: req.ip,
    });

    clearSessionCookie(res);
    res.json({ message: "تم تغيير كلمة المرور بنجاح. يرجى تسجيل الدخول مرة أخرى." });
  } catch (error) {
    console.error("[portal] change password error:", error);
    res.status(500).json({ error: "تعذر تغيير كلمة المرور." });
  }
});

export default router;
