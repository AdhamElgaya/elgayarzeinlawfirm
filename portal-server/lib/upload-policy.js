import fs from "fs";
import path from "path";

const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".txt",
]);

const ALLOWED_MIMES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

const ZIP_MIMES = new Set([
  "application/zip",
  "application/x-zip",
  "application/x-zip-compressed",
  "application/zip-compressed",
  "multipart/x-zip",
]);

export const UPLOAD_REJECT_MESSAGE =
  "نوع الملف غير مسموح. المسموح: PDF، صور، Word، Excel، نص فقط (بدون ZIP).";

const CLIENT_DOC_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp"]);
const CLIENT_DOC_MIMES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

export const CLIENT_DOC_REJECT_MESSAGE = "نوع الملف غير مسموح. المسموح: PDF أو صورة.";

export const ZIP_REJECT_MESSAGE = "لا يمكن رفع ملفات ZIP.";

function isZipName(originalName) {
  const name = String(originalName || "").toLowerCase();
  return name.endsWith(".zip") || name.endsWith(".zipx") || name.includes(".zip.");
}

function isZipMime(mimeType) {
  const mime = String(mimeType || "")
    .trim()
    .toLowerCase()
    .split(";")[0];
  return Boolean(mime) && (ZIP_MIMES.has(mime) || mime.includes("zip"));
}

function isZipBytes(bytes) {
  if (!bytes || bytes.length < 4) return false;
  return bytes[0] === 0x50 && bytes[1] === 0x4b;
}

export function peekUploadBytes(file) {
  if (file?.buffer?.length) return file.buffer.subarray(0, 8);
  if (file?.path) {
    try {
      const fd = fs.openSync(file.path, "r");
      try {
        const buf = Buffer.alloc(8);
        fs.readSync(fd, buf, 0, 8, 0);
        return buf;
      } finally {
        fs.closeSync(fd);
      }
    } catch {
      return null;
    }
  }
  return null;
}

export function isZipUpload(originalName, mimeType, bytes) {
  return isZipName(originalName) || isZipMime(mimeType) || isZipBytes(bytes);
}

export function assertAllowedUpload(originalName, mimeType, bytes) {
  const ext = path.extname(String(originalName || "")).toLowerCase();
  const mime = String(mimeType || "")
    .trim()
    .toLowerCase()
    .split(";")[0];

  if (isZipUpload(originalName, mimeType, bytes)) {
    const error = new Error(ZIP_REJECT_MESSAGE);
    error.statusCode = 400;
    throw error;
  }

  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    const error = new Error(UPLOAD_REJECT_MESSAGE);
    error.statusCode = 400;
    throw error;
  }

  if (mime && mime !== "application/octet-stream" && !ALLOWED_MIMES.has(mime)) {
    const error = new Error(UPLOAD_REJECT_MESSAGE);
    error.statusCode = 400;
    throw error;
  }

  return { ext, mime };
}

export function assertClientDocumentUpload(originalName, mimeType, bytes) {
  const { ext, mime } = assertAllowedUpload(originalName, mimeType, bytes);
  if (!CLIENT_DOC_EXTENSIONS.has(ext) || (mime && mime !== "application/octet-stream" && !CLIENT_DOC_MIMES.has(mime))) {
    const error = new Error(CLIENT_DOC_REJECT_MESSAGE);
    error.statusCode = 400;
    throw error;
  }
  return { ext, mime };
}
