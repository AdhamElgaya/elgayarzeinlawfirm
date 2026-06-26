import { Router } from "express";
import { v4 as uuid } from "uuid";
import db from "../db.js";
import { writeAudit } from "../lib/audit.js";
import { hashPassword } from "../lib/password.js";
import { isValidNewUsername, normalizeUsername, USERNAME_RULES_MESSAGE } from "../lib/username.js";
import { enrichTask, softDeleteCase, softDeleteClient, softDeleteTask, deleteUser } from "../lib/entities.js";
import { pickCaseAttachments } from "../lib/attachments.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/users", async (req, res) => {
  const users = await db
    .prepare(
      `SELECT id, username, name, role, status, created_at, activated_at
       FROM users
       ORDER BY created_at DESC`
    )
    .all();
  res.json({ users });
});

router.post("/users", async (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const name = String(req.body?.name || "").trim();
  const role = String(req.body?.role || "lawyer");
  const password = String(req.body?.password || "");
  const confirmPassword = String(req.body?.confirmPassword || "");

  if (!username || !name || !password) {
    return res.status(400).json({ error: "Username, name, and password are required." });
  }

  if (!isValidNewUsername(username)) {
    return res.status(400).json({ error: USERNAME_RULES_MESSAGE });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match." });
  }

  if (!["lawyer", "assistant", "admin"].includes(role)) {
    return res.status(400).json({ error: "Invalid role." });
  }

  const existing = await db.prepare(`SELECT id FROM users WHERE username = ?`).get(username);
  if (existing) {
    return res.status(409).json({ error: "A user with this username already exists." });
  }

  const userId = uuid();
  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO users (id, username, name, role, status, password_hash, activated_at)
     VALUES (?, ?, ?, ?, 'active', ?, ?)`
    )
    .run(userId, username, name, role, passwordHash, now);

  await writeAudit({
    userId: req.user.id,
    action: "user_created",
    entityType: "user",
    entityId: userId,
    metadata: { username, role },
    ip: req.ip,
  });

  res.status(201).json({
    user: { id: userId, username, name, role, status: "active" },
    message: "Account created. Share the username and password with the lawyer securely.",
  });
});

router.delete("/users/:id", async (req, res) => {
  const userId = String(req.params.id || "");
  if (!userId) {
    return res.status(400).json({ error: "معرّف المستخدم مطلوب." });
  }

  if (userId === req.user.id) {
    return res.status(400).json({ error: "لا يمكنك حذف حسابك الحالي." });
  }

  const user = await db.prepare(`SELECT id, username, name, role, status FROM users WHERE id = ?`).get(userId);
  if (!user) {
    return res.status(404).json({ error: "المستخدم غير موجود." });
  }

  if (user.role === "admin" && user.status === "active") {
    const activeAdmins = await db
      .prepare(`SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND status = 'active'`)
      .get();
    if (Number(activeAdmins?.count || 0) <= 1) {
      return res.status(400).json({ error: "لا يمكن حذف آخر حساب مدير نشط." });
    }
  }

  await deleteUser(userId);

  await writeAudit({
    userId: req.user.id,
    action: "user_deleted",
    entityType: "user",
    entityId: userId,
    metadata: { username: user.username, name: user.name, role: user.role },
    ip: req.ip,
  });

  res.json({ message: "تم حذف الحساب." });
});

router.get("/audit", async (req, res) => {
  const logs = await db
    .prepare(
      `SELECT a.id, a.action, a.entity_type, a.entity_id, a.metadata, a.ip, a.created_at,
              u.name AS user_name, u.username AS user_username
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       ORDER BY a.created_at DESC
       LIMIT 100`
    )
    .all();
  res.json({ logs });
});

router.get("/assignees", async (req, res) => {
  const users = (
    await db
      .prepare(
        `SELECT id, username, name, role, status, created_at, activated_at
       FROM users
       ORDER BY created_at DESC`
      )
      .all()
  ).filter((u) => u.status === "active" && ["lawyer", "assistant"].includes(u.role));
  res.json({ users });
});

router.get("/clients", async (req, res) => {
  const clients = await db
    .prepare(`SELECT id, name, phone, created_at FROM clients WHERE deleted_at IS NULL ORDER BY created_at DESC`)
    .all();
  res.json({ clients });
});

router.post("/clients", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const phone = String(req.body?.phone || "").trim() || null;

  if (!name) {
    return res.status(400).json({ error: "اسم الموكل مطلوب." });
  }

  const clientId = uuid();
  await db.prepare(`INSERT INTO clients (id, name, phone, created_by) VALUES (?, ?, ?, ?)`).run(
    clientId,
    name,
    phone,
    req.user.id
  );

  await writeAudit({
    userId: req.user.id,
    action: "client_created",
    entityType: "client",
    entityId: clientId,
    metadata: { name },
    ip: req.ip,
  });

  res.status(201).json({
    client: { id: clientId, name, phone },
    message: "تم إضافة الموكل.",
  });
});

router.delete("/clients/:id", async (req, res) => {
  const client = await db
    .prepare(`SELECT id, name FROM clients WHERE id = ? AND deleted_at IS NULL`)
    .get(req.params.id);
  if (!client) {
    return res.status(404).json({ error: "الموكل غير موجود." });
  }

  await softDeleteClient(client.id);

  await writeAudit({
    userId: req.user.id,
    action: "client_deleted",
    entityType: "client",
    entityId: client.id,
    metadata: { name: client.name },
    ip: req.ip,
  });

  res.json({ message: "تم حذف الموكل والقضايا المرتبطة." });
});

async function getAssignableUser(userId) {
  const user = await db.prepare(`SELECT id, name, role, status FROM users WHERE id = ?`).get(userId);
  if (!user || user.status !== "active" || !["lawyer", "assistant"].includes(user.role)) {
    return null;
  }
  return user;
}

async function getTaskAssignee(userId, actor) {
  const assignee = await getAssignableUser(userId);
  if (assignee) return assignee;
  if (actor?.role === "admin" && actor.id === userId && actor.status === "active") {
    return actor;
  }
  return null;
}

router.post("/cases", async (req, res) => {
  const title = String(req.body?.title || "").trim();
  const clientId = String(req.body?.client_id || "");
  const assignedTo = String(req.body?.assigned_to || "");

  if (!title || !clientId || !assignedTo) {
    return res.status(400).json({ error: "عنوان القضية واسم الموكل والمحامي المعيّن مطلوبون." });
  }

  const client = await db
    .prepare(`SELECT id, name FROM clients WHERE id = ? AND deleted_at IS NULL`)
    .get(clientId);
  if (!client) {
    return res.status(400).json({ error: "الموكل غير موجود." });
  }

  const assignee = await getAssignableUser(assignedTo);
  if (!assignee) {
    return res.status(400).json({ error: "يجب اختيار محامٍ أو مساعد نشط." });
  }

  const caseId = uuid();
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO cases (id, title, client_id, status, assigned_to, opened_at, created_by)
     VALUES (?, ?, ?, 'active', ?, ?, ?)`
    )
    .run(caseId, title, clientId, assignedTo, now, req.user.id);

  await writeAudit({
    userId: req.user.id,
    action: "case_created",
    entityType: "case",
    entityId: caseId,
    metadata: { title, client_id: clientId, assigned_to: assignedTo },
    ip: req.ip,
  });

  res.status(201).json({
    case: {
      id: caseId,
      title,
      client_id: clientId,
      client_name: client.name,
      status: "active",
      assigned_to: assignedTo,
      opened_at: now,
    },
    message: "تم إنشاء القضية وتعيينها للمحامي.",
  });
});

router.delete("/cases/:id", async (req, res) => {
  const caseRow = await db
    .prepare(`SELECT id, title FROM cases WHERE id = ? AND deleted_at IS NULL`)
    .get(req.params.id);
  if (!caseRow) {
    return res.status(404).json({ error: "القضية غير موجودة." });
  }

  await softDeleteCase(caseRow.id);

  await writeAudit({
    userId: req.user.id,
    action: "case_deleted",
    entityType: "case",
    entityId: caseRow.id,
    metadata: { title: caseRow.title },
    ip: req.ip,
  });

  res.json({ message: "تم حذف القضية والمهام المرتبطة." });
});

router.post("/tasks", async (req, res) => {
  const caseId = String(req.body?.case_id || "");
  const title = String(req.body?.title || "").trim();
  const assignedTo = String(req.body?.assigned_to || "");
  const dueAt = req.body?.due_at ? String(req.body.due_at) : null;

  if (!caseId || !title || !assignedTo) {
    return res.status(400).json({ error: "القضية وعنوان المهمة والمحامي المعيّن مطلوبون." });
  }

  const caseRow = await db
    .prepare(`SELECT id, title, status, attachments FROM cases WHERE id = ? AND deleted_at IS NULL`)
    .get(caseId);
  if (!caseRow || caseRow.status === "archived") {
    return res.status(400).json({ error: "القضية غير موجودة أو مؤرشفة." });
  }

  const assignee = await getTaskAssignee(assignedTo, req.user);
  if (!assignee) {
    return res.status(400).json({ error: "يجب اختيار محامٍ أو مساعد نشط." });
  }

  const attachments = pickCaseAttachments(caseRow, req.body?.attachments);
  const taskId = uuid();
  await db
    .prepare(
      `INSERT INTO tasks (id, case_id, title, assigned_to, due_at, created_by, attachments)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(taskId, caseId, title, assignedTo, dueAt, req.user.id, attachments);

  await writeAudit({
    userId: req.user.id,
    action: "task_created",
    entityType: "task",
    entityId: taskId,
    metadata: { title, case_id: caseId, assigned_to: assignedTo, attachments_count: attachments.length },
    ip: req.ip,
  });

  res.status(201).json({
    task: {
      id: taskId,
      case_id: caseId,
      title,
      assigned_to: assignedTo,
      status: "open",
      due_at: dueAt,
      attachments,
    },
    message: "تم إنشاء المهمة وتعيينها للمحامي.",
  });
});

router.patch("/tasks/:id", async (req, res) => {
  const taskRow = await db
    .prepare(
      `SELECT id, case_id, title, assigned_to, status, due_at, attachments, created_at, created_by FROM tasks WHERE id = ? AND deleted_at IS NULL`
    )
    .get(req.params.id);
  if (!taskRow) {
    return res.status(404).json({ error: "المهمة غير موجودة." });
  }

  const title = String(req.body?.title || "").trim();
  const assignedTo = String(req.body?.assigned_to || "");
  const dueAt = req.body?.due_at ? String(req.body.due_at) : null;

  if (!title || !assignedTo) {
    return res.status(400).json({ error: "عنوان المهمة والمحامي المعيّن مطلوبان." });
  }

  const caseRow = await db
    .prepare(`SELECT id, title, status, attachments FROM cases WHERE id = ? AND deleted_at IS NULL`)
    .get(taskRow.case_id);
  if (!caseRow || caseRow.status === "archived") {
    return res.status(400).json({ error: "القضية المرتبطة بالمهمة غير موجودة أو مؤرشفة." });
  }

  const assignee = await getTaskAssignee(assignedTo, req.user);
  if (!assignee) {
    return res.status(400).json({ error: "يجب اختيار محامٍ أو مساعد نشط." });
  }

  const attachments = pickCaseAttachments(caseRow, req.body?.attachments);
  await db
    .prepare(`UPDATE tasks SET title = ?, assigned_to = ?, due_at = ?, attachments = ? WHERE id = ?`)
    .run(title, assignedTo, dueAt, attachments, taskRow.id);

  await writeAudit({
    userId: req.user.id,
    action: "task_updated",
    entityType: "task",
    entityId: taskRow.id,
    metadata: { title, assigned_to: assignedTo, attachments_count: attachments.length },
    ip: req.ip,
  });

  res.json({
    task: await enrichTask({ ...taskRow, title, assigned_to: assignedTo, due_at: dueAt, attachments }),
    message: "تم تحديث المهمة.",
  });
});

router.delete("/tasks/:id", async (req, res) => {
  const task = await db
    .prepare(`SELECT id, title FROM tasks WHERE id = ? AND deleted_at IS NULL`)
    .get(req.params.id);
  if (!task) {
    return res.status(404).json({ error: "المهمة غير موجودة." });
  }

  await softDeleteTask(task.id);

  await writeAudit({
    userId: req.user.id,
    action: "task_deleted",
    entityType: "task",
    entityId: task.id,
    metadata: { title: task.title },
    ip: req.ip,
  });

  res.json({ message: "تم حذف المهمة." });
});

export default router;
