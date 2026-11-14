import crypto from "crypto";
import fs from "fs";
import { pipeline } from "stream/promises";

const pending = new Map();
const TTL_MS = 15 * 60 * 1000;

export function createDirectUpload(payload) {
  const token = crypto.randomBytes(32).toString("hex");
  pending.set(token, { ...payload, expires: Date.now() + TTL_MS });
  return token;
}

export function takeDirectUpload(token) {
  const key = String(token || "");
  const row = pending.get(key);
  if (!row) return null;
  pending.delete(key);
  if (row.expires < Date.now()) return null;
  return row;
}

export function directUploadOrigin() {
  const domain = String(process.env.RAILWAY_PUBLIC_DOMAIN || "").trim();
  if (domain) return `https://${domain.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  const explicit = String(process.env.PUBLIC_API_ORIGIN || "").trim();
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID) {
    return "https://elgayarzeinlawfirm-production.up.railway.app";
  }
  return "";
}

export async function writeUploadBody(req, filePath) {
  await pipeline(req, fs.createWriteStream(filePath));
  const stat = await fs.promises.stat(filePath);
  if (!stat.size) {
    await fs.promises.unlink(filePath).catch(() => {});
    const error = new Error("لم يتم اختيار ملف.");
    error.statusCode = 400;
    throw error;
  }
  return stat.size;
}
