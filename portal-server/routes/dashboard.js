import { Router } from "express";
import multer from "multer";
import path from "path";
import { v4 as uuid } from "uuid";
import db from "../db.js";
import { composeCaseTitle } from "../lib/case-fields.js";
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
import { openFile, putFile, signedGetUrl, signedPutUrl, fileExists, peekStoredBytes } from "../lib/storage.js";
import { assertAllowedUpload, peekUploadBytes } from "../lib/upload-policy.js";
import { CLIENT_SELECT_COLUMNS, publicClient } from "../lib/client-docs.js";
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
import { isDueDatePassed } from "../lib/task-datetime.js";
import {
  VALID_SECTION_IDS,
  getManagedSection,
  getSection,
  getSubsectionLead,
  getUserMembership,
  isOfficeStaff,
  isAdminOnly,
  isSectionManager,
  isUserInSection,
  isLawyerInSubsection,
  listLedSubsections,
  listSectionCases,
  listSectionLawyers,
  listSubsectionMembers,
  listTasksForCase,
  normalizeSubsectionId,
  subsectionsFor,
  visibilityParams,
} from "../lib/sections.js";
import {
  countPushSubscriptions,
  getVapidPublicKey,
  isPushConfigured,
  removePushSubscription,
  savePushSubscription,
  sendPushToUser,
  sendTaskAssignedPush,
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

router.get("/summary", async (req, res) => {
  const [userId, seeAll, sectionId] = await visibilityParams(req.user);
  const isStaff = isOfficeStaff(req.user);

  const caseRows = await db
    .prepare(
      `SELECT id, title, client_id, client_ref, notes, attachments, status, opened_at, finished_at, archived_at, assigned_to, section_id, subsection_id, opponent_name, case_number
       FROM cases
       WHERE deleted_at IS NULL
         AND status != 'archived'
         AND (assigned_to = ? OR ? = 1 OR section_id = ?)
       ORDER BY opened_at DESC`
    )
    .all(userId, seeAll, sectionId);
  const myCases = await Promise.all(caseRows.map((row) => enrichCase(row)));

  const taskRows = await db
    .prepare(
      `SELECT t.id, t.title, t.status, t.due_at, t.incomplete_reason, t.case_id, t.assigned_to, t.assigned_at, t.created_at, t.section_id, c.title AS case_title
       FROM tasks t
       JOIN cases c ON c.id = t.case_id
       WHERE t.deleted_at IS NULL
         AND c.deleted_at IS NULL
         AND c.status != 'archived'
         AND (t.assigned_to = ? OR ? = 1 OR t.section_id = ? OR c.section_id = ?)
       ORDER BY t.created_at DESC`
    )
    .all(userId, seeAll, sectionId, sectionId);
  const myTasks = await Promise.all(taskRows.map((row) => enrichTask(row)));

  const archivedCount = await db
    .prepare(
      `SELECT COUNT(*) AS count FROM cases
       WHERE status = 'archived' AND deleted_at IS NULL AND (assigned_to = ? OR ? = 1 OR section_id = ?)`
    )
    .get(userId, seeAll, sectionId);

  const clients = isStaff
    ? (await db
        .prepare(
          `SELECT ${CLIENT_SELECT_COLUMNS} FROM clients WHERE deleted_at IS NULL ORDER BY created_at DESC`
        )
        .all()).map((row) => publicClient(row))
    : [];

  const ledSubsections = req.user.role === "lawyer" ? await listLedSubsections(req.user.id) : [];
  const membership = req.user.role === "lawyer" ? await getUserMembership(req.user.id) : null;
  const extraGroups = ledSubsections.length
    ? ledSubsections
    : membership?.section_id && membership.subsection_id
      ? [{ section_id: membership.section_id, subsection_id: membership.subsection_id }]
      : [];
  if (extraGroups.length) {
    const seenCases = new Set(myCases.map((item) => item.id));
    const seenTasks = new Set(myTasks.map((item) => item.id));
    const includeAllSsTasks = ledSubsections.length > 0;
    for (const item of extraGroups) {
      const ssCases = (await listSectionCases(item.section_id)).filter(
        (row) => row.subsection_id === item.subsection_id
      );
      for (const caseRow of ssCases) {
        if (!seenCases.has(caseRow.id)) {
          seenCases.add(caseRow.id);
          myCases.push(await enrichCase(caseRow));
        }
        const extraTasks = await listTasksForCase(caseRow.id);
        for (const taskRow of extraTasks) {
          if (seenTasks.has(taskRow.id)) continue;
          if (!includeAllSsTasks && taskRow.assigned_to !== req.user.id) continue;
          seenTasks.add(taskRow.id);
          myTasks.push(await enrichTask(taskRow));
        }
      }
    }
  }

  let inbox = null;
  if (isStaff) {
    inbox = {
      kind: "admin",
      count: myCases.filter((item) => !item.section_id).length,
    };
  } else if (isSectionManager(req.user)) {
    const managed = await getManagedSection(req.user.id);
    const groups = managed ? subsectionsFor(managed.id) : [];
    if (managed && groups.length) {
      const allowed = new Set(groups.map((item) => item.id));
      inbox = {
        kind: "section",
        section_id: managed.id,
        count: myCases.filter((item) => !allowed.has(item.subsection_id)).length,
      };
    }
  }

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
    inbox,
    led_subsections: ledSubsections,
  });
});

router.get("/archived", async (req, res) => {
  const [userId, seeAll, sectionId] = await visibilityParams(req.user);

  const rows = await db
    .prepare(
      `SELECT id, title, client_id, client_ref, notes, attachments, status, opened_at, finished_at, archived_at, assigned_to, section_id, subsection_id, opponent_name, case_number
       FROM cases
       WHERE deleted_at IS NULL
         AND status = 'archived'
         AND (assigned_to = ? OR ? = 1 OR section_id = ?)
       ORDER BY archived_at DESC`
    )
    .all(userId, seeAll, sectionId);
  const archivedCases = await Promise.all(rows.map((row) => enrichCase(row)));

  res.json({ cases: archivedCases });
});

router.get("/clients/:id", async (req, res) => {
  if (!isOfficeStaff(req.user)) {
    return res.status(403).json({ error: "غير مصرح." });
  }

  const client = await db
    .prepare(`SELECT ${CLIENT_SELECT_COLUMNS} FROM clients WHERE id = ? AND deleted_at IS NULL`)
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
    client: { ...publicClient(client), display_id: displayId(client.id) },
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
      lawyer: enriched.lawyer_id
        ? {
            id: enriched.lawyer_id,
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

  if (!(await canEditCase(req.user, row))) {
    return res.status(403).json({ error: "غير مصرح بتعديل هذه القضية." });
  }

  const isAdmin = isOfficeStaff(req.user);
  const canEditMeta = isAdmin && row.status !== "archived";
  const managed = isSectionManager(req.user) ? await getManagedSection(req.user.id) : null;

  let title = row.title;
  let clientId = row.client_id;
  let assignedTo = row.assigned_to;
  let status = row.status;
  let finishedAt = row.finished_at || null;
  let sectionId = row.section_id || null;
  let subsectionId = row.subsection_id || null;
  let opponentName = row.opponent_name || "";
  let caseNumber = row.case_number || "";

  if (canEditMeta) {
    if (req.body?.opponent_name !== undefined || req.body?.case_number !== undefined) {
      if (req.body?.opponent_name !== undefined) {
        opponentName = String(req.body.opponent_name || "").trim();
      }
      if (req.body?.case_number !== undefined) {
        caseNumber = String(req.body.case_number || "").trim();
      }
      if (!opponentName || !caseNumber) {
        return res.status(400).json({ error: "اسم الخصم ورقم القضية مطلوبان." });
      }
      title = composeCaseTitle(caseNumber, opponentName, title);
    } else if (req.body?.title !== undefined) {
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

    if (req.body?.section_id !== undefined) {
      const nextSectionId = String(req.body.section_id || "").trim();
      const toInbox = !nextSectionId || nextSectionId === "inbox";
      if (toInbox) {
        sectionId = null;
        assignedTo = null;
        subsectionId = null;
      } else {
        if (!VALID_SECTION_IDS.includes(nextSectionId)) {
          return res.status(400).json({ error: "يجب اختيار قسماً صالحاً." });
        }
        const section = await getSection(nextSectionId);
        if (!section?.manager_id) {
          return res.status(400).json({ error: "عيّن مدير هذا القسم أولاً من صفحة الأقسام." });
        }
        sectionId = nextSectionId;
        assignedTo = section.manager_id;
        if (!subsectionsFor(sectionId).length) {
          subsectionId = null;
        } else {
          subsectionId = normalizeSubsectionId(sectionId, subsectionId);
        }
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

  if (isSectionManager(req.user) && req.body?.status !== undefined) {
    if (row.status === "archived") {
      return res.status(400).json({ error: "لا يمكن تعديل حالة قضية مؤرشفة." });
    }
    if (!managed || row.section_id !== managed.id) {
      return res.status(403).json({ error: "يمكنك تعديل قضايا قسمك فقط." });
    }
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

  if (isSectionManager(req.user) && req.body?.assigned_to !== undefined) {
    if (!managed || row.section_id !== managed.id) {
      return res.status(403).json({ error: "يمكنك تعيين قضايا قسمك فقط." });
    }
    const lawyerId = String(req.body.assigned_to || "");
    if (!(await isUserInSection(lawyerId, managed.id))) {
      return res.status(400).json({ error: "يجب اختيار محامٍ من قسمك." });
    }
    const lawyer = await db.prepare(`SELECT id, role, status FROM users WHERE id = ?`).get(lawyerId);
    if (!lawyer || lawyer.status !== "active" || lawyer.role !== "lawyer") {
      return res.status(400).json({ error: "يجب اختيار محامٍ نشط من قسمك." });
    }
    assignedTo = lawyerId;
  }

  if (isSectionManager(req.user) && req.body?.subsection_id !== undefined) {
    if (!managed || row.section_id !== managed.id) {
      return res.status(403).json({ error: "يمكنك تصنيف قضايا قسمك فقط." });
    }
    if (subsectionsFor(managed.id).length) {
      subsectionId = normalizeSubsectionId(managed.id, req.body.subsection_id);
      if (!subsectionId) {
        return res.status(400).json({ error: "يجب اختيار القسم الفرعي." });
      }
      if (req.body?.assigned_to === undefined) {
        const leadId = await getSubsectionLead(managed.id, subsectionId);
        if (leadId && (await isUserInSection(leadId, managed.id))) {
          assignedTo = leadId;
        }
      }
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
      `UPDATE cases SET title = ?, client_id = ?, assigned_to = ?, status = ?, finished_at = ?, notes = ?, attachments = ?, section_id = ?, subsection_id = ?, opponent_name = ?, case_number = ? WHERE id = ?`
    )
    .run(
      title,
      clientId,
      assignedTo,
      status,
      finishedAt,
      notes,
      attachments,
      sectionId,
      subsectionId,
      opponentName || null,
      caseNumber || null,
      row.id
    );

  const updatedRow = {
    ...row,
    title,
    client_id: clientId,
    assigned_to: assignedTo,
    status,
    finished_at: finishedAt,
    notes,
    attachments,
    section_id: sectionId,
    subsection_id: subsectionId,
    opponent_name: opponentName || null,
    case_number: caseNumber || null,
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
      section_id: sectionId,
      subsection_id: subsectionId,
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

    if (!(await canEditCase(req.user, row))) {
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

  if (!(await canEditCase(req.user, row))) {
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

  const storedBytes = await peekStoredBytes(key);
  if (!storedBytes?.length) {
    return res.status(400).json({ error: "تعذر التحقق من الملف المرفوع." });
  }
  try {
    assertAllowedUpload(originalName, mimeType, storedBytes);
  } catch (error) {
    return res.status(error.statusCode || 400).json({ error: error.message });
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

    if (!(await canEditCase(req.user, row))) {
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
      assertAllowedUpload(req.file.originalname, req.file.mimetype, peekUploadBytes(req.file));
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

  const isAdmin = isOfficeStaff(req.user);
  const managed = isSectionManager(req.user) ? await getManagedSection(req.user.id) : null;
  const hasMetaUpdate =
    req.body?.title !== undefined ||
    req.body?.assigned_to !== undefined ||
    req.body?.due_at !== undefined ||
    req.body?.attachments !== undefined;

  if (hasMetaUpdate) {
    const caseRow = await db
      .prepare(`SELECT id, title, status, attachments, section_id, subsection_id FROM cases WHERE id = ? AND deleted_at IS NULL`)
      .get(row.case_id);
    if (!caseRow || caseRow.status === "archived") {
      return res.status(400).json({ error: "القضية المرتبطة بالمهمة غير موجودة أو مؤرشفة." });
    }

    const taskSectionId = row.section_id || caseRow.section_id;
    const smOwnsTask = Boolean(managed && taskSectionId === managed.id);
    const led = !isAdmin && !managed ? await listLedSubsections(req.user.id) : [];
    const leadOwnsTask = led.some(
      (item) => item.section_id === caseRow.section_id && item.subsection_id === caseRow.subsection_id
    );

    if (!isAdmin && !smOwnsTask && !leadOwnsTask) {
      return res.status(403).json({ error: "غير مصرح بتعديل المهمة." });
    }

    if (isSectionManager(req.user) && row.status !== "open" && req.body?.assigned_to !== undefined) {
      return res.status(400).json({ error: "يمكن إعادة تعيين المهام غير المكتملة فقط." });
    }

    let title = row.title;
    let assignedTo = row.assigned_to;
    let dueAt = row.due_at ?? null;
    let attachments = Array.isArray(row.attachments) ? row.attachments : [];

    if (req.body?.title !== undefined) {
      if (!isAdmin && !smOwnsTask && !leadOwnsTask) {
        return res.status(403).json({ error: "غير مصرح بتعديل المهمة." });
      }
      title = String(req.body.title || "").trim();
      if (!title) {
        return res.status(400).json({ error: "عنوان المهمة مطلوب." });
      }
    }

    if (req.body?.assigned_to !== undefined) {
      assignedTo = String(req.body.assigned_to || "");
      if (isAdmin) {
        const section = await getSection(caseRow.section_id);
        const assigningSelf = assignedTo === req.user.id;
        if (!assigningSelf && (!section?.manager_id || assignedTo !== section.manager_id)) {
          return res.status(400).json({ error: "يجب تعيين المهمة لمدير قسم القضية." });
        }
      } else if (leadOwnsTask) {
        if (row.status !== "open") {
          return res.status(400).json({ error: "يمكن إعادة تعيين المهام غير المكتملة فقط." });
        }
        if (!(await isLawyerInSubsection(assignedTo, caseRow.section_id, caseRow.subsection_id))) {
          return res.status(400).json({ error: "يمكن إعادة التعيين لمحامٍ في القسم الفرعي فقط." });
        }
        const lawyer = await db.prepare(`SELECT id, role, status FROM users WHERE id = ?`).get(assignedTo);
        if (!lawyer || lawyer.status !== "active" || lawyer.role !== "lawyer") {
          return res.status(400).json({ error: "يجب اختيار محامٍ نشط من القسم الفرعي." });
        }
      } else {
        if (row.status !== "open") {
          return res.status(400).json({ error: "يمكن إعادة تعيين المهام غير المكتملة فقط." });
        }
        if (!(await isUserInSection(assignedTo, managed.id))) {
          return res.status(400).json({ error: "يمكن إعادة التعيين لمحامٍ في قسمك فقط." });
        }
        const lawyer = await db.prepare(`SELECT id, role, status FROM users WHERE id = ?`).get(assignedTo);
        if (!lawyer || lawyer.status !== "active" || lawyer.role !== "lawyer") {
          return res.status(400).json({ error: "يجب اختيار محامٍ نشط من قسمك." });
        }
      }
    }

    const reassigned = req.body?.assigned_to !== undefined && assignedTo !== row.assigned_to;
    let assignedAt = row.assigned_at || row.created_at;
    if (reassigned) {
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

    if (reassigned) {
      await sendTaskAssignedPush(assignedTo, { id: row.id, title, due_at: dueAt });
    }

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

  const canChangeStatus =
    isOfficeStaff(req.user) ||
    row.assigned_to === req.user.id ||
    Boolean(managed && (row.section_id === managed.id));
  if (!canChangeStatus) {
    return res.status(403).json({ error: "غير مصرح بتغيير حالة هذه المهمة." });
  }

  let nextStatus = status;
  let incompleteReason = row.incomplete_reason || null;
  if (status === "open") {
    const reason = String(req.body?.incomplete_reason || "").trim();
    if (!reason) {
      return res.status(400).json({ error: "اكتب سبب عدم اكتمال المهمة." });
    }
    incompleteReason = reason;
    if (isDueDatePassed(row.due_at)) {
      nextStatus = "missed";
    }
  } else {
    incompleteReason = null;
  }

  await db
    .prepare(`UPDATE tasks SET status = ?, incomplete_reason = ? WHERE id = ?`)
    .run(nextStatus, incompleteReason, row.id);

  await writeAudit({
    userId: req.user.id,
    action: nextStatus === "done" ? "task_completed" : nextStatus === "missed" ? "task_missed" : "task_reopened",
    entityType: "task",
    entityId: row.id,
    metadata: { status: nextStatus, incomplete_reason: incompleteReason },
    ip: req.ip,
  });

  const messages = {
    done: "تم إنجاز المهمة.",
    missed: "المهمة فائتة. تم حفظ السبب.",
    open: "تم تحديد المهمة كغير مكتملة.",
  };

  res.json({
    task: await enrichTask({ ...row, status: nextStatus, incomplete_reason: incompleteReason }),
    message: messages[nextStatus],
  });
});

router.delete("/tasks/:id", async (req, res) => {
  const row = await getTaskIfAccessible(req.user, req.params.id);
  if (!row) {
    return res.status(404).json({ error: "المهمة غير موجودة أو غير متاحة." });
  }

  const canDelete = isAdminOnly(req.user) || (!isOfficeStaff(req.user) && row.assigned_to === req.user.id);
  if (!canDelete) {
    return res.status(403).json({ error: "الحذف متاح للمدير فقط." });
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
    const isAdmin = isOfficeStaff(req.user);
    const managed = isSectionManager(req.user) ? await getManagedSection(req.user.id) : null;
    let assignedTo = String(req.body?.assigned_to || "");

    if (!caseId || !title) {
      return res.status(400).json({ error: "القضية وعنوان المهمة مطلوبان." });
    }

    const caseRow = await getCaseIfAccessible(req.user, caseId);
    if (!caseRow || caseRow.status === "archived") {
      return res.status(400).json({ error: "القضية غير موجودة أو مؤرشفة." });
    }

    if (isAdmin) {
      if (!assignedTo) assignedTo = req.user.id;
      const assigningSelf = assignedTo === req.user.id;
      if (!assigningSelf) {
        const section = await getSection(caseRow.section_id);
        if (!section?.manager_id) {
          return res.status(400).json({ error: "عيّن مدير قسم هذه القضية أولاً من صفحة الأقسام." });
        }
        if (assignedTo !== section.manager_id) {
          return res.status(400).json({ error: "يجب تعيين المهمة لمدير قسم القضية." });
        }
      }
    } else if (managed) {
      if (caseRow.section_id !== managed.id) {
        return res.status(403).json({ error: "يمكنك إضافة مهام لقضايا قسمك فقط." });
      }
      if (!(await isUserInSection(assignedTo, managed.id))) {
        return res.status(400).json({ error: "يجب اختيار محامٍ من قسمك." });
      }
      const lawyer = await db.prepare(`SELECT id, role, status FROM users WHERE id = ?`).get(assignedTo);
      if (!lawyer || lawyer.status !== "active" || lawyer.role !== "lawyer") {
        return res.status(400).json({ error: "يجب اختيار محامٍ نشط من قسمك." });
      }
    } else {
      const led = await listLedSubsections(req.user.id);
      const match = led.find(
        (item) => item.section_id === caseRow.section_id && item.subsection_id === caseRow.subsection_id
      );
      if (!match) {
        assignedTo = req.user.id;
      } else {
        if (!assignedTo) {
          return res.status(400).json({ error: "يجب اختيار محامٍ من القسم الفرعي." });
        }
        if (!(await isLawyerInSubsection(assignedTo, match.section_id, match.subsection_id))) {
          return res.status(400).json({ error: "يجب اختيار محامٍ معيّن لهذا القسم الفرعي." });
        }
        const lawyer = await db.prepare(`SELECT id, role, status FROM users WHERE id = ?`).get(assignedTo);
        if (!lawyer || lawyer.status !== "active" || lawyer.role !== "lawyer") {
          return res.status(400).json({ error: "يجب اختيار محامٍ نشط من القسم الفرعي." });
        }
      }
    }

    const taskId = uuid();
    const attachments = pickCaseAttachments(caseRow, req.body?.attachments);
    const assignedAt = new Date().toISOString();
    const sectionId = caseRow.section_id || managed?.id || null;
    await db
      .prepare(
        `INSERT INTO tasks (id, case_id, title, assigned_to, status, due_at, created_by, attachments, assigned_at, section_id)
     VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)`
      )
      .run(taskId, caseId, title, assignedTo, dueAt, req.user.id, attachments, assignedAt, sectionId);

    if (isAdmin || managed) {
      await sendTaskAssignedPush(assignedTo, { id: taskId, title, due_at: dueAt });
    } else if (assignedTo && assignedTo !== req.user.id) {
      await sendTaskAssignedPush(assignedTo, { id: taskId, title, due_at: dueAt });
    }

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
        section_id: sectionId,
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
  if (isSectionManager(req.user)) {
    const managed = await getManagedSection(req.user.id);
    if (!managed) {
      return res.json({ users: [] });
    }
    const users = await listSectionLawyers(managed.id);
    return res.json({ users, section: { id: managed.id, name: managed.name } });
  }
  const led = req.user.role === "lawyer" ? await listLedSubsections(req.user.id) : [];
  if (led.length && req.user.role === "lawyer") {
    const seen = new Set();
    const users = [];
    for (const item of led) {
      const members = await listSubsectionMembers(item.section_id, item.subsection_id);
      for (const lawyer of members) {
        if (seen.has(lawyer.id)) continue;
        seen.add(lawyer.id);
        users.push({
          ...lawyer,
          section_id: item.section_id,
          subsection_id: item.subsection_id,
          subsection_name: item.subsection_name,
        });
      }
    }
    return res.json({ users, led_subsections: led });
  }
  if (req.user.role === "lawyer") {
    const membership = await getUserMembership(req.user.id);
    return res.json({
      users: [
        {
          id: req.user.id,
          username: req.user.username,
          name: req.user.name,
          role: req.user.role,
          status: req.user.status,
          section_id: membership?.section_id || null,
          subsection_id: membership?.subsection_id || null,
        },
      ],
    });
  }
  if (!isOfficeStaff(req.user)) {
    return res.status(403).json({ error: "غير مصرح." });
  }
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

router.get("/push/vapid-key", requireAuth, (req, res) => {
  if (!isPushConfigured()) {
    return res.json({ enabled: false });
  }
  res.json({ enabled: true, publicKey: getVapidPublicKey() });
});

router.get("/push/status", requireAuth, async (req, res) => {
  const subscriptions = await countPushSubscriptions(req.user.id);
  res.json({
    enabled: isPushConfigured(),
    subscriptions,
    registered: subscriptions > 0,
  });
});

router.post("/push/test", requireAuth, async (req, res) => {
  if (!isPushConfigured()) {
    return res.status(503).json({ error: "الإشعارات غير مفعّلة على الخادم." });
  }

  const result = await sendPushToUser(req.user.id, {
    title: "اختبار الإشعارات",
    body: "إذا ظهرت هذه الرسالة، الإشعارات تعمل بنجاح.",
    url: "/portal/home.html",
  });

  if (result.sent === 0) {
    const message =
      result.subscriptions === 0
        ? "لا يوجد جهاز مسجّل. اضغط «تفعيل الإشعارات» أولاً."
        : "فشل إرسال الإشعار. أعد تفعيل الإشعارات ثم جرّب مرة أخرى.";
    return res.status(400).json({ error: message, ...result });
  }

  res.json({ message: "تم إرسال إشعار الاختبار.", ...result });
});

router.post("/push/subscribe", requireAuth, async (req, res) => {
  if (!isPushConfigured()) {
    return res.status(503).json({ error: "الإشعارات غير مفعّلة على الخادم." });
  }

  try {
    const id = await savePushSubscription(req.user.id, req.body?.subscription);
    const subscriptions = await countPushSubscriptions(req.user.id);
    res.json({ message: "تم تفعيل الإشعارات.", id, subscriptions });
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
