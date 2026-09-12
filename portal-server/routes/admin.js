import { Router } from "express";
import multer from "multer";
import path from "path";
import { v4 as uuid } from "uuid";
import db from "../db.js";
import { writeAudit } from "../lib/audit.js";
import { hashPassword } from "../lib/password.js";
import { isValidNewUsername, normalizeUsername, USERNAME_RULES_MESSAGE } from "../lib/username.js";
import { enrichTask, softDeleteCase, softDeleteClient, softDeleteTask, deleteUser } from "../lib/entities.js";
import {
  deleteStoredFile,
  ensureUploadDir,
  normalizeAttachment,
  pickCaseAttachments,
  storedFilename,
  storageMode,
  UPLOAD_DIR,
} from "../lib/attachments.js";
import { CLIENT_SELECT_COLUMNS, publicClient } from "../lib/client-docs.js";
import { putFile } from "../lib/storage.js";
import { assertClientDocumentUpload, peekUploadBytes } from "../lib/upload-policy.js";
import { normalizeDueAt } from "../lib/task-due.js";
import { sendTaskAssignedPush } from "../lib/push.js";
import { composeCaseTitle } from "../lib/case-fields.js";
import { requireAuth, requireAdminOrAssistant, requireCanDelete } from "../middleware/auth.js";
import { passwordActionLimiter } from "../lib/rate-limits.js";
import {
  VALID_SECTION_IDS,
  getManagedSection,
  getSection,
  getUserMembership,
  isOfficeStaff,
  moveLawyerToSection,
  subsectionName,
} from "../lib/sections.js";

const router = Router();
ensureUploadDir();

const clientUpload = multer({
  storage:
    storageMode === "r2"
      ? multer.memoryStorage()
      : multer.diskStorage({
          destination: (_req, _file, cb) => {
            ensureUploadDir();
            cb(null, UPLOAD_DIR);
          },
          filename: (_req, file, cb) => {
            const id = uuid();
            file.clientDocId = id;
            const ext = path.extname(file.originalname || "").toLowerCase().slice(0, 20);
            const safeExt = /^\.[a-z0-9.]+$/i.test(ext) ? ext : "";
            cb(null, `${id}${safeExt}`);
          },
        }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    try {
      assertClientDocumentUpload(file.originalname, file.mimetype);
      cb(null, true);
    } catch (error) {
      cb(error);
    }
  },
});

function firstUploadedFile(files, field) {
  const list = files?.[field];
  return Array.isArray(list) && list[0] ? list[0] : null;
}

async function saveClientDocument(file, label) {
  if (!file) return null;
  assertClientDocumentUpload(file.originalname, file.mimetype, peekUploadBytes(file));
  const id = file.clientDocId || uuid();
  const storedKey =
    storageMode === "r2" ? storedFilename(id, file.originalname) : file.filename;
  if (storageMode === "r2") {
    await putFile(storedKey, file.buffer, file.mimetype);
  }
  return normalizeAttachment({
    id,
    label,
    filename: storedKey,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
  });
}

function normalizeOptionalEmail(value) {
  const email = String(value || "").trim();
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    const error = new Error("البريد الإلكتروني غير صالح.");
    error.statusCode = 400;
    throw error;
  }
  return email;
}

router.use(requireAuth);

async function withPlacement(user) {
  if (!user) return user;
  if (user.role === "admin" || user.role === "assistant") {
    return {
      ...user,
      section_id: null,
      section_name: null,
      subsection_id: null,
      subsection_name: null,
    };
  }
  const managed = user.role === "section_manager" ? await getManagedSection(user.id) : null;
  const member = await getUserMembership(user.id);
  const sectionId = managed?.id || member?.section_id || null;
  const subsectionId = user.role === "lawyer" ? member?.subsection_id || null : null;
  const section = sectionId ? await getSection(sectionId) : null;
  return {
    ...user,
    section_id: sectionId,
    section_name: section?.name || null,
    subsection_id: subsectionId,
    subsection_name: user.role === "lawyer" ? subsectionName(sectionId, subsectionId) : null,
  };
}

router.get("/users", requireAdminOrAssistant, async (req, res) => {
  const users = await db
    .prepare(
      `SELECT id, username, name, role, status, created_at, activated_at
       FROM users
       ORDER BY created_at DESC`
    )
    .all();
  const enriched = [];
  for (const user of users || []) {
    enriched.push(await withPlacement(user));
  }
  res.json({ users: enriched });
});

router.post("/users", requireAdminOrAssistant, async (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const name = String(req.body?.name || "").trim();
  const role = String(req.body?.role || "lawyer");
  const password = String(req.body?.password || "");
  const confirmPassword = String(req.body?.confirmPassword || "");

  if (!username || !name || !password) {
    return res.status(400).json({ error: "Username, name, and password are required." });
  }

  if (!isValidNewUsername(username)) {
    return res.status(400).json({ error: USERNAME_RULES_MESSAGE });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل." });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: "كلمتا المرور غير متطابقتين." });
  }

  if (!["lawyer", "assistant", "admin", "section_manager"].includes(role)) {
    return res.status(400).json({ error: "Invalid role." });
  }

  const sectionId = role === "lawyer" ? String(req.body?.section_id || "").trim() : "";
  if (role === "lawyer" && !VALID_SECTION_IDS.includes(sectionId)) {
    return res.status(400).json({ error: "يجب تعيين المحامي إلى أحد الأقسام الأربعة." });
  }

  const existing = await db.prepare(`SELECT id FROM users WHERE username = ?`).get(username);
  if (existing) {
    return res.status(409).json({ error: "A user with this username already exists." });
  }

  const userId = uuid();
  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO users (id, username, name, role, status, password_hash, activated_at)
     VALUES (?, ?, ?, ?, 'active', ?, ?)`
    )
    .run(userId, username, name, role, passwordHash, now);

  if (sectionId) {
    await db.prepare(`INSERT INTO section_members (section_id, user_id) VALUES (?, ?)`).run(sectionId, userId);
  }

  await writeAudit({
    userId: req.user.id,
    action: "user_created",
    entityType: "user",
    entityId: userId,
    metadata: { username, role, section_id: sectionId || null },
    ip: req.ip,
  });

  res.status(201).json({
    user: { id: userId, username, name, role, status: "active" },
    message: "تم إنشاء الحساب. شارك اسم المستخدم وكلمة المرور مع صاحب الحساب بشكل آمن.",
  });
});

router.patch("/users/:id", requireAdminOrAssistant, passwordActionLimiter, async (req, res) => {
  const userId = String(req.params.id || "");
  const name = String(req.body?.name || "").trim();
  const username = normalizeUsername(req.body?.username);

  if (!userId || !name || !username) {
    return res.status(400).json({ error: "Name and username are required." });
  }

  if (!isValidNewUsername(username)) {
    return res.status(400).json({ error: USERNAME_RULES_MESSAGE });
  }

  const user = await db
    .prepare(`SELECT id, username, name, role, status FROM users WHERE id = ?`)
    .get(userId);
  if (!user) {
    return res.status(404).json({ error: "المستخدم غير موجود." });
  }

  const existing = await db.prepare(`SELECT id FROM users WHERE username = ?`).get(username);
  if (existing && existing.id !== userId) {
    return res.status(409).json({ error: "اسم المستخدم مستخدم بالفعل." });
  }

  const password = String(req.body?.password || "");
  const confirmPassword = String(req.body?.confirmPassword || "");
  let passwordReset = false;
  if (password || confirmPassword) {
    if (password.length < 8) {
      return res.status(400).json({ error: "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل." });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: "كلمتا المرور غير متطابقتين." });
    }
    passwordReset = true;
  }

  await db.prepare(`UPDATE users SET name = ?, username = ? WHERE id = ?`).run(name, username, userId);
  if (passwordReset) {
    const passwordHash = await hashPassword(password);
    await db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(passwordHash, userId);
    await db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(userId);
  } else if (user.username !== username) {
    await db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(userId);
  }

  let sectionChanged = false;
  let previousSectionId = null;
  if (user.role === "lawyer") {
    const sectionId = String(req.body?.section_id || "").trim();
    if (!VALID_SECTION_IDS.includes(sectionId)) {
      return res.status(400).json({ error: "يجب تعيين المحامي إلى أحد الأقسام الأربعة." });
    }
    const moved = await moveLawyerToSection(userId, sectionId);
    sectionChanged = moved.changed;
    previousSectionId = moved.previous_section_id;
  }

  await writeAudit({
    userId: req.user.id,
    action: "user_updated",
    entityType: "user",
    entityId: userId,
    metadata: {
      username,
      name,
      username_changed: user.username !== username,
      section_id: user.role === "lawyer" ? String(req.body?.section_id || "").trim() || null : null,
      previous_section_id: previousSectionId,
      section_changed: sectionChanged,
      password_reset: passwordReset,
    },
    ip: req.ip,
  });

  const updated = await db
    .prepare(`SELECT id, username, name, role, status FROM users WHERE id = ?`)
    .get(userId);

  res.json({
    user: await withPlacement(updated),
    message: passwordReset
      ? "تم تحديث الحساب وتعيين كلمة مرور جديدة. يجب تسجيل الدخول بها."
      : sectionChanged
        ? "تم تحديث الحساب ونقل المحامي إلى القسم الجديد."
        : "تم تحديث الحساب.",
  });
});

router.delete("/users/:id", requireCanDelete, async (req, res) => {
  const userId = String(req.params.id || "");
  if (!userId) {
    return res.status(400).json({ error: "معرّف المستخدم مطلوب." });
  }

  if (userId === req.user.id) {
    return res.status(400).json({ error: "لا يمكنك حذف حسابك الحالي." });
  }

  const user = await db.prepare(`SELECT id, username, name, role, status FROM users WHERE id = ?`).get(userId);
  if (!user) {
    return res.status(404).json({ error: "المستخدم غير موجود." });
  }

  if (user.role === "admin" && user.status === "active") {
    const activeAdmins = await db
      .prepare(`SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND status = 'active'`)
      .get();
    if (Number(activeAdmins?.count || 0) <= 1) {
      return res.status(400).json({ error: "لا يمكن حذف آخر حساب مدير نشط." });
    }
  }

  await deleteUser(userId);

  await writeAudit({
    userId: req.user.id,
    action: "user_deleted",
    entityType: "user",
    entityId: userId,
    metadata: { username: user.username, name: user.name, role: user.role },
    ip: req.ip,
  });

  res.json({ message: "تم حذف الحساب." });
});

router.get("/audit", requireAdminOrAssistant, async (req, res) => {
  const logs = await db
    .prepare(
      `SELECT a.id, a.action, a.entity_type, a.entity_id, a.metadata, a.ip, a.created_at,
              u.name AS user_name, u.username AS user_username
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       ORDER BY a.created_at DESC
       LIMIT 100`
    )
    .all();
  res.json({ logs });
});

router.get("/assignees", requireAdminOrAssistant, async (req, res) => {
  const sections = await db.prepare(`SELECT id, name, manager_id FROM sections ORDER BY id`).all();
  const users = [];
  for (const section of sections) {
    if (!section.manager_id) continue;
    const manager = await db
      .prepare(`SELECT id, username, name, role, status FROM users WHERE id = ?`)
      .get(section.manager_id);
    if (manager?.status === "active") {
      users.push({ ...manager, section_id: section.id, section_name: section.name });
    }
  }
  res.json({ users, sections });
});

router.get("/clients", requireAdminOrAssistant, async (req, res) => {
  const clients = (
    await db
      .prepare(
        `SELECT ${CLIENT_SELECT_COLUMNS} FROM clients WHERE deleted_at IS NULL ORDER BY created_at DESC`
      )
      .all()
  ).map((row) => publicClient(row));
  res.json({ clients });
});

router.post(
  "/clients",
  requireAdminOrAssistant,
  (req, res, next) => {
    clientUpload.fields([
      { name: "poa", maxCount: 1 },
      { name: "id_card", maxCount: 1 },
    ])(req, res, (err) => {
      if (err) {
        return res.status(err.statusCode || 400).json({ error: err.message || "تعذر رفع الملف." });
      }
      next();
    });
  },
  async (req, res) => {
    const storedKeys = [];
    const cleanup = async () => {
      for (const key of storedKeys) {
        await deleteStoredFile(key);
      }
    };

    const name = String(req.body?.name || "").trim();
    const phone = String(req.body?.phone || "").trim() || null;
    const address = String(req.body?.address || "").trim() || null;
    const poaFile = firstUploadedFile(req.files, "poa");
    const idFile = firstUploadedFile(req.files, "id_card");
    if (storageMode !== "r2") {
      if (poaFile?.filename) storedKeys.push(poaFile.filename);
      if (idFile?.filename) storedKeys.push(idFile.filename);
    }

    if (!name) {
      await cleanup();
      return res.status(400).json({ error: "اسم الموكل مطلوب." });
    }
    if (!address) {
      await cleanup();
      return res.status(400).json({ error: "العنوان مطلوب." });
    }
    if (!poaFile) {
      await cleanup();
      return res.status(400).json({ error: "صورة التوكيل مطلوبة." });
    }
    if (!idFile) {
      await cleanup();
      return res.status(400).json({ error: "صورة البطاقة مطلوبة." });
    }

    let email;
    try {
      email = normalizeOptionalEmail(req.body?.email);
    } catch (error) {
      await cleanup();
      return res.status(error.statusCode || 400).json({ error: error.message });
    }

    try {
      const poaDocument = await saveClientDocument(poaFile, "صورة التوكيل");
      const idDocument = await saveClientDocument(idFile, "صورة البطاقة");
      if (storageMode === "r2") {
        if (poaDocument?.filename) storedKeys.push(poaDocument.filename);
        if (idDocument?.filename) storedKeys.push(idDocument.filename);
      }

      const clientId = uuid();
      await db
        .prepare(
          `INSERT INTO clients (id, name, phone, email, address, poa_document, id_document, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(clientId, name, phone, email, address, poaDocument, idDocument, req.user.id);

      await writeAudit({
        userId: req.user.id,
        action: "client_created",
        entityType: "client",
        entityId: clientId,
        metadata: { name },
        ip: req.ip,
      });

      res.status(201).json({
        client: publicClient({
          id: clientId,
          name,
          phone,
          email,
          address,
          poa_document: poaDocument,
          id_document: idDocument,
        }),
        message: "تم إضافة الموكل.",
      });
    } catch (error) {
      await cleanup();
      const status = error.statusCode || 500;
      res.status(status).json({
        error: status === 500 ? "تعذر إضافة الموكل." : error.message,
      });
    }
  }
);

router.delete("/clients/:id", requireCanDelete, async (req, res) => {
  const client = await db
    .prepare(`SELECT id, name FROM clients WHERE id = ? AND deleted_at IS NULL`)
    .get(req.params.id);
  if (!client) {
    return res.status(404).json({ error: "الموكل غير موجود." });
  }

  await softDeleteClient(client.id);

  await writeAudit({
    userId: req.user.id,
    action: "client_deleted",
    entityType: "client",
    entityId: client.id,
    metadata: { name: client.name },
    ip: req.ip,
  });

  res.json({ message: "تم حذف الموكل والقضايا المرتبطة." });
});

async function getAssignableUser(userId) {
  const user = await db.prepare(`SELECT id, name, role, status FROM users WHERE id = ?`).get(userId);
  if (!user || user.status !== "active") return null;
  return user;
}

async function getTaskAssignee(userId, actor) {
  const assignee = await getAssignableUser(userId);
  if (assignee) return assignee;
  if (isOfficeStaff(actor) && actor.id === userId) {
    return actor;
  }
  return null;
}

router.post("/cases", requireAdminOrAssistant, async (req, res) => {
  const opponentName = String(req.body?.opponent_name || "").trim();
  const caseNumber = String(req.body?.case_number || "").trim();
  const title = composeCaseTitle(caseNumber, opponentName, req.body?.title);
  const clientId = String(req.body?.client_id || "");
  const notes = String(req.body?.notes || "").trim();
  const rawSectionId = String(req.body?.section_id || "").trim();
  const toInbox = !rawSectionId || rawSectionId === "inbox";
  const sectionId = toInbox ? null : rawSectionId;
  const subsectionId = null;

  if (!clientId) {
    return res.status(400).json({ error: "اسم الموكل مطلوب." });
  }
  if (!opponentName || !caseNumber) {
    return res.status(400).json({ error: "اسم الخصم ورقم القضية مطلوبان." });
  }

  if (!toInbox && !VALID_SECTION_IDS.includes(sectionId)) {
    return res.status(400).json({ error: "يجب اختيار قسماً صالحاً." });
  }

  const client = await db
    .prepare(`SELECT id, name FROM clients WHERE id = ? AND deleted_at IS NULL`)
    .get(clientId);
  if (!client) {
    return res.status(400).json({ error: "الموكل غير موجود." });
  }

  let section = null;
  let assignedTo = null;
  if (!toInbox) {
    section = await getSection(sectionId);
    if (!section?.manager_id) {
      return res.status(400).json({ error: "عيّن مدير هذا القسم أولاً من صفحة الأقسام." });
    }
    assignedTo = section.manager_id;
  }

  const caseId = uuid();
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO cases (id, title, client_id, status, assigned_to, opened_at, created_by, section_id, subsection_id, notes, opponent_name, case_number)
     VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(caseId, title, clientId, assignedTo, now, req.user.id, sectionId, subsectionId, notes, opponentName, caseNumber);

  await writeAudit({
    userId: req.user.id,
    action: "case_created",
    entityType: "case",
    entityId: caseId,
    metadata: {
      title,
      client_id: clientId,
      assigned_to: assignedTo,
      section_id: sectionId,
      subsection_id: subsectionId,
      opponent_name: opponentName,
      case_number: caseNumber,
    },
    ip: req.ip,
  });

  res.status(201).json({
    case: {
      id: caseId,
      title,
      client_id: clientId,
      client_name: client.name,
      opponent_name: opponentName,
      case_number: caseNumber,
      notes,
      status: "active",
      assigned_to: assignedTo,
      section_id: sectionId,
      section_name: section?.name || null,
      subsection_id: subsectionId,
      opened_at: now,
    },
    message: toInbox ? "تم إنشاء القضية في صندوق الوارد." : "تم إنشاء القضية وتعيينها لمدير القسم.",
  });
});

router.delete("/cases/:id", requireCanDelete, async (req, res) => {
  const caseRow = await db
    .prepare(`SELECT id, title FROM cases WHERE id = ? AND deleted_at IS NULL`)
    .get(req.params.id);
  if (!caseRow) {
    return res.status(404).json({ error: "القضية غير موجودة." });
  }

  await softDeleteCase(caseRow.id);

  await writeAudit({
    userId: req.user.id,
    action: "case_deleted",
    entityType: "case",
    entityId: caseRow.id,
    metadata: { title: caseRow.title },
    ip: req.ip,
  });

  res.json({ message: "تم حذف القضية والمهام المرتبطة." });
});

router.post("/tasks", requireAdminOrAssistant, async (req, res) => {
  try {
    const caseId = String(req.body?.case_id || "");
    const title = String(req.body?.title || "").trim();
    let assignedTo = String(req.body?.assigned_to || req.user.id || "");
    const dueAt = normalizeDueAt(req.body?.due_at);

    if (!caseId || !title || !assignedTo) {
      return res.status(400).json({ error: "القضية وعنوان المهمة مطلوبان." });
    }

    const caseRow = await db
      .prepare(`SELECT id, title, status, attachments, section_id FROM cases WHERE id = ? AND deleted_at IS NULL`)
      .get(caseId);
    if (!caseRow || caseRow.status === "archived") {
      return res.status(400).json({ error: "القضية غير موجودة أو مؤرشفة." });
    }

    const assigningSelf = assignedTo === req.user.id && isOfficeStaff(req.user);
    const section = await getSection(caseRow.section_id);
    const assignee = await getTaskAssignee(assignedTo, req.user);
    if (!assignee) {
      return res.status(400).json({ error: assigningSelf ? "تعذر تعيين المهمة لحسابك." : "يجب اختيار مدير القسم." });
    }
    if (!assigningSelf) {
      if (!section?.manager_id) {
        return res.status(400).json({ error: "عيّن مدير قسم هذه القضية أولاً من صفحة الأقسام." });
      }
      if (assignedTo !== section.manager_id) {
        return res.status(400).json({ error: "يجب تعيين المهمة لمدير قسم القضية." });
      }
    }

    const attachments = pickCaseAttachments(caseRow, req.body?.attachments);
    const taskId = uuid();
    const assignedAt = new Date().toISOString();
    await db
      .prepare(
        `INSERT INTO tasks (id, case_id, title, assigned_to, status, due_at, created_by, attachments, assigned_at, section_id)
     VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)`
      )
      .run(taskId, caseId, title, assignedTo, dueAt, req.user.id, attachments, assignedAt, caseRow.section_id);

    await sendTaskAssignedPush(assignedTo, { id: taskId, title, due_at: dueAt });

    await writeAudit({
      userId: req.user.id,
      action: "task_created",
      entityType: "task",
      entityId: taskId,
      metadata: { title, case_id: caseId, assigned_to: assignedTo, attachments_count: attachments.length },
      ip: req.ip,
    });

    res.status(201).json({
      task: await enrichTask({
        id: taskId,
        case_id: caseId,
        title,
        assigned_to: assignedTo,
        status: "open",
        due_at: dueAt,
        attachments,
        assigned_at: assignedAt,
        created_at: assignedAt,
      }),
    message: "تم إنشاء المهمة وتعيينها لمدير القسم.",
    });
  } catch (error) {
    console.error("[portal] admin create task error:", error);
    const status = error.statusCode || 500;
    res.status(status).json({
      error: status === 500 ? "تعذر إنشاء المهمة. حاول مرة أخرى." : error.message,
    });
  }
});

router.patch("/tasks/:id", requireAdminOrAssistant, async (req, res) => {
  const taskRow = await db
    .prepare(
      `SELECT id, case_id, title, assigned_to, status, due_at, assigned_at, attachments, created_at, created_by FROM tasks WHERE id = ? AND deleted_at IS NULL`
    )
    .get(req.params.id);
  if (!taskRow) {
    return res.status(404).json({ error: "المهمة غير موجودة." });
  }

  const title = String(req.body?.title || "").trim();
  const assignedTo = String(req.body?.assigned_to || "");
  const dueAt = normalizeDueAt(req.body?.due_at);

  if (!title || !assignedTo) {
    return res.status(400).json({ error: "عنوان المهمة ومدير القسم مطلوبان." });
  }

  const caseRow = await db
    .prepare(`SELECT id, title, status, attachments, section_id FROM cases WHERE id = ? AND deleted_at IS NULL`)
    .get(taskRow.case_id);
  if (!caseRow || caseRow.status === "archived") {
    return res.status(400).json({ error: "القضية المرتبطة بالمهمة غير موجودة أو مؤرشفة." });
  }

  const section = await getSection(caseRow.section_id);
  const assignee = await getTaskAssignee(assignedTo, req.user);
  if (!assignee) {
    return res.status(400).json({ error: "يجب اختيار مدير القسم." });
  }
  const assigningSelf = assignedTo === req.user.id && isOfficeStaff(req.user);
  if (!assigningSelf && (!section?.manager_id || assignedTo !== section.manager_id)) {
    return res.status(400).json({ error: "يجب تعيين المهمة لمدير قسم القضية." });
  }

  const attachments = pickCaseAttachments(caseRow, req.body?.attachments);
  const reassigned = assignedTo !== taskRow.assigned_to;
  const assignedAt = reassigned ? new Date().toISOString() : taskRow.assigned_at || taskRow.created_at;
  await db
    .prepare(
      `UPDATE tasks SET title = ?, assigned_to = ?, due_at = ?, attachments = ?, reminder_sent_at = NULL, assigned_at = ? WHERE id = ?`
    )
    .run(title, assignedTo, dueAt, attachments, assignedAt, taskRow.id);

  if (reassigned) {
    await sendTaskAssignedPush(assignedTo, { id: taskRow.id, title, due_at: dueAt });
  }

  await writeAudit({
    userId: req.user.id,
    action: "task_updated",
    entityType: "task",
    entityId: taskRow.id,
    metadata: { title, assigned_to: assignedTo, attachments_count: attachments.length },
    ip: req.ip,
  });

  res.json({
    task: await enrichTask({
      ...taskRow,
      title,
      assigned_to: assignedTo,
      due_at: dueAt,
      attachments,
      assigned_at: assignedAt,
    }),
    message: "تم تحديث المهمة.",
  });
});

router.delete("/tasks/:id", requireCanDelete, async (req, res) => {
  const task = await db
    .prepare(`SELECT id, title FROM tasks WHERE id = ? AND deleted_at IS NULL`)
    .get(req.params.id);
  if (!task) {
    return res.status(404).json({ error: "المهمة غير موجودة." });
  }

  await softDeleteTask(task.id);

  await writeAudit({
    userId: req.user.id,
    action: "task_deleted",
    entityType: "task",
    entityId: task.id,
    metadata: { title: task.title },
    ip: req.ip,
  });

  res.json({ message: "تم حذف المهمة." });
});

export default router;
