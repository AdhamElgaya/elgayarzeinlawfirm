import path from "path";
import db from "../db.js";
import { isOfficeStaff, isSectionManager, getManagedSection } from "./sections.js";
import { deleteFile as deleteStorageFile } from "./storage.js";

export { ensureUploadDir, objectKey as storedFilename, getLocalFilePath as getFilePath, UPLOAD_DIR } from "./storage.js";
export { storageMode } from "./storage.js";

export async function deleteStoredFile(filename) {
  await deleteStorageFile(filename);
}

const MIME_TO_EXT = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "text/plain": ".txt",
};

export function extensionFromAttachment(attachment) {
  const fromName = path.extname(attachment?.originalName || attachment?.filename || "");
  if (fromName) return fromName;
  const mime = String(attachment?.mimeType || "").trim().toLowerCase();
  return MIME_TO_EXT[mime] || "";
}

export function attachmentDownloadName(attachment) {
  const ext = extensionFromAttachment(attachment);
  const label = String(attachment?.label || "").trim();
  const originalName = String(attachment?.originalName || "").trim();
  const storedFilename = String(attachment?.filename || "").trim();

  let base =
    label ||
    (originalName && ext ? path.basename(originalName, ext) : originalName) ||
    (storedFilename && ext ? path.basename(storedFilename, ext) : storedFilename) ||
    "download";

  if (ext && !base.toLowerCase().endsWith(ext.toLowerCase())) {
    base = `${base}${ext}`;
  }

  return base;
}

export function mimeTypeFromExtension(extOrPath) {
  const raw = String(extOrPath || "").toLowerCase();
  const ext = raw.startsWith(".") ? raw : path.extname(raw).toLowerCase();
  const extToMime = Object.fromEntries(Object.entries(MIME_TO_EXT).map(([mime, value]) => [value, mime]));
  return extToMime[ext] || "application/octet-stream";
}

export function attachmentMimeType(attachment, filePath = "") {
  if (attachment?.mimeType) return attachment.mimeType;
  const fromMeta = mimeTypeFromExtension(extensionFromAttachment(attachment));
  if (fromMeta !== "application/octet-stream") return fromMeta;
  if (filePath) return mimeTypeFromExtension(filePath);
  return "application/octet-stream";
}

export function attachmentContentDisposition(downloadName) {
  const ext = path.extname(downloadName);
  const asciiFallback =
    downloadName.replace(/[^\x20-\x7E]/g, "").replace(/["\\]/g, "") || `download${ext || ""}`;
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`;
}

export function attachmentInlineContentDisposition(downloadName) {
  const ext = path.extname(downloadName);
  const asciiFallback =
    downloadName.replace(/[^\x20-\x7E]/g, "").replace(/["\\]/g, "") || `file${ext || ""}`;
  return `inline; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`;
}

export function mergeAttachment(incoming, existing) {
  const next = {
    ...(existing || {}),
    ...(incoming || {}),
    id: String(incoming?.id || existing?.id || "").trim(),
    label: String(incoming?.label || existing?.label || "").trim(),
    filename: existing?.filename || incoming?.filename,
    originalName: existing?.originalName || incoming?.originalName,
    mimeType: existing?.mimeType || incoming?.mimeType,
    size: existing?.size ?? incoming?.size,
    url: existing?.url || incoming?.url,
  };
  return normalizeAttachment(next);
}

export function safeAttachmentUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
    if (!parsed.hostname) return "";
    return parsed.href;
  } catch {
    return "";
  }
}

export function normalizeAttachment(item) {
  const normalized = {
    id: String(item?.id || "").trim(),
    label: String(item?.label || "").trim(),
  };

  if (item?.filename) {
    const raw = String(item.filename).trim().replace(/^\/+/, "");
    normalized.filename = raw.includes("/") ? raw : path.basename(raw);
  }
  if (item?.originalName) normalized.originalName = String(item.originalName).trim();
  if (item?.mimeType) normalized.mimeType = String(item.mimeType).trim();
  if (item?.size != null && !Number.isNaN(Number(item.size))) normalized.size = Number(item.size);
  const safeUrl = safeAttachmentUrl(item?.url);
  if (safeUrl) normalized.url = safeUrl;

  return normalized;
}

export function isValidAttachment(item) {
  return Boolean(item.label && (item.filename || safeAttachmentUrl(item.url)));
}

export function pickCaseAttachments(caseRow, requested = []) {
  if (!caseRow || !Array.isArray(requested) || !requested.length) return [];
  const caseAttachments = Array.isArray(caseRow.attachments) ? caseRow.attachments : [];
  const byId = new Map(caseAttachments.map((item) => [item.id, item]));
  const ids = requested.map((item) => (typeof item === "string" ? item : item?.id)).filter(Boolean);
  return ids
    .map((id) => byId.get(id))
    .filter((item) => item && isValidAttachment(normalizeAttachment(item)))
    .map((item) => normalizeAttachment(item));
}

export async function deleteOrphanedFiles(previous = [], next = []) {
  const keepFilenames = new Set(next.map((item) => item.filename).filter(Boolean));
  const libraryRows = await db
    .prepare(
      `SELECT id, label, filename, original_name, mime_type, size, section_ids, created_by, created_at FROM library_attachments ORDER BY created_at DESC`
    )
    .all();
  for (const row of libraryRows || []) {
    if (row.filename) keepFilenames.add(row.filename);
  }
  for (const item of previous) {
    if (item.filename && !keepFilenames.has(item.filename)) {
      await deleteStoredFile(item.filename);
    }
  }
}

export async function findCaseContainingAttachment(attachmentId) {
  const record = await findAttachmentRecord(attachmentId);
  return record?.caseRow || null;
}

export async function findAttachmentRecord(attachmentId) {
  const cases = await db
    .prepare(`SELECT id, title, attachments FROM cases WHERE deleted_at IS NULL`)
    .all();

  for (const caseRow of cases) {
    const attachments = Array.isArray(caseRow.attachments) ? caseRow.attachments : [];
    const attachment = attachments.find((item) => item.id === attachmentId);
    if (attachment) return { caseRow, attachment };
  }

  const tasks = await db
    .prepare(`SELECT id, case_id, attachments FROM tasks WHERE deleted_at IS NULL`)
    .all();

  for (const taskRow of tasks) {
    const attachments = Array.isArray(taskRow.attachments) ? taskRow.attachments : [];
    const attachment = attachments.find((item) => item.id === attachmentId);
    if (!attachment?.filename) continue;

    const caseRow = await db
      .prepare(`SELECT id, title, attachments FROM cases WHERE id = ? AND deleted_at IS NULL`)
      .get(taskRow.case_id);
    if (caseRow) return { caseRow, attachment, taskRow };
  }

  const library = await db
    .prepare(
      `SELECT id, label, filename, original_name, mime_type, size, section_ids, created_by, created_at FROM library_attachments WHERE id = ?`
    )
    .get(attachmentId);
  if (library?.filename) {
    return {
      caseRow: { id: library.id, title: library.label, attachments: [] },
      attachment: {
        id: library.id,
        label: library.label,
        filename: library.filename,
        originalName: library.original_name,
        mimeType: library.mime_type,
        size: library.size,
      },
      library: true,
    };
  }

  const clients = await db
    .prepare(
      `SELECT id, name, poa_document, id_document FROM clients WHERE deleted_at IS NULL ORDER BY created_at DESC`
    )
    .all();
  for (const client of clients || []) {
    for (const key of ["poa_document", "id_document"]) {
      let raw = client[key];
      if (typeof raw === "string") {
        try {
          raw = JSON.parse(raw);
        } catch {
          raw = null;
        }
      }
      const attachment = raw ? normalizeAttachment(raw) : null;
      if (attachment?.id === attachmentId && attachment.filename) {
        return { client, attachment };
      }
    }
  }

  return null;
}

export async function canEditCase(user, caseRow) {
  if (!user || !caseRow) return false;
  if (isOfficeStaff(user)) return true;
  if (caseRow.assigned_to === user.id) return true;
  if (isSectionManager(user)) {
    const managed = await getManagedSection(user.id);
    return Boolean(managed && caseRow.section_id === managed.id);
  }
  return false;
}
