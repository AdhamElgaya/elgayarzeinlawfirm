import { Router } from "express";
import multer from "multer";
import path from "path";
import { v4 as uuid } from "uuid";
import db from "../db.js";
import { writeAudit } from "../lib/audit.js";
import {
  deleteStoredFile,
  ensureUploadDir,
  storedFilename,
  storageMode,
  UPLOAD_DIR,
} from "../lib/attachments.js";
import { putFile } from "../lib/storage.js";
import { assertAllowedUpload, peekUploadBytes } from "../lib/upload-policy.js";
import { requireAuth } from "../middleware/auth.js";
import {
  SECTION_DEFS,
  getActiveUser,
  getManagedSection,
  isOfficeStaff,
  isSectionManager,
  listLedSubsections,
} from "../lib/sections.js";
import {
  canRenameLibraryAttachment,
  canViewLibraryAttachment,
  getLibraryAttachment,
  insertLibraryAttachment,
  listCatalogAttachments,
  listLibraryAttachments,
  parseSectionIds,
  propagateLibraryLabel,
  publicLibraryRow,
  sectionIdsForCreate,
  updateLibraryAttachment,
} from "../lib/library-attachments.js";

const router = Router();
router.use(requireAuth);
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

function requireLibraryEditor(req, res, next) {
  const role = req.user?.role;
  if (!["admin", "assistant", "section_manager"].includes(role)) {
    return res.status(403).json({ error: "غير مصرح." });
  }
  next();
}

async function requireCatalogViewer(req, res, next) {
  const role = req.user?.role;
  if (["admin", "assistant", "section_manager"].includes(role)) return next();
  if (role === "lawyer") {
    const led = await listLedSubsections(req.user.id);
    if (led.length) {
      req.ledSubsections = led;
      return next();
    }
  }
  return res.status(403).json({ error: "غير مصرح." });
}

async function enrichLibrary(row) {
  const creator = row.created_by ? await getActiveUser(row.created_by) : null;
  return publicLibraryRow(row, creator);
}

router.get("/catalog", requireCatalogViewer, async (req, res) => {
  try {
    const query = String(req.query.q || "").trim().toLowerCase();
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 30));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    let items = await listCatalogAttachments(req.user);
    if (query) {
      items = items.filter((item) => {
        const haystack = [
          item.label,
          item.originalName,
          item.case_title,
          item.created_by_name,
          item.subsection_name,
          ...(item.section_names || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      });
    }
    res.json({
      attachments: items.slice(offset, offset + limit),
      total: items.length,
      has_more: offset + limit < items.length,
      scope: isOfficeStaff(req.user)
        ? "all"
        : isSectionManager(req.user)
          ? "section"
          : "subsection",
    });
  } catch (error) {
    console.error("[portal] catalog attachments:", error);
    res.status(500).json({ error: "تعذر تحميل المرفقات." });
  }
});

router.get("/", requireLibraryEditor, async (req, res) => {
  try {
    const managed = isSectionManager(req.user) ? await getManagedSection(req.user.id) : null;
    const filterId = isOfficeStaff(req.user) ? "" : managed?.id || "__none__";
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 25));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const rows = await listLibraryAttachments();
    const visible = [];
    for (const row of rows) {
      if (!(await canViewLibraryAttachment(req.user, row))) continue;
      const ids = parseSectionIds(row.section_ids);
      if (filterId && filterId !== "__none__" && !ids.includes(filterId)) continue;
      visible.push(await enrichLibrary(row));
    }
    res.json({
      attachments: visible.slice(offset, offset + limit),
      total: visible.length,
      has_more: offset + limit < visible.length,
      sections: SECTION_DEFS,
    });
  } catch (error) {
    console.error("[portal] list library attachments:", error);
    res.status(500).json({ error: "تعذر تحميل المرفقات." });
  }
});

router.post(
  "/",
  requireLibraryEditor,
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

    if (!req.file) {
      return res.status(400).json({ error: "لم يتم اختيار ملف." });
    }

    const label = String(req.body?.label || req.file.originalname || "").trim();
    if (!label) {
      await cleanup();
      return res.status(400).json({ error: "اسم المرفق مطلوب." });
    }

    const managed = isSectionManager(req.user) ? await getManagedSection(req.user.id) : null;
    const sectionIds = sectionIdsForCreate(req.user, req.body?.section_ids, managed?.id);
    if (!sectionIds.length) {
      await cleanup();
      return res.status(400).json({ error: "اختر قسماً واحداً على الأقل." });
    }

    try {
      assertAllowedUpload(req.file.originalname, req.file.mimetype, peekUploadBytes(req.file));
    } catch (error) {
      await cleanup();
      return res.status(error.statusCode || 400).json({ error: error.message });
    }

    try {
      storedKey =
        storageMode === "r2" ? storedFilename(req.attachmentId, req.file.originalname) : req.file.filename;
      if (storageMode === "r2") {
        await putFile(storedKey, req.file.buffer, req.file.mimetype);
      }

      const now = new Date().toISOString();
      await insertLibraryAttachment({
        id: req.attachmentId,
        label,
        filename: storedKey,
        original_name: req.file.originalname,
        mime_type: req.file.mimetype,
        size: req.file.size,
        section_ids: sectionIds,
        created_by: req.user.id,
        created_at: now,
      });

      await writeAudit({
        userId: req.user.id,
        action: "library_attachment_created",
        entityType: "library_attachment",
        entityId: req.attachmentId,
        metadata: { label, section_ids: sectionIds },
        ip: req.ip,
      });

      const row = await getLibraryAttachment(req.attachmentId);
      res.status(201).json({
        attachment: await enrichLibrary(row),
        message: "تم رفع المرفق.",
      });
    } catch (error) {
      await cleanup();
      console.error("[portal] library upload:", error);
      res.status(500).json({ error: "تعذر حفظ الملف." });
    }
  }
);

router.patch("/:id", requireLibraryEditor, async (req, res) => {
  try {
    const row = await getLibraryAttachment(req.params.id);
    if (!row || !(await canRenameLibraryAttachment(req.user, row))) {
      return res.status(404).json({ error: "المرفق غير موجود أو غير متاح." });
    }

    const label = String(req.body?.label ?? row.label).trim();
    if (!label) {
      return res.status(400).json({ error: "اسم المرفق مطلوب." });
    }

    let sectionIds = parseSectionIds(row.section_ids);
    if (isOfficeStaff(req.user) && req.body?.section_ids !== undefined) {
      sectionIds = parseSectionIds(req.body.section_ids);
      if (!sectionIds.length) {
        return res.status(400).json({ error: "اختر قسماً واحداً على الأقل." });
      }
    }

    await updateLibraryAttachment(row.id, {
      label,
      section_ids: isOfficeStaff(req.user) && req.body?.section_ids !== undefined ? sectionIds : undefined,
    });
    await propagateLibraryLabel(row.id, label);

    await writeAudit({
      userId: req.user.id,
      action: "library_attachment_updated",
      entityType: "library_attachment",
      entityId: row.id,
      metadata: { label, section_ids: sectionIds },
      ip: req.ip,
    });

    const updated = await getLibraryAttachment(row.id);
    res.json({ attachment: await enrichLibrary(updated), message: "تم تحديث المرفق." });
  } catch (error) {
    console.error("[portal] library rename:", error);
    res.status(500).json({ error: "تعذر تحديث المرفق." });
  }
});

export default router;
