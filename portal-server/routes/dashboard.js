import { Router } from "express";
import multer from "multer";
import path from "path";
import { v4 as uuid } from "uuid";
import db from "../db.js";
import { writeAudit } from "../lib/audit.js";
import {
  canEditCase,
  deleteOrphanedFiles,
  deleteStoredFile,
  attachmentDownloadName,
  attachmentMimeType,
  attachmentContentDisposition,
  attachmentInlineContentDisposition,
  mergeAttachment,
  pickCaseAttachments,
  ensureUploadDir,
  isValidAttachment,
  normalizeAttachment,
  storedFilename,
  storageMode,
  UPLOAD_DIR,
} from "../lib/attachments.js";
import { openFile, putFile, signedGetUrl, signedPutUrl, fileExists } from "../lib/storage.js";
import { assertAllowedUpload } from "../lib/upload-policy.js";
import {
  archiveCase,
  displayId,
  enrichCase,
  enrichTask,
  getAttachmentIfAccessible,
  getCaseIfAccessible,
  getTaskIfAccessible,
  latestTaskForCase,
  softDeleteTask,
} from "../lib/entities.js";
import { requireAuth } from "../middleware/auth.js";
import { normalizeDueAt } from "../lib/task-due.js";
import {
  getVapidPublicKey,
  isPushConfigured,
  removePushSubscription,
  savePushSubscription,
} from "../lib/push.js";

const router = Router();

ensureUploadDir();

const upload = multer({
  storage:
    storageMode === "r2"
      ? multer.memoryStorage()
      : multer.diskStorage({
          destination: (_req, _file, cb) => {
            ensureUploadDir();
            cb(null, UPLOAD_DIR);
          },
          filename: (req, file, cb) => {
            const ext = path.extname(file.originalname || "").toLowerCase().slice(0, 20);
            const safeExt = /^\.[a-z0-9.]+$/i.test(ext) ? ext : "";
            cb(null, `${req.attachmentId}${safeExt}`);
          },
        }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    try {
      assertAllowedUpload(file.originalname, file.mimetype);
      cb(null, true);
    } catch (error) {
      cb(error);
    }
  },
});

router.use(requireAuth);

async function getAssignableUser(userId) {
  const user = await db.prepare(`SELECT id, name, role, status FROM users WHERE id = ?`).get(userId);
  if (!user || user.status !== "active" || !["lawyer", "assistant"].includes(user.role)) {
    return null;
  }
  return user;
}

async function getTaskAssignee(userId, actor) {
  const assignee = await getAssignableUser(userId);
  if (assignee) return assignee;
  if (actor?.role === "admin" && actor.id === userId && actor.status === "active") {
    return actor;
  }
  return null;
}

router.get("/summary", async (req, res) => {
  const isAdmin = req.user.role === "admin";

  const caseRows = await db
    .prepare(
      `SELECT id, title, client_id, client_ref, notes, attachments, status, opened_at, finished_at, archived_at, assigned_to
       FROM cases
       WHERE deleted_at IS NULL
         AND status != 'archived'
         AND (assigned_to = ? OR ? = 1)
       ORDER BY opened_at DESC`
    )
    .all(req.user.id, isAdmin ? 1 : 0);
  const myCases = await Promise.all(caseRows.map((row) => enrichCase(row)));

  const taskRows = await db
    .prepare(
      `SELECT t.id, t.title, t.status, t.due_at, t.case_id, t.assigned_to, t.assigned_at, t.created_at, c.title AS case_title
       FROM tasks t
       JOIN cases c ON c.id = t.case_id
       WHERE t.deleted_at IS NULL
         AND c.deleted_at IS NULL
         AND c.status != 'archived'
         AND (t.assigned_to = ? OR ? = 1)
       ORDER BY t.created_at DESC`
    )
    .all(req.user.id, isAdmin ? 1 : 0);
  const myTasks = await Promise.all(taskRows.map((row) => enrichTask(row)));

  const archivedCount = await db
    .prepare(
      `SELECT COUNT(*) AS count FROM cases
       WHERE status = 'archived' AND deleted_at IS NULL AND (assigned_to = ? OR ? = 1)`
    )
    .get(req.user.id, isAdmin ? 1 : 0);

  const clients = isAdmin
    ? await db
        .prepare(`SELECT id, name, phone, created_at FROM clients WHERE deleted_at IS NULL ORDER BY created_at DESC`)
        .all()
    : [];

  res.json({
    user: req.user,
    stats: {
      activeCases: myCases.filter((c) => c.status === "active").length,
      finishedCases: myCases.filter((c) => c.status === "finished").length,
      openTasks: myTasks.filter((t) => t.status === "open").length,
      archivedCases: archivedCount?.count || 0,
    },
    clients: clients.map((c) => ({ ...c, display_id: displayId(c.id) })),
    cases: myCases,
    tasks: myTasks,
  });
});

router.get("/archived", async (req, res) => {
  const isAdmin = req.user.role === "admin";

  const rows = await db
    .prepare(
      `SELECT id, title, client_id, client_ref, notes, attachments, status, opened_at, finished_at, archived_at, assigned_to
       FROM cases
       WHERE deleted_at IS NULL
         AND status = 'archived'
         AND (assigned_to = ? OR ? = 1)
       ORDER BY archived_at DESC`
    )
    .all(req.user.id, isAdmin ? 1 : 0);
  const archivedCases = await Promise.all(rows.map((row) => enrichCase(row)));

  res.json({ cases: archivedCases });
});

router.get("/clients/:id", async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "غير مصرح." });
  }

  const client = await db
    .prepare(`SELECT id, name, phone, created_at FROM clients WHERE id = ? AND deleted_at IS NULL`)
    .get(req.params.id);
  if (!client) {
    return res.status(404).json({ error: "الموكل غير موجود." });
  }

  const cases = (
    await db
      .prepare(
        `SELECT id, title, status, opened_at FROM cases WHERE client_id = ? AND deleted_at IS NULL ORDER BY opened_at DESC`
      )
      .all(client.id)
  ).map((c) => ({ ...c, display_id: displayId(c.id) }));

  res.json({
    client: { ...client, display_id: displayId(client.id) },
    cases,
  });
});

router.get("/cases/:id", async (req, res) => {
  const row = await getCaseIfAccessible(req.user, req.params.id);
  if (!row) {
    return res.status(404).json({ error: "القضية غير موجودة أو غير متاحة." });
  }

  const enriched = await enrichCase(row);
  const latestTask = await latestTaskForCase(row.id);

  res.json({
    case: {
      ...enriched,
      client: enriched.client_id
        ? {
            id: enriched.client_id,
            name: enriched.client_name,
            phone: enriched.client_phone,
          }
        : null,
      lawyer: enriched.assigned_to
        ? {
            id: enriched.assigned_to,
            name: enriched.lawyer_name,
            role: enriched.lawyer_role,
          }
        : null,
      latest_task: latestTask
        ? {
            ...latestTask,
            display_id: displayId(latestTask.id),
          }
        : null,
    },
  });
});

router.patch("/cases/:id", async (req, res) => {
  const row = await getCaseIfAccessible(req.user, req.params.id);
  if (!row) {
    return res.status(404).json({ error: "القضية غير موجودة أو غير متاحة." });
  }

  if (!canEditCase(req.user, row)) {
    return res.status(403).json({ error: "غير مصرح بتعديل هذه القضية." });
  }

  const isAdmin = req.user.role === "admin";
  const canEditMeta = isAdmin && row.status !== "archived";

  let title = row.title;
  let clientId = row.client_id;
  let assignedTo = row.assigned_to;
  let status = row.status;
  let finishedAt = row.finished_at || null;

  if (canEditMeta) {
    if (req.body?.title !== undefined) {
      title = String(req.body.title || "").trim();
      if (!title) {
        return res.status(400).json({ error: "عنوان القضية مطلوب." });
      }
    }

    if (req.body?.client_id !== undefined) {
      clientId = String(req.body.client_id || "");
      const client = await db
        .prepare(`SELECT id FROM clients WHERE id = ? AND deleted_at IS NULL`)
        .get(clientId);
      if (!client) {
        return res.status(400).json({ error: "الموكل غير موجود." });
      }
    }

    if (req.body?.assigned_to !== undefined) {
      assignedTo = String(req.body.assigned_to || "");
      if (!(await getAssignableUser(assignedTo))) {
        return res.status(400).json({ error: "يجب اختيار محامٍ أو مساعد نشط." });
      }
    }

    if (req.body?.status !== undefined) {
      const nextStatus = String(req.body.status || "");
      if (!["active", "finished"].includes(nextStatus)) {
        return res.status(400).json({ error: "حالة القضية غير صالحة." });
      }
      if (nextStatus === "finished" && status !== "finished") {
        finishedAt = new Date().toISOString();
      } else if (nextStatus === "active" && status === "finished") {
        finishedAt = null;
      }
      status = nextStatus;
    }
  }

  const notes = String(req.body?.notes ?? row.notes ?? "").trim();
  const previousAttachments = Array.isArray(row.attachments) ? row.attachments : [];
  const previousById = new Map(previousAttachments.map((item) => [item.id, item]));
  let attachments = Array.isArray(req.body?.attachments)
    ? req.body.attachments
        .map((item) => {
          const normalized = normalizeAttachment(item);
          const existing = previousById.get(normalized.id);
          return mergeAttachment(normalized, existing);
        })
        .filter(isValidAttachment)
    : previousAttachments;

  if (!isAdmin && Array.isArray(req.body?.attachments)) {
    const preserved = previousAttachments
      .map((item) => normalizeAttachment(item))
      .filter(isValidAttachment);
    const preservedIds = new Set(preserved.map((item) => item.id));
    const additions = attachments.filter((item) => item.id && !preservedIds.has(item.id));
    attachments = [...preserved, ...additions];
  }

  await deleteOrphanedFiles(previousAttachments, attachments);

  await db
    .prepare(
      `UPDATE cases SET title = ?, client_id = ?, assigned_to = ?, status = ?, finished_at = ?, notes = ?, attachments = ? WHERE id = ?`
    )
    .run(title, clientId, assignedTo, status, finishedAt, notes, attachments, row.id);

  const updatedRow = {
    ...row,
    title,
    client_id: clientId,
    assigned_to: assignedTo,
    status,
    finished_at: finishedAt,
    notes,
    attachments,
  };

  await writeAudit({
    userId: req.user.id,
    action: "case_updated",
    entityType: "case",
    entityId: row.id,
    metadata: {
      title,
      client_id: clientId,
      assigned_to: assignedTo,
      status,
      notes_length: notes.length,
      attachments_count: attachments.length,
    },
    ip: req.ip,
  });

  res.json({ case: await enrichCase(updatedRow), message: "تم حفظ بيانات القضية." });
});

router.post("/cases/:id/archive", async (req, res) => {
  const row = await getCaseIfAccessible(req.user, req.params.id);
  if (!row) {
    return res.status(404).json({ error: "القضية غير موجودة أو غير متاحة." });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "أرشفة القضايا متاحة للمدير فقط." });
  }

  if (row.status === "archived") {
    return res.status(400).json({ error: "القضية مؤرشفة بالفعل." });
  }

  if (!(await archiveCase(row.id))) {
    return res.status(400).json({ error: "تعذرت أرشفة القضية." });
  }

  await writeAudit({
    userId: req.user.id,
    action: "case_archived",
    entityType: "case",
    entityId: row.id,
    metadata: { title: row.title },
    ip: req.ip,
  });

  res.json({ message: "تمت أرشفة القضية." });
});

router.post(
  "/cases/:caseId/attachments/presign",
  async (req, res) => {
    const row = await getCaseIfAccessible(req.user, req.params.caseId);
    if (!row) {
      return res.status(404).json({ error: "القضية غير موجودة أو غير متاحة." });
    }

    if (!canEditCase(req.user, row)) {
      return res.status(403).json({ error: "غير مصرح برفع مرفقات لهذه القضية." });
    }

    if (storageMode !== "r2") {
      return res.status(400).json({ error: "الرفع المباشر متاح فقط مع R2." });
    }

    const originalName = String(req.body?.originalName || "").trim();
    const mimeType = String(req.body?.mimeType || "application/octet-stream").trim();
    const size = Number(req.body?.size || 0);
    const label = String(req.body?.label || originalName || "").trim();
    if (!originalName || !label) {
      return res.status(400).json({ error: "بيانات المرفق غير مكتملة." });
    }
    if (!Number.isFinite(size) || size <= 0 || size > 15 * 1024 * 1024) {
      return res.status(400).json({ error: "حجم الملف غير صالح (الحد الأقصى 15MB)." });
    }

    try {
      assertAllowedUpload(originalName, mimeType);
    } catch (error) {
      return res.status(error.statusCode || 400).json({ error: error.message });
    }

    const attachmentId = uuid();
    const key = storedFilename(attachmentId, originalName);
    try {
      const uploadUrl = await signedPutUrl(key, mimeType, 300);
      res.json({
        attachmentId,
        key,
        uploadUrl,
        expiresIn: 300,
      });
    } catch (error) {
      res.status(500).json({ error: "تعذر إنشاء رابط الرفع." });
    }
  }
);

router.post("/cases/:caseId/attachments/finalize", async (req, res) => {
  const row = await getCaseIfAccessible(req.user, req.params.caseId);
  if (!row) {
    return res.status(404).json({ error: "القضية غير موجودة أو غير متاحة." });
  }

  if (!canEditCase(req.user, row)) {
    return res.status(403).json({ error: "غير مصرح برفع مرفقات لهذه القضية." });
  }

  const attachmentId = String(req.body?.attachmentId || "").trim();
  const key = String(req.body?.key || "").trim();
  const label = String(req.body?.label || "").trim();
  const originalName = String(req.body?.originalName || "").trim();
  const mimeType = String(req.body?.mimeType || "").trim();
  const size = Number(req.body?.size || 0);

  if (!attachmentId || !key || !label || !originalName) {
    return res.status(400).json({ error: "بيانات المرفق غير مكتملة." });
  }

  const expectedKey = storedFilename(attachmentId, originalName);
  if (key !== expectedKey) {
    return res.status(400).json({ error: "مفتاح الملف غير صالح." });
  }

  try {
    assertAllowedUpload(originalName, mimeType);
  } catch (error) {
    return res.status(error.statusCode || 400).json({ error: error.message });
  }

  if (!(await fileExists(key))) {
    return res.status(400).json({ error: "لم يتم العثور على الملف المرفوع. أعد الرفع وحاول مرة أخرى." });
  }

  const attachment = normalizeAttachment({
    id: attachmentId,
    label,
    filename: key,
    originalName,
    mimeType: mimeType || "application/octet-stream",
    size: Number.isFinite(size) ? size : undefined,
  });
  if (!isValidAttachment(attachment)) {
    return res.status(400).json({ error: "المرفق غير صالح." });
  }

  res.status(201).json({
    attachment,
    message: "تم رفع الملف.",
  });
});

router.post(
  "/cases/:caseId/attachments",
  (req, res, next) => {
    req.attachmentId = uuid();
    next();
  },
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        return res.status(err.statusCode || 400).json({ error: err.message || "تعذر رفع الملف." });
      }
      next();
    });
  },
  async (req, res) => {
    let storedKey = null;

    const cleanup = async () => {
      if (storedKey) await deleteStoredFile(storedKey);
      else if (req.file?.filename) await deleteStoredFile(req.file.filename);
    };

    const row = await getCaseIfAccessible(req.user, req.params.caseId);
    if (!row) {
      await cleanup();
      return res.status(404).json({ error: "القضية غير موجودة أو غير متاحة." });
    }

    if (!canEditCase(req.user, row)) {
      await cleanup();
      return res.status(403).json({ error: "غير مصرح برفع مرفقات لهذه القضية." });
    }

    if (!req.file) {
      return res.status(400).json({ error: "لم يتم اختيار ملف." });
    }

    const label = String(req.body?.label || req.file.originalname || "").trim();
    if (!label) {
      await cleanup();
      return res.status(400).json({ error: "اسم المرفق مطلوب." });
    }

    try {
      assertAllowedUpload(req.file.originalname, req.file.mimetype);
    } catch (error) {
      await cleanup();
      return res.status(error.statusCode || 400).json({ error: error.message });
    }

    try {
      storedKey =
        storageMode === "r2"
          ? storedFilename(req.attachmentId, req.file.originalname)
          : req.file.filename;

      if (storageMode === "r2") {
        await putFile(storedKey, req.file.buffer, req.file.mimetype);
      }

      res.status(201).json({
        attachment: {
          id: req.attachmentId,
          label,
          filename: storedKey,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
        },
        message: "تم رفع الملف.",
      });
    } catch {
      await cleanup();
      res.status(500).json({ error: "تعذر حفظ الملف." });
    }
  }
);

router.get("/attachments/:attachmentId", async (req, res) => {
  const access = await getAttachmentIfAccessible(req.user, req.params.attachmentId);
  if (!access) {
    return res.status(404).json({ error: "المرفق غير موجود أو غير متاح." });
  }

  const { attachment } = access;
  const downloadName = attachmentDownloadName(attachment);
  const inline = req.query.view === "1" || req.query.inline === "1";
  const disposition = inline
    ? attachmentInlineContentDisposition(downloadName)
    : attachmentContentDisposition(downloadName);
  const mimeType = attachmentMimeType(attachment);

  if (storageMode === "r2") {
    try {
      const url = await signedGetUrl(attachment.filename, {
        contentType: mimeType,
        contentDisposition: disposition,
        expiresInSeconds: 120,
      });
      if (!url) {
        return res.status(404).json({ error: "ملف المرفق غير موجود على الخادم." });
      }
      return res.redirect(302, url);
    } catch {
      return res.status(404).json({ error: "ملف المرفق غير موجود على الخادم." });
    }
  }

  const opened = await openFile(attachment.filename);
  if (!opened?.body) {
    return res.status(404).json({ error: "ملف المرفق غير موجود على الخادم." });
  }
  res.setHeader("Content-Disposition", disposition);
  res.type(mimeType);
  if (opened.contentLength != null) {
    res.setHeader("Content-Length", String(opened.contentLength));
  }
  opened.body.on("error", () => {
    if (!res.headersSent) res.status(500).end();
    else res.end();
  });
  opened.body.pipe(res);
});

router.get("/tasks/:id", async (req, res) => {
  const row = await getTaskIfAccessible(req.user, req.params.id);
  if (!row) {
    return res.status(404).json({ error: "المهمة غير موجودة أو غير متاحة." });
  }

  res.json({ task: await enrichTask(row) });
});

router.patch("/tasks/:id", async (req, res) => {
  const row = await getTaskIfAccessible(req.user, req.params.id);
  if (!row) {
    return res.status(404).json({ error: "المهمة غير موجودة أو غير متاحة." });
  }

  const isAdmin = req.user.role === "admin";
  const hasMetaUpdate =
    req.body?.title !== undefined ||
    req.body?.assigned_to !== undefined ||
    req.body?.due_at !== undefined ||
    req.body?.attachments !== undefined;

  if (hasMetaUpdate) {
    if (!isAdmin) {
      return res.status(403).json({ error: "غير مصرح بتعديل المهمة." });
    }

    const caseRow = await db
      .prepare(`SELECT id, title, status, attachments FROM cases WHERE id = ? AND deleted_at IS NULL`)
      .get(row.case_id);
    if (!caseRow || caseRow.status === "archived") {
      return res.status(400).json({ error: "القضية المرتبطة بالمهمة غير موجودة أو مؤرشفة." });
    }

    let title = row.title;
    let assignedTo = row.assigned_to;
    let dueAt = row.due_at ?? null;
    let attachments = Array.isArray(row.attachments) ? row.attachments : [];

    if (req.body?.title !== undefined) {
      title = String(req.body.title || "").trim();
      if (!title) {
        return res.status(400).json({ error: "عنوان المهمة مطلوب." });
      }
    }

    if (req.body?.assigned_to !== undefined) {
      assignedTo = String(req.body.assigned_to || "");
      if (!(await getTaskAssignee(assignedTo, req.user))) {
        return res.status(400).json({ error: "يجب اختيار محامٍ أو مساعد نشط." });
      }
    }

    let assignedAt = row.assigned_at || row.created_at;
    if (req.body?.assigned_to !== undefined && assignedTo !== row.assigned_to) {
      assignedAt = new Date().toISOString();
    }

    if (req.body?.due_at !== undefined) {
      dueAt = normalizeDueAt(req.body.due_at);
    }

    if (req.body?.attachments !== undefined) {
      attachments = pickCaseAttachments(caseRow, req.body.attachments);
    }

    await db
      .prepare(
        `UPDATE tasks SET title = ?, assigned_to = ?, due_at = ?, attachments = ?, reminder_sent_at = NULL, assigned_at = ? WHERE id = ?`
      )
      .run(title, assignedTo, dueAt, attachments, assignedAt, row.id);

    await writeAudit({
      userId: req.user.id,
      action: "task_updated",
      entityType: "task",
      entityId: row.id,
      metadata: { title, assigned_to: assignedTo, attachments_count: attachments.length },
      ip: req.ip,
    });

    return res.json({
      task: await enrichTask({ ...row, title, assigned_to: assignedTo, due_at: dueAt, attachments, assigned_at: assignedAt }),
      message: "تم تحديث المهمة.",
    });
  }

  const status = String(req.body?.status || "");
  if (!["open", "done"].includes(status)) {
    return res.status(400).json({ error: "حالة المهمة غير صالحة." });
  }

  await db.prepare(`UPDATE tasks SET status = ? WHERE id = ?`).run(status, row.id);

  await writeAudit({
    userId: req.user.id,
    action: status === "done" ? "task_completed" : "task_reopened",
    entityType: "task",
    entityId: row.id,
    metadata: { status },
    ip: req.ip,
  });

  res.json({
    task: await enrichTask({ ...row, status }),
    message: status === "done" ? "تم إنجاز المهمة." : "تمت إعادة فتح المهمة.",
  });
});

router.delete("/tasks/:id", async (req, res) => {
  const row = await getTaskIfAccessible(req.user, req.params.id);
  if (!row) {
    return res.status(404).json({ error: "المهمة غير موجودة أو غير متاحة." });
  }

  await softDeleteTask(row.id);

  await writeAudit({
    userId: req.user.id,
    action: "task_deleted",
    entityType: "task",
    entityId: row.id,
    metadata: { title: row.title },
    ip: req.ip,
  });

  res.json({ message: "تم حذف المهمة." });
});

router.post("/tasks", async (req, res) => {
  try {
    const caseId = String(req.body?.case_id || "");
    const title = String(req.body?.title || "").trim();
    const dueAt = normalizeDueAt(req.body?.due_at);
    const isAdmin = req.user.role === "admin";
    let assignedTo = isAdmin ? String(req.body?.assigned_to || "") : req.user.id;

    if (!caseId || !title) {
      return res.status(400).json({ error: "القضية وعنوان المهمة مطلوبان." });
    }

    const caseRow = await getCaseIfAccessible(req.user, caseId);
    if (!caseRow || caseRow.status === "archived") {
      return res.status(400).json({ error: "القضية غير موجودة أو مؤرشفة." });
    }

    if (isAdmin) {
      const assignee = await getTaskAssignee(assignedTo, req.user);
      if (!assignee) {
        return res.status(400).json({ error: "يجب اختيار محامٍ أو مساعد نشط." });
      }
    } else {
      assignedTo = req.user.id;
    }

    const taskId = uuid();
    const attachments = pickCaseAttachments(caseRow, req.body?.attachments);
    const assignedAt = new Date().toISOString();
    await db
      .prepare(
        `INSERT INTO tasks (id, case_id, title, assigned_to, status, due_at, created_by, attachments, assigned_at)
     VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?)`
      )
      .run(taskId, caseId, title, assignedTo, dueAt, req.user.id, attachments, assignedAt);

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
      message: "تم إنشاء المهمة.",
    });
  } catch (error) {
    console.error("[portal] create task error:", error);
    const status = error.statusCode || 500;
    res.status(status).json({
      error: status === 500 ? "تعذر إنشاء المهمة. حاول مرة أخرى." : error.message,
    });
  }
});

router.get("/assignees", async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "غير مصرح." });
  }
  const users = (
    await db
      .prepare(
        `SELECT id, username, name, role, status, created_at, activated_at
       FROM users
       ORDER BY created_at DESC`
      )
      .all()
  ).filter((u) => u.status === "active" && ["lawyer", "assistant"].includes(u.role));
  res.json({ users });
});

router.get("/push/vapid-key", requireAuth, (req, res) => {
  if (!isPushConfigured()) {
    return res.json({ enabled: false });
  }
  res.json({ enabled: true, publicKey: getVapidPublicKey() });
});

router.post("/push/subscribe", requireAuth, async (req, res) => {
  if (!isPushConfigured()) {
    return res.status(503).json({ error: "الإشعارات غير مفعّلة على الخادم." });
  }

  try {
    await savePushSubscription(req.user.id, req.body?.subscription);
    res.json({ message: "تم تفعيل الإشعارات." });
  } catch (error) {
    console.error("[portal] push subscribe error:", error);
    res.status(400).json({ error: error.message || "تعذر حفظ الاشتراك." });
  }
});

router.delete("/push/subscribe", requireAuth, async (req, res) => {
  const endpoint = String(req.body?.endpoint || "");
  if (endpoint) {
    await removePushSubscription(req.user.id, endpoint);
  }
  res.json({ ok: true });
});

export default router;
