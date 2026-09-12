import { Router } from "express";
import db from "../db.js";
import { writeAudit } from "../lib/audit.js";
import {
  SECTION_DEFS,
  VALID_SECTION_IDS,
  attachTaskWaiting,
  canViewSection,
  getActiveUser,
  getManagedSection,
  getSection,
  getSectionStats,
  getUserSectionId,
  isAdminOnly,
  isOfficeStaff,
  isSectionManager,
  isUserInSection,
  listSectionCases,
  listSectionMembers,
  listSubsectionLeads,
  listTasksForCase,
  moveLawyerToSection,
  normalizeSubsectionId,
  publicUserBrief,
  setMemberSubsection,
  setSubsectionLead,
  subsectionName,
  subsectionsFor,
} from "../lib/sections.js";
import { enrichCase, enrichTask } from "../lib/entities.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

function requireSectionsViewer(req, res, next) {
  const role = req.user?.role;
  if (!["admin", "assistant", "section_manager"].includes(role)) {
    return res.status(403).json({ error: "غير مصرح." });
  }
  next();
}

async function enrichSection(section, { includeMembers = true, includeStats = true } = {}) {
  const manager = section.manager_id ? await getActiveUser(section.manager_id) : null;
  const members = includeMembers ? await listSectionMembers(section.id) : [];
  const stats = includeStats ? await getSectionStats(section.id) : null;
  const leads = await listSubsectionLeads(section.id);
  const leadBySs = new Map(leads.map((row) => [row.subsection_id, row.user_id]));
  const previewCases = [];
  for (const preview of stats?.preview_cases || []) {
    const responsibleId = preview.subsection_id
      ? leadBySs.get(preview.subsection_id) || null
      : preview.assigned_to;
    const lawyer = responsibleId ? await getActiveUser(responsibleId) : null;
    const caseRow = await db
      .prepare(`SELECT id, title, client_id, status, assigned_to FROM cases WHERE id = ? AND deleted_at IS NULL`)
      .get(preview.id);
    const client = caseRow?.client_id
      ? await db.prepare(`SELECT id, name FROM clients WHERE id = ? AND deleted_at IS NULL`).get(caseRow.client_id)
      : null;
    previewCases.push({
      ...preview,
      client_name: client?.name || null,
      lawyer_name: lawyer?.name || null,
    });
  }
  return {
    id: section.id,
    name: section.name,
    manager: publicUserBrief(manager),
    members: members.map((member) => ({
      ...publicUserBrief(member),
      subsection_id: member.subsection_id || null,
      subsection_name: subsectionName(section.id, member.subsection_id),
    })),
    stats: stats
      ? {
          cases: stats.cases,
          lawyers: stats.lawyers,
          tasks_done: stats.tasks_done,
          tasks_open: stats.tasks_open,
        }
      : null,
    preview_cases: previewCases,
    subsections: await enrichSubsections(section.id),
  };
}

async function enrichSubsections(sectionId) {
  const leads = await listSubsectionLeads(sectionId);
  const leadById = new Map(leads.map((row) => [row.subsection_id, row.user_id]));
  const rows = [];
  for (const item of subsectionsFor(sectionId)) {
    const lead = leadById.get(item.id) ? await getActiveUser(leadById.get(item.id)) : null;
    rows.push({ ...item, lead: publicUserBrief(lead) });
  }
  return rows;
}

async function canAssignLeads(user, sectionId) {
  if (!isSectionManager(user) || !sectionId) return false;
  const managed = await getManagedSection(user.id);
  return managed?.id === sectionId;
}

async function listManagerCandidates() {
  const users = await db
    .prepare(`SELECT id, username, name, role, status, created_at FROM users ORDER BY created_at DESC`)
    .all();
  return users.filter((user) => user.status === "active" && ["lawyer", "section_manager"].includes(user.role));
}

async function listLawyerCandidates() {
  const users = await db
    .prepare(`SELECT id, username, name, role, status, created_at FROM users ORDER BY created_at DESC`)
    .all();
  const lawyers = users.filter((user) => user.status === "active" && user.role === "lawyer");
  const result = [];
  for (const lawyer of lawyers) {
    result.push({
      ...publicUserBrief(lawyer),
      section_id: await getUserSectionId(lawyer.id),
    });
  }
  return result;
}

router.get("/", requireSectionsViewer, async (req, res) => {
  try {
    const rows = await db.prepare(`SELECT id, name, manager_id FROM sections ORDER BY id`).all();
    const ordered = SECTION_DEFS.map((def) => (rows || []).find((row) => row.id === def.id)).filter(Boolean);
    const managed = isOfficeStaff(req.user) ? null : await getManagedSection(req.user.id);
    const visible = isOfficeStaff(req.user) ? ordered : ordered.filter((row) => row.id === managed?.id);
    const sections = await Promise.all(
      visible.map(async (row) => ({
        ...(await enrichSection(row)),
        can_edit: isOfficeStaff(req.user),
        can_delete: isAdminOnly(req.user),
        can_assign_leads: await canAssignLeads(req.user, row.id),
      }))
    );

    const payload = { sections };
    if (isOfficeStaff(req.user)) {
      payload.candidates = {
        managers: (await listManagerCandidates()).map(publicUserBrief),
        lawyers: await listLawyerCandidates(),
      };
    }

    res.json(payload);
  } catch (error) {
    console.error("[portal] list sections error:", error);
    res.status(500).json({ error: "تعذر تحميل الأقسام." });
  }
});

router.get("/:id", requireSectionsViewer, async (req, res) => {
  try {
    const sectionId = String(req.params.id || "");
    if (!VALID_SECTION_IDS.includes(sectionId)) {
      return res.status(400).json({ error: "القسم غير صالح." });
    }
    if (!(await canViewSection(req.user, sectionId))) {
      return res.status(403).json({ error: "غير مصرح." });
    }

    const section = await getSection(sectionId);
    if (!section) {
      return res.status(404).json({ error: "القسم غير موجود." });
    }

    const caseRows = await listSectionCases(sectionId);
    const cases = [];
    for (const caseRow of caseRows) {
      const enriched = await enrichCase(caseRow);
      const taskRows = attachTaskWaiting(await listTasksForCase(caseRow.id));
      const tasks = await Promise.all(taskRows.map((task) => enrichTask(task)));
      cases.push({ ...enriched, tasks });
    }

    const payload = {
      section: {
        ...(await enrichSection(section)),
        can_edit: isOfficeStaff(req.user),
        can_delete: isAdminOnly(req.user),
        can_assign_leads: await canAssignLeads(req.user, sectionId),
      },
      cases,
    };
    if (isOfficeStaff(req.user)) {
      payload.candidates = {
        managers: (await listManagerCandidates()).map(publicUserBrief),
        lawyers: await listLawyerCandidates(),
      };
    }
    res.json(payload);
  } catch (error) {
    console.error("[portal] section detail error:", error);
    res.status(500).json({ error: "تعذر تحميل القسم." });
  }
});

router.patch("/:id/manager", async (req, res) => {
  if (!isOfficeStaff(req.user)) {
    return res.status(403).json({ error: "تعيين مديري الأقسام متاح للإدارة فقط." });
  }

  const sectionId = String(req.params.id || "");
  if (!VALID_SECTION_IDS.includes(sectionId)) {
    return res.status(400).json({ error: "القسم غير صالح." });
  }

  const section = await getSection(sectionId);
  if (!section) {
    return res.status(404).json({ error: "القسم غير موجود." });
  }

  const managerId = String(req.body?.manager_id || "").trim();
  const previousManagerId = section.manager_id || null;

  if (previousManagerId) {
    return res.status(409).json({ error: "لا يمكن تغيير مدير القسم بعد تعيينه." });
  }

  if (!managerId) {
    return res.status(400).json({ error: "يجب اختيار مدير القسم." });
  }

  const manager = await getActiveUser(managerId);
  if (!manager || !["lawyer", "section_manager"].includes(manager.role)) {
    return res.status(400).json({ error: "يجب اختيار محامٍ أو مدير قسم نشط." });
  }

  const otherManaged = await getManagedSection(managerId);
  if (otherManaged && otherManaged.id !== sectionId) {
    return res.status(400).json({ error: "هذا المستخدم يدير قسماً آخر بالفعل." });
  }

  const memberSectionId = await getUserSectionId(managerId);
  if (memberSectionId && memberSectionId !== sectionId) {
    await db.prepare(`DELETE FROM section_members WHERE user_id = ?`).run(managerId);
  }

  await db.prepare(`UPDATE sections SET manager_id = ? WHERE id = ?`).run(managerId, sectionId);
  if (manager.role !== "section_manager") {
    await db.prepare(`UPDATE users SET role = ? WHERE id = ?`).run("section_manager", managerId);
  }
  await writeAudit({
    userId: req.user.id,
    action: "section_manager_set",
    entityType: "section",
    entityId: sectionId,
    metadata: { manager_id: managerId, previous_manager_id: previousManagerId },
    ip: req.ip,
  });

  const updated = await getSection(sectionId);
  res.json({
    section: { ...(await enrichSection(updated)), can_edit: true },
    message: "تم تعيين مدير القسم.",
  });
});

router.patch("/:id/subsections/:subsectionId/lead", async (req, res) => {
  if (!isSectionManager(req.user)) {
    return res.status(403).json({ error: "تعيين مسؤولي الأقسام الفرعية متاح لمدير القسم فقط." });
  }

  const sectionId = String(req.params.id || "");
  if (!VALID_SECTION_IDS.includes(sectionId)) {
    return res.status(400).json({ error: "القسم غير صالح." });
  }

  const managed = await getManagedSection(req.user.id);
  if (!managed || managed.id !== sectionId) {
    return res.status(403).json({ error: "يمكنك تعيين مسؤولي أقسامك الفرعية فقط." });
  }

  const subsectionId = normalizeSubsectionId(sectionId, req.params.subsectionId);
  if (!subsectionId) {
    return res.status(400).json({ error: "القسم الفرعي غير صالح." });
  }

  const userId = String(req.body?.user_id || "").trim();
  if (!userId) {
    await setSubsectionLead(sectionId, subsectionId, null);
    await writeAudit({
      userId: req.user.id,
      action: "subsection_lead_cleared",
      entityType: "section",
      entityId: sectionId,
      metadata: { subsection_id: subsectionId },
      ip: req.ip,
    });
    const updated = await getSection(sectionId);
    return res.json({
      section: {
        ...(await enrichSection(updated)),
        can_edit: false,
        can_assign_leads: true,
      },
      message: "تم إلغاء تعيين المسؤول.",
    });
  }

  if (!(await isUserInSection(userId, sectionId))) {
    return res.status(400).json({ error: "يجب اختيار محامٍ من القسم." });
  }
  const lawyer = await getActiveUser(userId);
  if (!lawyer || lawyer.role !== "lawyer" || lawyer.status !== "active") {
    return res.status(400).json({ error: "يجب اختيار محامٍ نشط من القسم." });
  }

  await setSubsectionLead(sectionId, subsectionId, userId);
  await writeAudit({
    userId: req.user.id,
    action: "subsection_lead_set",
    entityType: "section",
    entityId: sectionId,
    metadata: { subsection_id: subsectionId, user_id: userId },
    ip: req.ip,
  });

  const updated = await getSection(sectionId);
  res.json({
    section: {
      ...(await enrichSection(updated)),
      can_edit: false,
      can_assign_leads: true,
    },
    message: "تم تعيين مسؤول القسم الفرعي.",
  });
});

router.patch("/:id/members/:userId/subsection", async (req, res) => {
  if (!isSectionManager(req.user)) {
    return res.status(403).json({ error: "تعيين المحامين للأقسام الفرعية متاح لمدير القسم فقط." });
  }

  const sectionId = String(req.params.id || "");
  const userId = String(req.params.userId || "");
  if (!VALID_SECTION_IDS.includes(sectionId) || !userId) {
    return res.status(400).json({ error: "بيانات غير صالحة." });
  }

  const managed = await getManagedSection(req.user.id);
  if (!managed || managed.id !== sectionId) {
    return res.status(403).json({ error: "يمكنك تعيين محامي قسمك فقط." });
  }

  if (!(await isUserInSection(userId, sectionId))) {
    return res.status(404).json({ error: "المحامي غير موجود في هذا القسم." });
  }

  const lawyer = await getActiveUser(userId);
  if (!lawyer || lawyer.role !== "lawyer" || lawyer.status !== "active") {
    return res.status(400).json({ error: "يجب اختيار محامٍ نشط من القسم." });
  }

  const requested = String(req.body?.subsection_id || "").trim();
  const subsectionId = requested ? normalizeSubsectionId(sectionId, requested) : null;
  if (requested && !subsectionId) {
    return res.status(400).json({ error: "القسم الفرعي غير صالح." });
  }

  await setMemberSubsection(sectionId, userId, subsectionId);
  await writeAudit({
    userId: req.user.id,
    action: "subsection_member_set",
    entityType: "section",
    entityId: sectionId,
    metadata: { subsection_id: subsectionId, user_id: userId },
    ip: req.ip,
  });

  const updated = await getSection(sectionId);
  res.json({
    section: {
      ...(await enrichSection(updated)),
      can_edit: false,
      can_assign_leads: true,
    },
    message: subsectionId ? "تم تعيين المحامي إلى القسم الفرعي." : "تم إلغاء تعيين المحامي من القسم الفرعي.",
  });
});

router.post("/:id/members", async (req, res) => {
  if (!isOfficeStaff(req.user)) {
    return res.status(403).json({ error: "إضافة المحامين للأقسام متاحة للإدارة فقط." });
  }

  const sectionId = String(req.params.id || "");
  if (!VALID_SECTION_IDS.includes(sectionId)) {
    return res.status(400).json({ error: "القسم غير صالح." });
  }

  const section = await getSection(sectionId);
  if (!section) {
    return res.status(404).json({ error: "القسم غير موجود." });
  }

  const userId = String(req.body?.user_id || "").trim();
  const lawyer = await getActiveUser(userId);
  if (!lawyer || lawyer.role !== "lawyer") {
    return res.status(400).json({ error: "يجب اختيار محامٍ نشط." });
  }

  if (await isUserInSection(userId, sectionId)) {
    return res.status(409).json({ error: "المحامي منضم لهذا القسم بالفعل." });
  }

  const managed = await getManagedSection(userId);
  if (managed) {
    return res.status(400).json({ error: "لا يمكن إضافة مدير قسم كمحامٍ في قسم." });
  }

  await moveLawyerToSection(userId, sectionId);

  await writeAudit({
    userId: req.user.id,
    action: "section_member_added",
    entityType: "section",
    entityId: sectionId,
    metadata: { member_id: userId },
    ip: req.ip,
  });

  res.status(201).json({
    section: { ...(await enrichSection(section)), can_edit: true },
    message: "تم إضافة المحامي إلى القسم.",
  });
});

router.delete("/:id/members/:userId", async (req, res) => {
  if (!isAdminOnly(req.user)) {
    return res.status(403).json({ error: "إزالة المحامين من الأقسام متاحة للمدير فقط." });
  }

  const sectionId = String(req.params.id || "");
  const userId = String(req.params.userId || "");
  if (!VALID_SECTION_IDS.includes(sectionId) || !userId) {
    return res.status(400).json({ error: "بيانات غير صالحة." });
  }

  if (!(await isUserInSection(userId, sectionId))) {
    return res.status(404).json({ error: "المحامي غير موجود في هذا القسم." });
  }

  await db.prepare(`DELETE FROM section_members WHERE section_id = ? AND user_id = ?`).run(sectionId, userId);
  await db.prepare(`DELETE FROM subsection_leads WHERE section_id = ? AND user_id = ?`).run(sectionId, userId);

  await writeAudit({
    userId: req.user.id,
    action: "section_member_removed",
    entityType: "section",
    entityId: sectionId,
    metadata: { member_id: userId },
    ip: req.ip,
  });

  const section = await getSection(sectionId);
  res.json({
    section: { ...(await enrichSection(section)), can_edit: true },
    message: "تم إزالة المحامي من القسم.",
  });
});

export default router;
