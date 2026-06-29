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

export const UPLOAD_REJECT_MESSAGE =
  "نوع الملف غير مسموح. المسموح: PDF، صور، Word، Excel، نص فقط (بدون ZIP).";

export function assertAllowedUpload(originalName, mimeType) {
  const ext = path.extname(String(originalName || "")).toLowerCase();
  const mime = String(mimeType || "")
    .trim()
    .toLowerCase()
    .split(";")[0];

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
