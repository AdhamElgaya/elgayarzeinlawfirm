import { randomBytes, createHash } from "crypto";

export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function generateToken() {
  return randomBytes(32).toString("hex");
}

export function sessionExpiry(days = 30) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function invitationExpiry(hours = 72) {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

export function isExpired(isoDate) {
  return new Date(isoDate).getTime() <= Date.now();
}
