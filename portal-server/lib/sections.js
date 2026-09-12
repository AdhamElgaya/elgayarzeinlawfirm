import db, { dbMode } from "../db.js";

export const SECTION_DEFS = [
  { id: "section-1", name: "قسم 1" },
  { id: "section-2", name: "قسم 2" },
  { id: "section-3", name: "قسم 3" },
  { id: "section-4", name: "قسم 4" },
];

export const VALID_SECTION_IDS = SECTION_DEFS.map((item) => item.id);

const SHARED_SUBSECTIONS = [
  { id: "civil", name: "مدني" },
  { id: "criminal", name: "جنائي" },
  { id: "personal_status", name: "أحوال شخصية" },
  { id: "commercial", name: "تجاري" },
];

export const SUBSECTION_DEFS = {
  "section-1": SHARED_SUBSECTIONS,
  "section-2": SHARED_SUBSECTIONS,
  "section-3": SHARED_SUBSECTIONS,
  "section-4": SHARED_SUBSECTIONS,
};

export function subsectionsFor(sectionId) {
  return SUBSECTION_DEFS[sectionId] || [];
}

export function subsectionName(sectionId, subsectionId) {
  if (!sectionId || !subsectionId) return null;
  return subsectionsFor(sectionId).find((item) => item.id === subsectionId)?.name || null;
}

export function normalizeSubsectionId(sectionId, subsectionId) {
  const allowed = subsectionsFor(sectionId);
  if (!allowed.length) return null;
  const id = String(subsectionId || "").trim();
  return allowed.some((item) => item.id === id) ? id : null;
}

const LEGACY_SECTION_REMAP = {
  administrative: "section-1",
  executive: "section-2",
};

export function isOfficeStaff(user) {
  return user?.role === "admin" || user?.role === "assistant";
}

export function isSectionManager(user) {
  return user?.role === "section_manager";
}

export function isAdminOnly(user) {
  return user?.role === "admin";
}

async function remapLegacySections() {
  for (const [oldId, newId] of Object.entries(LEGACY_SECTION_REMAP)) {
    const oldRow = await db.prepare(`SELECT id, name, manager_id FROM sections WHERE id = ?`).get(oldId);
    if (!oldRow) continue;

    const newRow = await db.prepare(`SELECT id, name, manager_id FROM sections WHERE id = ?`).get(newId);
    if (newRow && !newRow.manager_id && oldRow.manager_id) {
      await db.prepare(`UPDATE sections SET manager_id = ? WHERE id = ?`).run(oldRow.manager_id, newId);
    }

    if (dbMode !== "postgres") continue;

    await db.prepare(`UPDATE cases SET section_id = ? WHERE section_id = ?`).run(newId, oldId);
    await db.prepare(`UPDATE tasks SET section_id = ? WHERE section_id = ?`).run(newId, oldId);
    await db
      .prepare(
        `UPDATE section_members SET section_id = ? WHERE section_id = ? AND user_id NOT IN (SELECT user_id FROM section_members WHERE section_id = ?)`
      )
      .run(newId, oldId, newId);
    await db.prepare(`DELETE FROM section_members WHERE section_id = ?`).run(oldId);

    const libraryRows = await db
      .prepare(
        `SELECT id, label, filename, original_name, mime_type, size, section_ids, created_by, created_at FROM library_attachments ORDER BY created_at DESC`
      )
      .all();
    for (const row of libraryRows || []) {
      let ids = row.section_ids;
      if (typeof ids === "string") {
        try {
          ids = JSON.parse(ids);
        } catch {
          ids = [];
        }
      }
      if (!Array.isArray(ids) || !ids.includes(oldId)) continue;
      const nextIds = [...new Set(ids.map((id) => (id === oldId ? newId : id)))];
      await db.prepare(`UPDATE library_attachments SET label = ?, section_ids = ? WHERE id = ?`).run(row.label, nextIds, row.id);
    }
  }
}

export async function ensureSections() {
  for (const def of SECTION_DEFS) {
    const existing = await db.prepare(`SELECT id, name, manager_id FROM sections WHERE id = ?`).get(def.id);
    if (!existing) {
      await db.prepare(`INSERT INTO sections (id, name, manager_id) VALUES (?, ?, ?)`).run(def.id, def.name, null);
    } else if (existing.name !== def.name) {
      await db.prepare(`UPDATE sections SET name = ? WHERE id = ?`).run(def.name, def.id);
    }
  }

  await remapLegacySections();
  await syncAllSubsectionLeadAssignments();

  const rows = await db.prepare(`SELECT id, name, manager_id FROM sections`).all();
  for (const row of rows || []) {
    if (!VALID_SECTION_IDS.includes(row.id)) {
      await db.prepare(`DELETE FROM sections WHERE id = ?`).run(row.id);
    }
  }
}

export async function getSection(sectionId) {
  if (!sectionId) return null;
  return (await db.prepare(`SELECT id, name, manager_id FROM sections WHERE id = ?`).get(sectionId)) || null;
}

export async function getManagedSection(userId) {
  if (!userId) return null;
  return (await db.prepare(`SELECT id, name, manager_id FROM sections WHERE manager_id = ?`).get(userId)) || null;
}

export async function getUserSectionId(userId) {
  if (!userId) return null;
  const row = await db.prepare(`SELECT section_id FROM section_members WHERE user_id = ?`).get(userId);
  return row?.section_id || null;
}

export async function isUserInSection(userId, sectionId) {
  if (!userId || !sectionId) return false;
  const row = await db
    .prepare(`SELECT user_id FROM section_members WHERE section_id = ? AND user_id = ?`)
    .get(sectionId, userId);
  return Boolean(row);
}

export async function listSectionMembers(sectionId) {
  const rows = await db
    .prepare(
      `SELECT u.id, u.username, u.name, u.role, u.status, sm.subsection_id
       FROM section_members sm
       JOIN users u ON u.id = sm.user_id
       WHERE sm.section_id = ?`
    )
    .all(sectionId);
  return rows.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ar"));
}

export async function setMemberSubsection(sectionId, userId, subsectionId) {
  if (!sectionId || !userId) return;
  await db
    .prepare(`UPDATE section_members SET subsection_id = ? WHERE section_id = ? AND user_id = ?`)
    .run(subsectionId || null, sectionId, userId);
}

export async function getUserMembership(userId) {
  if (!userId) return null;
  return (await db.prepare(`SELECT section_id, subsection_id FROM section_members WHERE user_id = ?`).get(userId)) || null;
}

export async function moveLawyerToSection(userId, nextSectionId) {
  if (!userId || !VALID_SECTION_IDS.includes(nextSectionId)) {
    return { changed: false, previous_section_id: null };
  }
  const currentId = await getUserSectionId(userId);
  if (currentId === nextSectionId) {
    return { changed: false, previous_section_id: currentId };
  }
  await db.prepare(`DELETE FROM subsection_leads WHERE user_id = ?`).run(userId);
  if (currentId) {
    await db.prepare(`DELETE FROM section_members WHERE user_id = ?`).run(userId);
  }
  await db.prepare(`INSERT INTO section_members (section_id, user_id) VALUES (?, ?)`).run(nextSectionId, userId);
  return { changed: true, previous_section_id: currentId };
}

export async function listSubsectionMembers(sectionId, subsectionId) {
  if (!sectionId || !subsectionId) return [];
  return (await listSectionMembers(sectionId)).filter(
    (user) => user.status === "active" && user.role === "lawyer" && user.subsection_id === subsectionId
  );
}

export async function isLawyerInSubsection(userId, sectionId, subsectionId) {
  if (!userId || !sectionId || !subsectionId) return false;
  return (await listSubsectionMembers(sectionId, subsectionId)).some((user) => user.id === userId);
}

export async function listLedSubsections(userId) {
  if (!userId) return [];
  const rows =
    (await db.prepare(`SELECT section_id, subsection_id, user_id FROM subsection_leads WHERE user_id = ?`).all(userId)) ||
    [];
  return rows.map((row) => ({
    section_id: row.section_id,
    subsection_id: row.subsection_id,
    subsection_name: subsectionName(row.section_id, row.subsection_id),
  }));
}

export async function listSectionLawyers(sectionId) {
  return (await listSectionMembers(sectionId)).filter((user) => user.status === "active" && user.role === "lawyer");
}

export async function listSubsectionLeads(sectionId) {
  if (!sectionId) return [];
  return (await db
    .prepare(`SELECT section_id, subsection_id, user_id FROM subsection_leads WHERE section_id = ?`)
    .all(sectionId)) || [];
}

export async function setSubsectionLead(sectionId, subsectionId, userId) {
  await db
    .prepare(`DELETE FROM subsection_leads WHERE section_id = ? AND subsection_id = ?`)
    .run(sectionId, subsectionId);
  if (userId) {
    await db.prepare(`DELETE FROM subsection_leads WHERE section_id = ? AND user_id = ?`).run(sectionId, userId);
    await db
      .prepare(`INSERT INTO subsection_leads (section_id, subsection_id, user_id) VALUES (?, ?, ?)`)
      .run(sectionId, subsectionId, userId);
    await setMemberSubsection(sectionId, userId, subsectionId);
  }
  await syncCasesAssignedToSubsectionLead(sectionId, subsectionId, userId);
}

export async function getSubsectionLead(sectionId, subsectionId) {
  if (!sectionId || !subsectionId) return null;
  const row = await db
    .prepare(`SELECT user_id FROM subsection_leads WHERE section_id = ? AND subsection_id = ?`)
    .get(sectionId, subsectionId);
  return row?.user_id || null;
}

export async function syncCasesAssignedToSubsectionLead(sectionId, subsectionId, userId) {
  if (!sectionId || !subsectionId) return;
  let assignedTo = userId || null;
  if (!assignedTo) {
    const section = await getSection(sectionId);
    assignedTo = section?.manager_id || null;
  }
  if (!assignedTo) return;
  await db
    .prepare(
      `UPDATE cases SET assigned_to = ? WHERE section_id = ? AND subsection_id = ? AND deleted_at IS NULL`
    )
    .run(assignedTo, sectionId, subsectionId);
}

export async function syncAllSubsectionLeadAssignments() {
  const leads = await db.prepare(`SELECT section_id, subsection_id, user_id FROM subsection_leads`).all();
  for (const lead of leads || []) {
    await syncCasesAssignedToSubsectionLead(lead.section_id, lead.subsection_id, lead.user_id);
  }
}

export async function canViewSection(user, sectionId) {
  if (!user || !sectionId) return false;
  if (isOfficeStaff(user)) return true;
  if (isSectionManager(user)) {
    const managed = await getManagedSection(user.id);
    return managed?.id === sectionId;
  }
  return false;
}

export async function listSectionCases(sectionId) {
  if (!sectionId) return [];
  return await db
    .prepare(
      `SELECT id, title, client_id, client_ref, notes, attachments, status, opened_at, finished_at, archived_at, assigned_to, section_id, subsection_id, opponent_name, case_number
       FROM cases
       WHERE deleted_at IS NULL
         AND status != 'archived'
         AND section_id = ?
       ORDER BY opened_at DESC`
    )
    .all(sectionId);
}

export async function listTasksForCase(caseId) {
  if (!caseId) return [];
  return await db
    .prepare(
      `SELECT id, case_id, title, assigned_to, section_id, status, due_at, incomplete_reason, assigned_at, attachments, created_at, created_by FROM tasks WHERE case_id = ? AND deleted_at IS NULL ORDER BY created_at ASC`
    )
    .all(caseId);
}

export function attachTaskWaiting(tasks) {
  const sorted = [...(tasks || [])].sort((a, b) => {
    const left = a.due_at || a.created_at || "";
    const right = b.due_at || b.created_at || "";
    return String(left).localeCompare(String(right));
  });
  let previousOpen = null;
  return sorted.map((task) => {
    let waiting_for = null;
    if (task.status === "open") {
      if (previousOpen) {
        waiting_for = {
          id: previousOpen.id,
          title: previousOpen.title,
          due_at: previousOpen.due_at || previousOpen.created_at || null,
        };
      }
      previousOpen = task;
    }
    return { ...task, waiting_for };
  });
}

export async function getSectionStats(sectionId) {
  const members = await listSectionMembers(sectionId);
  const lawyers = members.filter((user) => user.status === "active" && user.role === "lawyer");
  const cases = await listSectionCases(sectionId);
  let tasksDone = 0;
  let tasksOpen = 0;
  const previewCases = [];

  for (const caseRow of cases) {
    const tasks = await listTasksForCase(caseRow.id);
    const done = tasks.filter((task) => task.status === "done").length;
    const open = tasks.filter((task) => task.status === "open").length;
    tasksDone += done;
    tasksOpen += open;
    previewCases.push({
      id: caseRow.id,
      title: caseRow.title,
      status: caseRow.status,
      assigned_to: caseRow.assigned_to,
      subsection_id: caseRow.subsection_id || null,
      subsection_name: subsectionName(sectionId, caseRow.subsection_id),
      open_tasks: open,
      done_tasks: done,
    });
  }

  return {
    cases: cases.length,
    lawyers: lawyers.length,
    tasks_done: tasksDone,
    tasks_open: tasksOpen,
    preview_cases: previewCases,
  };
}

export async function visibilityParams(user) {
  const seeAll = isOfficeStaff(user) ? 1 : 0;
  let sectionId = "";
  if (isSectionManager(user)) {
    const managed = await getManagedSection(user.id);
    sectionId = managed?.id || "__none__";
  }
  return [user.id, seeAll, sectionId];
}

export async function canAccessCase(user, caseRow) {
  if (!user || !caseRow) return false;
  if (isOfficeStaff(user)) return true;
  if (caseRow.assigned_to === user.id) return true;
  if (isSectionManager(user)) {
    const managed = await getManagedSection(user.id);
    return Boolean(managed && caseRow.section_id === managed.id);
  }
  if (user.role === "lawyer") {
    const led = await listLedSubsections(user.id);
    if (
      led.some(
        (item) => item.section_id === caseRow.section_id && item.subsection_id === caseRow.subsection_id
      )
    ) {
      return true;
    }
    const membership = await getUserMembership(user.id);
    return Boolean(
      membership?.section_id &&
        membership.subsection_id &&
        caseRow.section_id === membership.section_id &&
        caseRow.subsection_id === membership.subsection_id
    );
  }
  return false;
}

export async function canAccessTask(user, taskRow, caseRow = null) {
  if (!user || !taskRow) return false;
  if (isOfficeStaff(user)) return true;
  if (taskRow.assigned_to === user.id) return true;
  if (isSectionManager(user)) {
    const managed = await getManagedSection(user.id);
    if (!managed) return false;
    if (taskRow.section_id === managed.id) return true;
    const parent =
      caseRow ||
      (await db.prepare(`SELECT section_id FROM cases WHERE id = ? AND deleted_at IS NULL`).get(taskRow.case_id));
    return parent?.section_id === managed.id;
  }
  const led = await listLedSubsections(user.id);
  if (!led.length) return false;
  const parent =
    caseRow ||
    (await db
      .prepare(`SELECT section_id, subsection_id FROM cases WHERE id = ? AND deleted_at IS NULL`)
      .get(taskRow.case_id));
  return Boolean(
    parent &&
      led.some((item) => item.section_id === parent.section_id && item.subsection_id === parent.subsection_id)
  );
}

export function publicUserBrief(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    status: user.status,
  };
}

export async function getActiveUser(userId) {
  if (!userId) return null;
  const user = await db.prepare(`SELECT id, username, name, role, status FROM users WHERE id = ?`).get(userId);
  if (!user || user.status !== "active") return null;
  return user;
}

export async function demoteManagerIfUnassigned(userId) {
  if (!userId) return;
  const stillManages = await getManagedSection(userId);
  if (stillManages) return;
  const user = await db.prepare(`SELECT id, role FROM users WHERE id = ?`).get(userId);
  if (user?.role === "section_manager") {
    await db.prepare(`UPDATE users SET role = ? WHERE id = ?`).run("lawyer", userId);
  }
}
