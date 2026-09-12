import db from "../db.js";
import {
  SECTION_DEFS,
  VALID_SECTION_IDS,
  getActiveUser,
  getManagedSection,
  isOfficeStaff,
  isSectionManager,
  listLedSubsections,
  listSectionCases,
  subsectionName,
} from "./sections.js";
import { normalizeAttachment } from "./attachments.js";

export function parseSectionIds(value) {
  let ids = value;
  if (typeof ids === "string") {
    try {
      ids = JSON.parse(ids);
    } catch {
      ids = ids
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
    }
  }
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.map((id) => String(id || "").trim()).filter((id) => VALID_SECTION_IDS.includes(id)))];
}

export function libraryToAttachment(row) {
  if (!row) return null;
  return normalizeAttachment({
    id: row.id,
    label: row.label,
    filename: row.filename,
    originalName: row.original_name,
    mimeType: row.mime_type,
    size: row.size,
  });
}

export function publicLibraryRow(row, creator = null) {
  const attachment = libraryToAttachment(row);
  return {
    ...attachment,
    section_ids: parseSectionIds(row.section_ids),
    created_by: row.created_by || null,
    created_by_name: creator?.name || null,
    created_at: row.created_at || null,
  };
}

export async function getLibraryAttachment(id) {
  if (!id) return null;
  return (
    (await db
      .prepare(
        `SELECT id, label, filename, original_name, mime_type, size, section_ids, created_by, created_at FROM library_attachments WHERE id = ?`
      )
      .get(id)) || null
  );
}

export async function listLibraryAttachments() {
  return await db
    .prepare(
      `SELECT id, label, filename, original_name, mime_type, size, section_ids, created_by, created_at FROM library_attachments ORDER BY created_at DESC`
    )
    .all();
}

export async function canViewLibraryAttachment(user, row) {
  if (!user || !row) return false;
  if (isOfficeStaff(user)) return true;
  const ids = parseSectionIds(row.section_ids);
  if (isSectionManager(user)) {
    const managed = await getManagedSection(user.id);
    return Boolean(managed && ids.includes(managed.id));
  }
  return false;
}

function sectionNamesFor(ids) {
  return ids.map((id) => SECTION_DEFS.find((item) => item.id === id)?.name || id);
}

function catalogFromLibrary(row, creator = null) {
  const publicRow = publicLibraryRow(row, creator);
  return {
    ...publicRow,
    section_names: sectionNamesFor(publicRow.section_ids),
    source: "library",
    case_id: null,
    case_title: null,
    subsection_id: null,
    subsection_name: null,
  };
}

function catalogFromCase(caseRow) {
  const attachments = Array.isArray(caseRow.attachments) ? caseRow.attachments : [];
  const sectionIds = caseRow.section_id ? [caseRow.section_id] : [];
  return attachments
    .filter((item) => item && (item.id || item.filename))
    .map((item) => {
      const attachment = normalizeAttachment(item);
      return {
        ...attachment,
        section_ids: sectionIds,
        section_names: sectionNamesFor(sectionIds),
        subsection_id: caseRow.subsection_id || null,
        subsection_name: subsectionName(caseRow.section_id, caseRow.subsection_id),
        case_id: caseRow.id,
        case_title: caseRow.title || null,
        created_by: null,
        created_by_name: null,
        created_at: null,
        source: "case",
      };
    });
}

export async function listCatalogAttachments(user) {
  const seen = new Set();
  const items = [];

  const push = (item) => {
    const key = item?.id || item?.filename;
    if (!key || seen.has(key)) return;
    seen.add(key);
    items.push(item);
  };

  if (isOfficeStaff(user)) {
    for (const row of await listLibraryAttachments()) {
      const creator = row.created_by ? await getActiveUser(row.created_by) : null;
      push(catalogFromLibrary(row, creator));
    }
    for (const section of SECTION_DEFS) {
      for (const caseRow of await listSectionCases(section.id)) {
        for (const item of catalogFromCase(caseRow)) push(item);
      }
    }
    return items;
  }

  if (isSectionManager(user)) {
    const managed = await getManagedSection(user.id);
    if (!managed) return [];
    for (const row of await listLibraryAttachments()) {
      if (!(await canViewLibraryAttachment(user, row))) continue;
      const creator = row.created_by ? await getActiveUser(row.created_by) : null;
      push(catalogFromLibrary(row, creator));
    }
    for (const caseRow of await listSectionCases(managed.id)) {
      for (const item of catalogFromCase(caseRow)) push(item);
    }
    return items;
  }

  const led = await listLedSubsections(user.id);
  for (const ss of led) {
    const cases = (await listSectionCases(ss.section_id)).filter(
      (caseRow) => caseRow.subsection_id === ss.subsection_id
    );
    for (const caseRow of cases) {
      for (const item of catalogFromCase(caseRow)) push(item);
    }
  }
  return items;
}

export async function canRenameLibraryAttachment(user, row) {
  return canViewLibraryAttachment(user, row);
}

export function sectionIdsForCreate(user, requested, managedSectionId) {
  if (isOfficeStaff(user)) {
    const ids = parseSectionIds(requested);
    return ids.length ? ids : VALID_SECTION_IDS.slice();
  }
  if (isSectionManager(user) && managedSectionId) return [managedSectionId];
  return [];
}

export async function insertLibraryAttachment(row) {
  await db
    .prepare(
      `INSERT INTO library_attachments (id, label, filename, original_name, mime_type, size, section_ids, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      row.id,
      row.label,
      row.filename,
      row.original_name || null,
      row.mime_type || null,
      row.size ?? null,
      row.section_ids,
      row.created_by || null,
      row.created_at
    );
}

export async function updateLibraryAttachment(id, { label, section_ids }) {
  if (section_ids) {
    await db
      .prepare(`UPDATE library_attachments SET label = ?, section_ids = ? WHERE id = ?`)
      .run(label, section_ids, id);
    return;
  }
  await db.prepare(`UPDATE library_attachments SET label = ? WHERE id = ?`).run(label, id);
}

export async function propagateLibraryLabel(attachmentId, label) {
  const cases = await db.prepare(`SELECT id, attachments FROM cases WHERE deleted_at IS NULL`).all();
  for (const row of cases) {
    const attachments = Array.isArray(row.attachments) ? row.attachments : [];
    let changed = false;
    const next = attachments.map((item) => {
      if (item?.id !== attachmentId) return item;
      changed = true;
      return { ...item, label };
    });
    if (changed) {
      await db.prepare(`UPDATE cases SET attachments = ? WHERE id = ?`).run(next, row.id);
    }
  }

  const tasks = await db.prepare(`SELECT id, attachments FROM tasks WHERE deleted_at IS NULL`).all();
  for (const row of tasks) {
    const attachments = Array.isArray(row.attachments) ? row.attachments : [];
    let changed = false;
    const next = attachments.map((item) => {
      if (item?.id !== attachmentId) return item;
      changed = true;
      return { ...item, label };
    });
    if (changed) {
      await db.prepare(`UPDATE tasks SET attachments = ? WHERE id = ?`).run(next, row.id);
    }
  }
}

export async function libraryHasFilename(filename) {
  if (!filename) return false;
  const rows = await listLibraryAttachments();
  return rows.some((row) => row.filename === filename);
}
