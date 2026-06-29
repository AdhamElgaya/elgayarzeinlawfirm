import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  r2Configured,
  r2PutObject,
  r2GetObject,
  r2DeleteObject,
  r2SignedGetUrl,
  r2SignedPutUrl,
  r2ObjectExists,
} from "./r2.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_UPLOAD_DIR = path.join(__dirname, "..", "uploads", "case-attachments");

export const UPLOAD_DIR = LOCAL_UPLOAD_DIR;

export const storageMode = r2Configured() ? "r2" : "local";

export function ensureUploadDir() {
  if (storageMode === "r2") return;
  fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
}

export function objectKey(attachmentId, originalName) {
  const ext = path.extname(originalName || "").toLowerCase().slice(0, 20);
  const safeExt = /^\.[a-z0-9.]+$/i.test(ext) ? ext : "";
  return `case-attachments/${attachmentId}${safeExt}`;
}

export function getLocalFilePath(key) {
  const base = path.basename(String(key || ""));
  if (!base || base !== key) return null;
  return path.join(LOCAL_UPLOAD_DIR, base);
}

export async function putFile(key, body, contentType) {
  if (storageMode === "r2") {
    await r2PutObject(key, body, contentType);
    return;
  }
  ensureUploadDir();
  const filePath = getLocalFilePath(path.basename(key));
  if (!filePath) throw new Error("Invalid storage key.");
  await fs.promises.writeFile(filePath, body);
}

export async function deleteFile(key) {
  if (!key) return;
  try {
    if (storageMode === "r2") {
      await r2DeleteObject(key);
      return;
    }
    const filePath = getLocalFilePath(path.basename(key));
    if (filePath && fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  } catch {
    /* ignore */
  }
}

export async function openFile(key) {
  if (!key) return null;

  if (storageMode === "r2") {
    try {
      const result = await r2GetObject(key);
      return {
        body: result.Body,
        contentLength: result.ContentLength,
        contentType: result.ContentType,
      };
    } catch {
      return null;
    }
  }

  const filePath = getLocalFilePath(path.basename(key));
  if (!filePath || !fs.existsSync(filePath)) return null;
  return {
    body: fs.createReadStream(filePath),
    contentLength: fs.statSync(filePath).size,
    contentType: null,
    filePath,
  };
}

export async function signedPutUrl(key, contentType, expiresInSeconds = 300) {
  if (storageMode !== "r2") {
    throw new Error("Signed upload URLs are only available with R2 storage.");
  }
  return r2SignedPutUrl(key, contentType, expiresInSeconds);
}

export async function signedGetUrl(key, options = {}) {
  if (storageMode !== "r2") {
    return null;
  }
  return r2SignedGetUrl(key, options);
}

export async function fileExists(key) {
  if (!key) return false;
  if (storageMode === "r2") {
    return r2ObjectExists(key);
  }
  const filePath = getLocalFilePath(path.basename(key));
  return Boolean(filePath && fs.existsSync(filePath));
}
