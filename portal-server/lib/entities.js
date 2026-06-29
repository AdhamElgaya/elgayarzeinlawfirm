import db from "../db.js";
import { deleteStoredFile, findAttachmentRecord } from "./attachments.js";

export function displayId(id) {
  return String(id || "").slice(0, 8).toUpperCase();
}

async function getClientById(clientId) {
  if (!clientId) return null;
  return await db
    .prepare(`SELECT id, name, phone FROM clients WHERE id = ? AND deleted_at IS NULL`)
    .get(clientId);
}

async function getUserById(userId) {
  if (!userId) return null;
  return await db.prepare(`SELECT id, name, role FROM users WHERE id = ?`).get(userId);
}

async function getCaseById(caseId) {
  if (!caseId) return null;
  return await db
    .prepare(`SELECT id, title, status FROM cases WHERE id = ? AND deleted_at IS NULL`)
    .get(caseId);
}

export async function enrichCase(caseRow) {
  if (!caseRow) return null;
  const client = await getClientById(caseRow.client_id);
  const lawyer = await getUserById(caseRow.assigned_to);
  return {
    ...caseRow,
    display_id: displayId(caseRow.id),
    client_name: client?.name || caseRow.client_ref || null,
    client_phone: client?.phone || null,
    lawyer_name: lawyer?.name || null,
    lawyer_role: lawyer?.role || null,
    notes: caseRow.notes || "",
    attachments: Array.isArray(caseRow.attachments) ? caseRow.attachments : [],
  };
}

export async function enrichTask(taskRow) {
  if (!taskRow) return null;
  const caseRow = taskRow.case_title
    ? { id: taskRow.case_id, title: taskRow.case_title }
    : await getCaseById(taskRow.case_id);
  const assignee = await getUserById(taskRow.assigned_to);
  return {
    ...taskRow,
    display_id: displayId(taskRow.id),
    case_title: caseRow?.title || taskRow.case_title || "",
    case_display_id: caseRow ? displayId(caseRow.id) : "",
    assignee_name: assignee?.name || null,
    assignee_role: assignee?.role || null,
    attachments: Array.isArray(taskRow.attachments) ? taskRow.attachments : [],
  };
}

export async function getCaseIfAccessible(user, caseId) {
  const row = await db
    .prepare(
      `SELECT id, title, client_id, client_ref, notes, attachments, status, assigned_to, opened_at, finished_at, archived_at, created_by, created_at FROM cases WHERE id = ? AND deleted_at IS NULL`
    )
    .get(caseId);
  if (!row) return null;
  if (user.role !== "admin" && row.assigned_to !== user.id) return null;
  return row;
}

export async function getTaskIfAccessible(user, taskId) {
  const row = await db
    .prepare(
      `SELECT id, case_id, title, assigned_to, status, due_at, assigned_at, attachments, created_at, created_by FROM tasks WHERE id = ? AND deleted_at IS NULL`
    )
    .get(taskId);
  if (!row) return null;

  if (user.role === "admin") return row;

  if (row.assigned_to !== user.id) return null;

  const caseRow = await db.prepare(`SELECT id, status FROM cases WHERE id = ? AND deleted_at IS NULL`).get(row.case_id);
  if (!caseRow || caseRow.status === "archived") return null;

  return row;
}

export async function getAttachmentIfAccessible(user, attachmentId) {
  const record = await findAttachmentRecord(attachmentId);
  if (!record?.attachment?.filename) return null;

  const { caseRow, attachment } = record;

  if (await getCaseIfAccessible(user, caseRow.id)) {
    return { caseRow, attachment };
  }

  const tasks = await db
    .prepare(`SELECT id, attachments FROM tasks WHERE deleted_at IS NULL`)
    .all();
  for (const taskRow of tasks) {
    const linked = (taskRow.attachments || []).some((item) => item.id === attachmentId);
    if (!linked) continue;
    if (await getTaskIfAccessible(user, taskRow.id)) {
      return { caseRow, attachment };
    }
  }

  return null;
}

export async function latestTaskForCase(caseId) {
  const tasks = await db
    .prepare(
      `SELECT id, title, status, due_at, created_at FROM tasks WHERE case_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`
    )
    .all(caseId);
  return tasks[0] || null;
}

export async function softDeleteTask(id) {
  const now = new Date().toISOString();
  await db.prepare(`UPDATE tasks SET deleted_at = ? WHERE id = ?`).run(now, id);
}

export async function archiveCase(id) {
  const now = new Date().toISOString();
  const caseRow = await db
    .prepare(`SELECT id, status FROM cases WHERE id = ? AND deleted_at IS NULL`)
    .get(id);
  if (!caseRow || caseRow.status === "archived") return false;
  await db.prepare(`UPDATE cases SET status = ?, archived_at = ? WHERE id = ?`).run("archived", now, id);
  return true;
}

export async function softDeleteCase(id) {
  const now = new Date().toISOString();
  const caseRow = await db
    .prepare(`SELECT id, attachments FROM cases WHERE id = ? AND deleted_at IS NULL`)
    .get(id);
  for (const attachment of caseRow?.attachments || []) {
    if (attachment.filename) await deleteStoredFile(attachment.filename);
  }
  await db.prepare(`UPDATE tasks SET deleted_at = ? WHERE case_id = ?`).run(now, id);
  await db.prepare(`UPDATE cases SET deleted_at = ? WHERE id = ?`).run(now, id);
}

export async function softDeleteClient(id) {
  const now = new Date().toISOString();
  const cases = await db
    .prepare(`SELECT id FROM cases WHERE client_id = ? AND deleted_at IS NULL`)
    .all(id);
  for (const caseRow of cases) {
    await db.prepare(`UPDATE tasks SET deleted_at = ? WHERE case_id = ?`).run(now, caseRow.id);
    await db.prepare(`UPDATE cases SET deleted_at = ? WHERE id = ?`).run(now, caseRow.id);
  }
  await db.prepare(`UPDATE clients SET deleted_at = ? WHERE id = ?`).run(now, id);
}

export async function deleteUser(userId) {
  const ownedCases = await db
    .prepare(`SELECT id FROM cases WHERE assigned_to = ? OR created_by = ?`)
    .all(userId, userId);

  for (const caseRow of ownedCases) {
    await db.prepare(`DELETE FROM tasks WHERE case_id = ?`).run(caseRow.id);
    await db.prepare(`DELETE FROM cases WHERE id = ?`).run(caseRow.id);
  }

  await db.prepare(`DELETE FROM tasks WHERE assigned_to = ? OR created_by = ?`).run(userId, userId);
  await db.prepare(`DELETE FROM clients WHERE created_by = ?`).run(userId);
  await db.prepare(`DELETE FROM audit_logs WHERE user_id = ?`).run(userId);
  await db.prepare(`DELETE FROM push_subscriptions WHERE user_id = ?`).run(userId);
  await db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(userId);
  await db.prepare(`DELETE FROM invitations WHERE user_id = ?`).run(userId);
  await db.prepare(`DELETE FROM users WHERE id = ?`).run(userId);
}

export async function resetPortalData(adminUserId) {
  await db.prepare(`DELETE FROM tasks`).run();
  await db.prepare(`DELETE FROM cases`).run();
  await db.prepare(`DELETE FROM clients`).run();
  await db.prepare(`DELETE FROM audit_logs`).run();
  await db.prepare(`DELETE FROM push_subscriptions`).run();
  await db.prepare(`DELETE FROM sessions`).run();
  await db.prepare(`DELETE FROM invitations`).run();
  await db.prepare(`DELETE FROM users WHERE id != ?`).run(adminUserId);
}
