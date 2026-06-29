import webpush from "web-push";
import { v4 as uuid } from "uuid";
import db from "../db.js";

let vapidReady = false;

export function isPushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || "";
}

function ensureVapid() {
  if (!isPushConfigured() || vapidReady) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:support@gzlawfirm.net",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  vapidReady = true;
}

export async function savePushSubscription(userId, subscription) {
  const endpoint = String(subscription?.endpoint || "");
  if (!endpoint) {
    throw new Error("Push subscription endpoint is required.");
  }

  const existing = await db
    .prepare(`SELECT id FROM push_subscriptions WHERE endpoint = ?`)
    .get(endpoint);

  if (existing) {
    await db
      .prepare(`UPDATE push_subscriptions SET user_id = ?, subscription = ? WHERE endpoint = ?`)
      .run(userId, subscription, endpoint);
    return existing.id;
  }

  const id = uuid();
  await db
    .prepare(
      `INSERT INTO push_subscriptions (id, user_id, endpoint, subscription) VALUES (?, ?, ?, ?)`
    )
    .run(id, userId, endpoint, subscription);
  return id;
}

export async function removePushSubscription(userId, endpoint) {
  await db
    .prepare(`DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?`)
    .run(userId, endpoint);
}

export async function sendPushToUser(userId, payload) {
  if (!isPushConfigured()) return { sent: 0, failed: 0 };

  ensureVapid();
  const rows = await db
    .prepare(`SELECT id, endpoint, subscription FROM push_subscriptions WHERE user_id = ?`)
    .all(userId);

  let sent = 0;
  let failed = 0;
  const body = JSON.stringify(payload);

  for (const row of rows) {
    const subscription = parseSubscription(row.subscription);
    if (!subscription?.endpoint) {
      failed += 1;
      continue;
    }
    try {
      await webpush.sendNotification(subscription, body);
      sent += 1;
    } catch (error) {
      failed += 1;
      if (error.statusCode === 404 || error.statusCode === 410) {
        await db.prepare(`DELETE FROM push_subscriptions WHERE id = ?`).run(row.id);
      }
    }
  }

  return { sent, failed };
}

function parseSubscription(value) {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value;
}
